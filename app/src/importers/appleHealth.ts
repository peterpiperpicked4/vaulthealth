/**
 * Apple Health Importer
 * ======================
 * Parses Apple Health export.xml files.
 *
 * Apple Health exports contain data from multiple sources:
 * - Sleep data (Apple Watch, Eight Sleep, Oura, etc.)
 * - Heart rate (Apple Watch, Peloton, Oura, etc.)
 * - Workouts (Apple Watch, Peloton, Orangetheory, etc.)
 * - Body measurements, steps, etc.
 *
 * The XML can be very large (500MB+), so we use streaming parsing.
 */

import type {
  SleepSession,
  WorkoutSession,
  DailyMetric,
  DataQualityFlags,
  WorkoutType,
  ImporterProfile,
} from '../types/schema';
import { generateId } from '../utils/crypto';

// ============================================================
// TYPES
// ============================================================

export interface AppleHealthRecord {
  type: string;
  sourceName: string;
  sourceVersion?: string;
  unit?: string;
  value?: string;
  startDate: string;
  endDate: string;
  creationDate?: string;
}

export interface AppleHealthWorkout {
  workoutActivityType: string;
  duration: number;
  durationUnit: string;
  totalEnergyBurned?: number;
  totalEnergyBurnedUnit?: string;
  totalDistance?: number;
  totalDistanceUnit?: string;
  sourceName: string;
  startDate: string;
  endDate: string;
  statistics?: WorkoutStatistic[];
}

export interface WorkoutStatistic {
  type: string;
  average?: number;
  minimum?: number;
  maximum?: number;
  sum?: number;
  unit?: string;
}

export interface AppleHealthImportResult {
  sleepSessions: SleepSession[];
  workoutSessions: WorkoutSession[];
  dailyMetrics: DailyMetric[];
  sources: Set<string>;
  recordCounts: {
    sleep: number;
    heartRate: number;
    hrv: number;
    workouts: number;
    weight: number;
    steps: number;
    other: number;
  };
}

// ============================================================
// PROFILE
// ============================================================

export const APPLE_HEALTH_PROFILE: ImporterProfile = {
  id: 'apple_health_builtin',
  vendor: 'apple_health',
  name: 'Apple Health Export',
  description: 'Import data from Apple Health export.xml',
  version: '1.0',
  createdAt: new Date().toISOString(),
  isBuiltIn: true,
  filePatterns: [{
    fileType: 'xml',
    fileNamePattern: 'export\\.xml$',
  }],
  mappings: [],
};

// ============================================================
// MAIN PARSER
// ============================================================

