/**
 * Eight Sleep Importer
 * ======================
 * Handles imports from Eight Sleep data exports.
 *
 * Supported formats:
 * 1. Raw sleep_nights.json export from Eight Sleep
 * 2. Our dashboard_data.json format (re-import)
 */

import type {
  ImporterProfile,
  SleepSession,
  WorkoutSession,
  TimeSeries,
} from '../types/schema';
import type { ImportWarning } from './pipeline';
import { generateId } from '../utils/crypto';

// ============================================================
// IMPORTER PROFILE
// ============================================================

export const EIGHT_SLEEP_PROFILE: ImporterProfile = {
  id: 'eight_sleep_v1',
  vendor: 'eight_sleep',
  name: 'Eight Sleep Export',
  version: '1.0.0',
  description: 'Import sleep data from Eight Sleep JSON export',
  createdAt: new Date().toISOString(),
  isBuiltIn: true,
  filePatterns: [
    {
      fileType: 'json',
      jsonSignature: '$.sessions[*].stages[*].stage',
    },
    {
      fileType: 'json',
      jsonSignature: '$[*].stages[*].stage',
    },
  ],
  mappings: [
    {
      targetTable: 'sleep_sessions',
      sourceType: 'json',
      sourcePath: '$.sessions[*]',
      fieldMappings: [
        { target: 'startedAt', source: 'ts', transform: { type: 'timestamp', format: 'unix_seconds' } },
        { target: 'durationSeconds', source: 'stages', transform: { type: 'compute', formula: 'sum(stages[*].duration)' } },
      ],
    },
  ],
};

// ============================================================
// RAW DATA TYPES (Eight Sleep format)
// ============================================================

interface EightSleepSession {
  ts: number; // Unix timestamp
  stages: EightSleepStage[];
  timeseries?: {
    heartRate?: Array<[number, number | null]>; // [timestamp, value]
    hrv?: Array<[number, number | null]>;
    respiratoryRate?: Array<[number, number | null]>;
    tempBedC?: Array<[number, number | null]>;
    tempRoomC?: Array<[number, number | null]>;
    tnt?: Array<[number, number | null]>; // Tosses and turns
  };
}

interface EightSleepStage {
  stage: 'awake' | 'light' | 'deep' | 'rem' | 'out';
  duration: number; // seconds
}

interface DashboardSession {
  date: string;
  timestamp: number;
  weekday: string;
  sleepHours: number;
  deepPct: number;
  remPct: number;
  lightPct: number;
  awakeMins: number;
  quality: number;
  minHr: number | null;
  avgHr: number | null;
  avgHrv: number | null;
  avgRr: number | null;
  bedTempC: number | null;
  roomTempC: number | null;
  dailyDeficit?: number;
  debt7Day?: number;
  debt14Day?: number;
  cumulativeDebt?: number;
}

// ============================================================
// TRANSFORMER
// ============================================================

interface TransformResult {
  sleepSessions: SleepSession[];
  workoutSessions: WorkoutSession[];
  timeSeries: TimeSeries[];
  warnings: ImportWarning[];
}

export async function transformEightSleep(
  data: unknown,
  sourceId: string,
  userId: string,
  onProgress?: (processed: number, total: number) => void
): Promise<TransformResult> {
  const warnings: ImportWarning[] = [];
  const sleepSessions: SleepSession[] = [];
  const timeSeries: TimeSeries[] = [];

  // Determine if this is raw Eight Sleep data or our dashboard format
  if (isDashboardFormat(data)) {
    return transformDashboardFormat(data as DashboardData, sourceId, userId, onProgress);
  }

  // Handle raw Eight Sleep export
  const rawSessions = extractRawSessions(data);

  if (rawSessions.length === 0) {
    warnings.push({
      type: 'parse_error',
      message: 'No sleep sessions found in file',
    });
    return { sleepSessions, workoutSessions: [], timeSeries, warnings };
  }

  for (let i = 0; i < rawSessions.length; i++) {
    onProgress?.(i + 1, rawSessions.length);

    const raw = rawSessions[i];

    try {
      const session = transformRawSession(raw, sourceId, userId, i);
      if (session) {
        sleepSessions.push(session);

        // Extract time series data
        const sessionTimeSeries = extractTimeSeries(raw, session.id, sourceId, userId);
        timeSeries.push(...sessionTimeSeries);
      }
    } catch (e) {
      warnings.push({
        type: 'parse_error',
        message: `Failed to parse session at index ${i}: ${e instanceof Error ? e.message : 'Unknown error'}`,
        recordIndex: i,
      });
    }
  }

  return { sleepSessions, workoutSessions: [], timeSeries, warnings };
}

function extractRawSessions(data: unknown): EightSleepSession[] {
  if (Array.isArray(data)) {
    return data as EightSleepSession[];
  }

  if (data && typeof data === 'object' && 'sessions' in data) {
    const sessions = (data as { sessions: unknown }).sessions;
    if (Array.isArray(sessions)) {
      return sessions as EightSleepSession[];
    }
  }

  return [];
}