export async function parseAppleHealthXML(
  xmlContent: string,
  sourceId: string,
  userId: string,
  onProgress?: (percent: number, message: string) => void
): Promise<AppleHealthImportResult> {
  onProgress?.(5, 'Parsing Apple Health data...');

  const result: AppleHealthImportResult = {
    sleepSessions: [],
    workoutSessions: [],
    dailyMetrics: [],
    sources: new Set(),
    recordCounts: {
      sleep: 0,
      heartRate: 0,
      hrv: 0,
      workouts: 0,
      weight: 0,
      steps: 0,
      other: 0,
    },
  };

  // Parse records using regex (faster than DOM parsing for large files)
  const recordRegex = /<Record\s+([^>]+)\/?>|<Record\s+([^>]+)>[\s\S]*?<\/Record>/g;
  const workoutRegex = /<Workout\s+([^>]+)>[\s\S]*?<\/Workout>|<Workout\s+([^>]+)\/>/g;

  // Collect sleep segments by date and source
  const sleepSegments: Map<string, AppleHealthRecord[]> = new Map();
  const heartRateBySession: Map<string, number[]> = new Map();
  const hrvByDate: Map<string, number[]> = new Map();

  let match;
  let recordCount = 0;
  const totalSize = xmlContent.length;

  // Parse Records
  onProgress?.(10, 'Extracting health records...');
  while ((match = recordRegex.exec(xmlContent)) !== null) {
    recordCount++;
    if (recordCount % 50000 === 0) {
      const percent = 10 + (match.index / totalSize) * 40;
      onProgress?.(percent, `Processing record ${recordCount.toLocaleString()}...`);
    }

    const attrString = match[1] || match[2];
    const record = parseAttributes(attrString) as unknown as AppleHealthRecord;

    if (!record.type || !record.startDate) continue;

    result.sources.add(record.sourceName || 'Unknown');

    switch (record.type) {
      case 'HKCategoryTypeIdentifierSleepAnalysis':
        result.recordCounts.sleep++;
        const sleepDate = record.startDate.split(' ')[0];
        const key = `${sleepDate}_${record.sourceName}`;
        if (!sleepSegments.has(key)) {
          sleepSegments.set(key, []);
        }
        sleepSegments.get(key)!.push(record);
        break;

      case 'HKQuantityTypeIdentifierHeartRate':
        result.recordCounts.heartRate++;
        // Associate with sleep session by date
        const hrDate = record.startDate.split(' ')[0];
        if (!heartRateBySession.has(hrDate)) {
          heartRateBySession.set(hrDate, []);
        }
        if (record.value) {
          heartRateBySession.get(hrDate)!.push(parseFloat(record.value));
        }
        break;

      case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN':
        result.recordCounts.hrv++;
        const hrvDate = record.startDate.split(' ')[0];
        if (!hrvByDate.has(hrvDate)) {
          hrvByDate.set(hrvDate, []);
        }
        if (record.value) {
          hrvByDate.get(hrvDate)!.push(parseFloat(record.value));
        }
        break;

      case 'HKQuantityTypeIdentifierBodyMass':
        result.recordCounts.weight++;
        if (record.value) {
          result.dailyMetrics.push({
            id: generateId(),
            userId,
            sourceId,
            date: record.startDate.split(' ')[0],
            metricType: 'weight',
            value: parseFloat(record.value),
            unit: record.unit || 'lb',
            dataQuality: defaultQualityFlags(),
          });
        }
        break;

      case 'HKQuantityTypeIdentifierStepCount':
        result.recordCounts.steps++;
        break;

      default:
        result.recordCounts.other++;
    }
  }

  // Parse Workouts
  onProgress?.(55, 'Extracting workouts...');
  while ((match = workoutRegex.exec(xmlContent)) !== null) {
    const attrString = match[1] || match[2];
    const workout = parseWorkoutAttributes(attrString);

    if (!workout.workoutActivityType || !workout.startDate) continue;

    result.recordCounts.workouts++;
    result.sources.add(workout.sourceName || 'Unknown');

    // Parse workout statistics if present
    const workoutXml = match[0];
    const statsRegex = /<WorkoutStatistics\s+([^>]+)\/>/g;
    let statsMatch;
    const statistics: WorkoutStatistic[] = [];
    while ((statsMatch = statsRegex.exec(workoutXml)) !== null) {
      const stat = parseAttributes(statsMatch[1]);
      statistics.push({
        type: stat.type,
        average: stat.average ? parseFloat(stat.average) : undefined,
        minimum: stat.minimum ? parseFloat(stat.minimum) : undefined,
        maximum: stat.maximum ? parseFloat(stat.maximum) : undefined,
        sum: stat.sum ? parseFloat(stat.sum) : undefined,
        unit: stat.unit,
      });
    }

    const workoutSession = transformWorkout(workout, statistics, sourceId, userId);
    if (workoutSession) {
      result.workoutSessions.push(workoutSession);
    }
  }

  // Transform sleep segments into sessions
  onProgress?.(70, 'Building sleep sessions...');
  const processedDates = new Set<string>();

  for (const [key, segments] of sleepSegments) {
    const [date, source] = key.split('_');

    // Skip if we already have a session for this date from a better source
    if (processedDates.has(date)) continue;

    const session = transformSleepSegments(segments, date, source, sourceId, userId);
    if (session) {
      // Add HR and HRV data if available
      const hrData = heartRateBySession.get(date);
      if (hrData && hrData.length > 0) {
        session.minHeartRate = Math.min(...hrData);
        session.avgHeartRate = hrData.reduce((a, b) => a + b, 0) / hrData.length;
        session.maxHeartRate = Math.max(...hrData);
      }

      const hrvData = hrvByDate.get(date);
      if (hrvData && hrvData.length > 0) {
        session.avgHrv = hrvData.reduce((a, b) => a + b, 0) / hrvData.length;
      }

      result.sleepSessions.push(session);
      processedDates.add(date);
    }
  }

  // Sort sessions by date
  result.sleepSessions.sort((a, b) => a.date.localeCompare(b.date));
  result.workoutSessions.sort((a, b) => a.date.localeCompare(b.date));

  onProgress?.(100, 'Import complete!');

  return result;
}