function transformRawSession(
  raw: EightSleepSession,
  sourceId: string,
  userId: string,
  _index: number
): SleepSession | null {
  // Skip sessions with no stages
  if (!raw.stages || raw.stages.length === 0) {
    return null;
  }

  // Calculate stage durations
  const stageTotals = {
    awake: 0,
    light: 0,
    deep: 0,
    rem: 0,
    out: 0,
  };

  for (const stage of raw.stages) {
    if (stage.stage in stageTotals) {
      stageTotals[stage.stage as keyof typeof stageTotals] += stage.duration;
    }
  }

  const sleepSeconds = stageTotals.light + stageTotals.deep + stageTotals.rem;
  const timeInBedSeconds = sleepSeconds + stageTotals.awake;

  // Skip very short sessions (less than 3 hours of actual sleep)
  if (sleepSeconds < 3 * 60 * 60) {
    return null;
  }

  // Calculate timestamps
  const startedAt = new Date(raw.ts * 1000);
  const endedAt = new Date(startedAt.getTime() + timeInBedSeconds * 1000);

  // Use the "night of" date (the date when sleep started)
  // If sleep started after midnight but before 6am, use previous day's date
  const dateObj = new Date(startedAt);
  if (dateObj.getHours() < 6) {
    dateObj.setDate(dateObj.getDate() - 1);
  }
  const date = dateObj.toISOString().split('T')[0];

  // Extract biometrics from timeseries
  const hrValues = extractTimeseriesValues(raw.timeseries?.heartRate);
  const hrvValues = extractTimeseriesValues(raw.timeseries?.hrv);
  const rrValues = extractTimeseriesValues(raw.timeseries?.respiratoryRate);
  const bedTempValues = extractTimeseriesValues(raw.timeseries?.tempBedC);
  const roomTempValues = extractTimeseriesValues(raw.timeseries?.tempRoomC);

  return {
    id: generateId(),
    userId,
    sourceId,
    date,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationSeconds: sleepSeconds,
    timeInBedSeconds,
    deepSeconds: stageTotals.deep,
    remSeconds: stageTotals.rem,
    lightSeconds: stageTotals.light,
    awakeSeconds: stageTotals.awake,
    sleepOnsetLatency: undefined, // Not directly available
    wakeAfterSleepOnset: stageTotals.awake,
    efficiency: timeInBedSeconds > 0 ? (sleepSeconds / timeInBedSeconds) * 100 : undefined,
    avgHeartRate: hrValues.length > 0 ? mean(hrValues) : undefined,
    minHeartRate: hrValues.length > 0 ? Math.min(...hrValues) : undefined,
    maxHeartRate: hrValues.length > 0 ? Math.max(...hrValues) : undefined,
    avgHrv: hrvValues.length > 0 ? mean(hrvValues) : undefined,
    avgRespiratoryRate: rrValues.length > 0 ? mean(rrValues) : undefined,
    avgBedTempC: bedTempValues.length > 0 ? mean(bedTempValues) : undefined,
    avgRoomTempC: roomTempValues.length > 0 ? mean(roomTempValues) : undefined,
    dataQuality: {
      isComplete: true,
      hasOutliers: false,
      outlierFields: [],
      sensorGaps: 0,
      manuallyExcluded: false,
    },
    vendorData: {
      originalTimestamp: raw.ts,
      rawStages: raw.stages,
    },
  };
}

function extractTimeseriesValues(data: Array<[number, number | null]> | undefined): number[] {
  if (!data || !Array.isArray(data)) return [];
  return data
    .filter((point): point is [number, number] =>
      Array.isArray(point) && point.length >= 2 && point[1] !== null
    )
    .map(point => point[1]);
}

function extractTimeSeries(
  raw: EightSleepSession,
  sessionId: string,
  sourceId: string,
  userId: string
): TimeSeries[] {
  const result: TimeSeries[] = [];
  const ts = raw.timeseries;
  if (!ts) return result;

  const startedAt = new Date(raw.ts * 1000).toISOString();

  // Heart Rate
  if (ts.heartRate && ts.heartRate.length > 0) {
    const values = ts.heartRate.map(p => p[1]);
    const gapCount = values.filter(v => v === null).length;

    result.push({
      id: generateId(),
      userId,
      sourceId,
      sessionId,
      metricType: 'heart_rate',
      startedAt,
      intervalSeconds: estimateInterval(ts.heartRate),
      values: values as (number | null)[],
      gapCount,
      interpolatedCount: 0,
    });
  }

  // HRV
  if (ts.hrv && ts.hrv.length > 0) {
    const values = ts.hrv.map(p => p[1]);
    const gapCount = values.filter(v => v === null).length;

    result.push({
      id: generateId(),
      userId,
      sourceId,
      sessionId,
      metricType: 'hrv',
      startedAt,
      intervalSeconds: estimateInterval(ts.hrv),
      values: values as (number | null)[],
      gapCount,
      interpolatedCount: 0,
    });
  }

  // Respiratory Rate
  if (ts.respiratoryRate && ts.respiratoryRate.length > 0) {
    const values = ts.respiratoryRate.map(p => p[1]);
    const gapCount = values.filter(v => v === null).length;

    result.push({
      id: generateId(),
      userId,
      sourceId,
      sessionId,
      metricType: 'respiratory_rate',
      startedAt,
      intervalSeconds: estimateInterval(ts.respiratoryRate),
      values: values as (number | null)[],
      gapCount,
      interpolatedCount: 0,
    });
  }

  // Bed Temperature
  if (ts.tempBedC && ts.tempBedC.length > 0) {
    const values = ts.tempBedC.map(p => p[1]);
    const gapCount = values.filter(v => v === null).length;

    result.push({
      id: generateId(),
      userId,
      sourceId,
      sessionId,
      metricType: 'bed_temperature',
      startedAt,
      intervalSeconds: estimateInterval(ts.tempBedC),
      values: values as (number | null)[],
      gapCount,
      interpolatedCount: 0,
    });
  }

  return result;
}

function estimateInterval(data: Array<[number, unknown]>): number {
  if (data.length < 2) return 300; // Default 5 minutes

  // Calculate median interval from first few points
  const intervals: number[] = [];
  for (let i = 1; i < Math.min(10, data.length); i++) {
    intervals.push(data[i][0] - data[i - 1][0]);
  }

  intervals.sort((a, b) => a - b);
  return intervals[Math.floor(intervals.length / 2)] || 300;
}

// ============================================================
// DASHBOARD FORMAT TRANSFORMER
// ============================================================

interface DashboardData {
  sessions: DashboardSession[];
  baselines?: unknown;
  debtStats?: unknown;
}

function isDashboardFormat(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return 'sessions' in d && 'baselines' in d && 'debtStats' in d;
}

async function transformDashboardFormat(
  data: DashboardData,
  sourceId: string,
  userId: string,
  onProgress?: (processed: number, total: number) => void
): Promise<TransformResult> {
  const warnings: ImportWarning[] = [];
  const sleepSessions: SleepSession[] = [];

  const sessions = data.sessions || [];

  for (let i = 0; i < sessions.length; i++) {
    onProgress?.(i + 1, sessions.length);

    const raw = sessions[i];

    try {
      const session = transformDashboardSession(raw, sourceId, userId);
      sleepSessions.push(session);
    } catch (e) {
      warnings.push({
        type: 'parse_error',
        message: `Failed to parse session ${raw.date}: ${e instanceof Error ? e.message : 'Unknown error'}`,
        recordIndex: i,
      });
    }
  }

  return { sleepSessions, workoutSessions: [], timeSeries: [], warnings };
}

function transformDashboardSession(
  raw: DashboardSession,
  sourceId: string,
  userId: string
): SleepSession {
  const sleepSeconds = raw.sleepHours * 3600;
  const awakeSeconds = raw.awakeMins * 60;
  const totalSleep = sleepSeconds; // sleep only (excluding awake)

  // Calculate stage durations from percentages
  const deepSeconds = (raw.deepPct / 100) * totalSleep;
  const remSeconds = (raw.remPct / 100) * totalSleep;
  const lightSeconds = (raw.lightPct / 100) * totalSleep;

  // Estimate timestamps (we don't have exact times in dashboard format)
  const date = raw.date;
  const startedAt = new Date(`${date}T23:00:00`).toISOString(); // Assume 11pm bedtime
  const endedAt = new Date(new Date(startedAt).getTime() + (sleepSeconds + awakeSeconds) * 1000).toISOString();

  return {
    id: generateId(),
    userId,
    sourceId,
    date,
    startedAt,
    endedAt,
    durationSeconds: sleepSeconds,
    timeInBedSeconds: sleepSeconds + awakeSeconds,
    deepSeconds,
    remSeconds,
    lightSeconds,
    awakeSeconds,
    efficiency: totalSleep > 0 ? (sleepSeconds / (sleepSeconds + awakeSeconds)) * 100 : undefined,
    avgHeartRate: raw.avgHr ?? undefined,
    minHeartRate: raw.minHr ?? undefined,
    avgHrv: raw.avgHrv ?? undefined,
    avgRespiratoryRate: raw.avgRr ?? undefined,
    avgBedTempC: raw.bedTempC ?? undefined,
    avgRoomTempC: raw.roomTempC ?? undefined,
    dataQuality: {
      isComplete: true,
      hasOutliers: false,
      outlierFields: [],
      sensorGaps: 0,
      manuallyExcluded: false,
    },
    vendorData: {
      originalFormat: 'dashboard_data',
      quality: raw.quality,
      dailyDeficit: raw.dailyDeficit,
      debt7Day: raw.debt7Day,
      debt14Day: raw.debt14Day,
      cumulativeDebt: raw.cumulativeDebt,
    },
  };
}

// ============================================================
// UTILITIES
// ============================================================

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