// ============================================================
// ATTRIBUTE PARSING
// ============================================================

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function parseWorkoutAttributes(attrString: string): AppleHealthWorkout {
  const attrs = parseAttributes(attrString);
  return {
    workoutActivityType: attrs.workoutActivityType,
    duration: parseFloat(attrs.duration) || 0,
    durationUnit: attrs.durationUnit || 'min',
    totalEnergyBurned: attrs.totalEnergyBurned ? parseFloat(attrs.totalEnergyBurned) : undefined,
    totalEnergyBurnedUnit: attrs.totalEnergyBurnedUnit,
    totalDistance: attrs.totalDistance ? parseFloat(attrs.totalDistance) : undefined,
    totalDistanceUnit: attrs.totalDistanceUnit,
    sourceName: attrs.sourceName,
    startDate: attrs.startDate,
    endDate: attrs.endDate,
  };
}

// ============================================================
// TRANSFORMERS
// ============================================================

function transformSleepSegments(
  segments: AppleHealthRecord[],
  date: string,
  source: string,
  sourceId: string,
  userId: string
): SleepSession | null {
  if (segments.length === 0) return null;

  // Sort segments by start time
  segments.sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Calculate stage durations
  let deepSeconds = 0;
  let remSeconds = 0;
  let lightSeconds = 0;
  let awakeSeconds = 0;
  let inBedSeconds = 0;

  let earliestStart: Date | null = null;
  let latestEnd: Date | null = null;

  for (const seg of segments) {
    const start = parseAppleDate(seg.startDate);
    const end = parseAppleDate(seg.endDate);
    if (!start || !end) continue;

    const durationSec = (end.getTime() - start.getTime()) / 1000;

    if (!earliestStart || start < earliestStart) earliestStart = start;
    if (!latestEnd || end > latestEnd) latestEnd = end;

    switch (seg.value) {
      case 'HKCategoryValueSleepAnalysisAsleepDeep':
        deepSeconds += durationSec;
        break;
      case 'HKCategoryValueSleepAnalysisAsleepREM':
        remSeconds += durationSec;
        break;
      case 'HKCategoryValueSleepAnalysisAsleepCore':
      case 'HKCategoryValueSleepAnalysisAsleep':
        lightSeconds += durationSec;
        break;
      case 'HKCategoryValueSleepAnalysisAwake':
        awakeSeconds += durationSec;
        break;
      case 'HKCategoryValueSleepAnalysisInBed':
        inBedSeconds += durationSec;
        break;
    }
  }

  if (!earliestStart || !latestEnd) return null;

  // Total sleep = deep + REM + light
  const durationSeconds = deepSeconds + remSeconds + lightSeconds;

  // Use inBed if available, otherwise calculate from start/end
  const timeInBedSeconds = inBedSeconds > 0
    ? inBedSeconds
    : (latestEnd.getTime() - earliestStart.getTime()) / 1000;

  if (durationSeconds < 1800) return null; // Skip sessions less than 30 min

  return {
    id: generateId(),
    userId,
    sourceId,
    date,
    startedAt: earliestStart.toISOString(),
    endedAt: latestEnd.toISOString(),
    durationSeconds,
    timeInBedSeconds,
    deepSeconds,
    remSeconds,
    lightSeconds,
    awakeSeconds,
    efficiency: timeInBedSeconds > 0 ? (durationSeconds / timeInBedSeconds) * 100 : undefined,
    dataQuality: defaultQualityFlags(),
    vendorData: { source, segmentCount: segments.length },
  };
}

function transformWorkout(
  workout: AppleHealthWorkout,
  statistics: WorkoutStatistic[],
  sourceId: string,
  userId: string
): WorkoutSession | null {
  const startDate = parseAppleDate(workout.startDate);
  if (!startDate) return null;

  const durationSeconds = workout.durationUnit === 'min'
    ? workout.duration * 60
    : workout.duration;

  if (durationSeconds < 300) return null; // Skip workouts less than 5 min

  // Map Apple workout types to our types
  const workoutType = mapWorkoutType(workout.workoutActivityType);

  // Extract HR stats if available
  const hrStat = statistics.find(s => s.type === 'HKQuantityTypeIdentifierHeartRate');

  return {
    id: generateId(),
    userId,
    sourceId,
    date: startDate.toISOString().split('T')[0],
    startedAt: startDate.toISOString(),
    endedAt: workout.endDate ? parseAppleDate(workout.endDate)?.toISOString() : undefined,
    durationSeconds,
    workoutType,
    workoutSubtype: cleanWorkoutType(workout.workoutActivityType),
    calories: workout.totalEnergyBurned,
    avgHeartRate: hrStat?.average,
    maxHeartRate: hrStat?.maximum,
    distance: workout.totalDistance,
    distanceUnit: mapDistanceUnit(workout.totalDistanceUnit),
    dataQuality: defaultQualityFlags(),
    vendorData: { source: workout.sourceName },
  };
}

// ============================================================
// HELPERS
// ============================================================

function parseAppleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Format: "2024-01-15 08:30:00 -0800"
  try {
    // Replace space between date and time with 'T', handle timezone
    const normalized = dateStr.replace(' ', 'T').replace(' ', '');
    return new Date(normalized);
  } catch {
    return null;
  }
}

function mapWorkoutType(appleType: string): WorkoutType {
  const mapping: Record<string, WorkoutType> = {
    'HKWorkoutActivityTypeCycling': 'cycling',
    'HKWorkoutActivityTypeRunning': 'running',
    'HKWorkoutActivityTypeWalking': 'walking',
    'HKWorkoutActivityTypeSwimming': 'swimming',
    'HKWorkoutActivityTypeYoga': 'yoga',
    'HKWorkoutActivityTypeHighIntensityIntervalTraining': 'hiit',
    'HKWorkoutActivityTypeFunctionalStrengthTraining': 'strength',
    'HKWorkoutActivityTypeTraditionalStrengthTraining': 'strength',
    'HKWorkoutActivityTypeCrossTraining': 'hiit',
    'HKWorkoutActivityTypeMixedCardio': 'cardio',
    'HKWorkoutActivityTypeHiking': 'walking',
    'HKWorkoutActivityTypeElliptical': 'cardio',
    'HKWorkoutActivityTypeBarre': 'other',
    'HKWorkoutActivityTypeDance': 'other',
    'HKWorkoutActivityTypePreparationAndRecovery': 'other',
  };
  return mapping[appleType] || 'other';
}

function cleanWorkoutType(appleType: string): string {
  return appleType
    .replace('HKWorkoutActivityType', '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

function mapDistanceUnit(unit?: string): 'meters' | 'miles' | 'kilometers' | undefined {
  if (!unit) return undefined;
  if (unit.toLowerCase().includes('mi')) return 'miles';
  if (unit.toLowerCase().includes('km')) return 'kilometers';
  return 'meters';
}

function defaultQualityFlags(): DataQualityFlags {
  return {
    isComplete: true,
    hasOutliers: false,
    outlierFields: [],
    sensorGaps: 0,
    manuallyExcluded: false,
  };
}

// ============================================================
// DETECTION
// ============================================================

export function isAppleHealthExport(content: string): boolean {
  return content.includes('<!DOCTYPE HealthData') ||
         content.includes('<HealthData') ||
         content.includes('HKQuantityTypeIdentifier');
}
