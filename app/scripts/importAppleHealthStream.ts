/**
 * Apple Health Streaming Import Script
 * =====================================
 * Uses streaming to handle large Apple Health exports (500MB+)
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import type { SleepSession, WorkoutSession, DailyMetric, WorkoutType, DataQualityFlags } from '../src/types/schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLE_HEALTH_EXPORT = path.resolve(__dirname, '../../Peter_Private_Data_Apple/export.xml');
const OUTPUT_JSON = path.resolve(__dirname, '../../apple_health_import.json');

// Types
interface AppleHealthRecord {
  type: string;
  sourceName: string;
  value?: string;
  unit?: string;
  startDate: string;
  endDate: string;
}

interface SleepSegment {
  startDate: string;
  endDate: string;
  value: string;
  sourceName: string;
}

// Counters
const recordCounts = {
  sleep: 0,
  heartRate: 0,
  hrv: 0,
  workouts: 0,
  weight: 0,
  steps: 0,
  other: 0,
};

const sources = new Set<string>();
const sleepSegmentsByDate = new Map<string, SleepSegment[]>();
const heartRateByDate = new Map<string, number[]>();
const hrvByDate = new Map<string, number[]>();
const workoutSessions: WorkoutSession[] = [];
const dailyMetrics: DailyMetric[] = [];

// Parse XML attributes from a string like: type="foo" value="bar"
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

// Parse Apple's date format: "2024-01-15 08:30:00 -0800"
function parseAppleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const normalized = dateStr.replace(' ', 'T').replace(' ', '');
    return new Date(normalized);
  } catch {
    return null;
  }
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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

// Process a Record element
function processRecord(attrs: Record<string, string>) {
  const type = attrs.type;
  const sourceName = attrs.sourceName || 'Unknown';
  sources.add(sourceName);

  switch (type) {
    case 'HKCategoryTypeIdentifierSleepAnalysis':
      recordCounts.sleep++;
      const date = attrs.startDate?.split(' ')[0];
      if (date) {
        if (!sleepSegmentsByDate.has(date)) {
          sleepSegmentsByDate.set(date, []);
        }
        sleepSegmentsByDate.get(date)!.push({
          startDate: attrs.startDate,
          endDate: attrs.endDate,
          value: attrs.value,
          sourceName,
        });
      }
      break;

    case 'HKQuantityTypeIdentifierHeartRate':
      recordCounts.heartRate++;
      if (attrs.value) {
        const hrDate = attrs.startDate?.split(' ')[0];
        if (hrDate) {
          if (!heartRateByDate.has(hrDate)) {
            heartRateByDate.set(hrDate, []);
          }
          heartRateByDate.get(hrDate)!.push(parseFloat(attrs.value));
        }
      }
      break;

    case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN':
      recordCounts.hrv++;
      if (attrs.value) {
        const hrvDate = attrs.startDate?.split(' ')[0];
        if (hrvDate) {
          if (!hrvByDate.has(hrvDate)) {
            hrvByDate.set(hrvDate, []);
          }
          hrvByDate.get(hrvDate)!.push(parseFloat(attrs.value));
        }
      }
      break;

    case 'HKQuantityTypeIdentifierBodyMass':
      recordCounts.weight++;
      if (attrs.value) {
        dailyMetrics.push({
          id: generateId(),
          userId: 'local-user',
          sourceId: 'apple_health',
          date: attrs.startDate?.split(' ')[0],
          metricType: 'weight',
          value: parseFloat(attrs.value),
          unit: attrs.unit || 'lb',
          dataQuality: defaultQualityFlags(),
        });
      }
      break;

    case 'HKQuantityTypeIdentifierStepCount':
      recordCounts.steps++;
      break;

    default:
      recordCounts.other++;
  }
}

// Process a Workout element
function processWorkout(attrString: string, workoutXml: string) {
  const attrs = parseAttributes(attrString);
  recordCounts.workouts++;
  sources.add(attrs.sourceName || 'Unknown');

  const startDate = parseAppleDate(attrs.startDate);
  if (!startDate) return;

  const durationUnit = attrs.durationUnit || 'min';
  const duration = parseFloat(attrs.duration) || 0;
  const durationSeconds = durationUnit === 'min' ? duration * 60 : duration;

  if (durationSeconds < 300) return; // Skip workouts < 5 min

  // Parse workout statistics
  const statsRegex = /<WorkoutStatistics\s+([^>]+)\/>/g;
  let statsMatch;
  let avgHR: number | undefined;
  let maxHR: number | undefined;

  while ((statsMatch = statsRegex.exec(workoutXml)) !== null) {
    const stat = parseAttributes(statsMatch[1]);
    if (stat.type === 'HKQuantityTypeIdentifierHeartRate') {
      avgHR = stat.average ? parseFloat(stat.average) : undefined;
      maxHR = stat.maximum ? parseFloat(stat.maximum) : undefined;
    }
  }

  const workoutType = mapWorkoutType(attrs.workoutActivityType);

  workoutSessions.push({
    id: generateId(),
    userId: 'local-user',
    sourceId: 'apple_health',
    date: startDate.toISOString().split('T')[0],
    startedAt: startDate.toISOString(),
    endedAt: attrs.endDate ? parseAppleDate(attrs.endDate)?.toISOString() : undefined,
    durationSeconds,
    workoutType,
    workoutSubtype: cleanWorkoutType(attrs.workoutActivityType),
    calories: attrs.totalEnergyBurned ? parseFloat(attrs.totalEnergyBurned) : undefined,
    avgHeartRate: avgHR,
    maxHeartRate: maxHR,
    distance: attrs.totalDistance ? parseFloat(attrs.totalDistance) : undefined,
    distanceUnit: mapDistanceUnit(attrs.totalDistanceUnit),
    dataQuality: defaultQualityFlags(),
    vendorData: { source: attrs.sourceName },
  });
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
  };
  return mapping[appleType] || 'other';
}

function cleanWorkoutType(appleType: string): string {
  return (appleType || '')
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

// Build sleep sessions from segments
function buildSleepSessions(): SleepSession[] {
  const sessions: SleepSession[] = [];
  const processedDates = new Set<string>();

  for (const [date, segments] of sleepSegmentsByDate) {
    if (processedDates.has(date)) continue;

    // Sort by start time
    segments.sort((a, b) => a.startDate.localeCompare(b.startDate));

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

    if (!earliestStart || !latestEnd) continue;

    const durationSeconds = deepSeconds + remSeconds + lightSeconds;
    const timeInBedSeconds = inBedSeconds > 0
      ? inBedSeconds
      : (latestEnd.getTime() - earliestStart.getTime()) / 1000;

    if (durationSeconds < 1800) continue; // Skip < 30min

    // Get HR and HRV data
    const hrData = heartRateByDate.get(date);
    const hrvData = hrvByDate.get(date);

    const session: SleepSession = {
      id: generateId(),
      userId: 'local-user',
      sourceId: 'apple_health',
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
      vendorData: { source: segments[0]?.sourceName, segmentCount: segments.length },
    };

    if (hrData && hrData.length > 0) {
      session.minHeartRate = Math.min(...hrData);
      session.avgHeartRate = hrData.reduce((a, b) => a + b, 0) / hrData.length;
      session.maxHeartRate = Math.max(...hrData);
    }

    if (hrvData && hrvData.length > 0) {
      session.avgHrv = hrvData.reduce((a, b) => a + b, 0) / hrvData.length;
    }

    sessions.push(session);
    processedDates.add(date);
  }

  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

async function main() {
  console.log('='.repeat(60));
  console.log('Apple Health Streaming Import');
  console.log('='.repeat(60));

  const stats = fs.statSync(APPLE_HEALTH_EXPORT);
  console.log(`\nFile: ${APPLE_HEALTH_EXPORT}`);
  console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB\n`);

  const startTime = Date.now();
  let bytesProcessed = 0;

  const fileStream = fs.createReadStream(APPLE_HEALTH_EXPORT, {
    encoding: 'utf8',
    highWaterMark: 64 * 1024 // 64KB chunks
  });

  // Accumulate chunks to find complete elements
  let buffer = '';
  let chunkCount = 0;

  for await (const chunk of fileStream) {
    chunkCount++;
    bytesProcessed += chunk.length;
    buffer += chunk;

    if (chunkCount % 500 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const pct = ((bytesProcessed / stats.size) * 100).toFixed(1);
      process.stdout.write(`\r[${elapsed.toFixed(0)}s] ${pct}% processed (${(bytesProcessed / 1024 / 1024).toFixed(0)}MB)...`);
    }

    // Process complete Record elements
    // Match both self-closing and regular Record tags
    const recordRegex = /<Record\s+([^>]+?)(?:\/>|>[\s\S]*?<\/Record>)/g;
    let match;
    let lastMatchEnd = 0;

    while ((match = recordRegex.exec(buffer)) !== null) {
      const attrs = parseAttributes(match[1]);
      processRecord(attrs);
      lastMatchEnd = match.index + match[0].length;
    }

    // Process complete Workout elements
    const workoutRegex = /<Workout\s+([^>]+?)(?:>[\s\S]*?<\/Workout>|\/>)/g;
    while ((match = workoutRegex.exec(buffer)) !== null) {
      processWorkout(match[1], match[0]);
      if (match.index + match[0].length > lastMatchEnd) {
        lastMatchEnd = match.index + match[0].length;
      }
    }

    // Keep unprocessed tail (might have incomplete elements)
    // Find the last complete element end or keep last 50KB as safety buffer
    const safePoint = Math.max(lastMatchEnd, buffer.length - 50000);
    buffer = buffer.slice(safePoint);
  }

  // Process any remaining complete elements in buffer
  const recordRegex = /<Record\s+([^>]+?)(?:\/>|>[\s\S]*?<\/Record>)/g;
  let match;
  while ((match = recordRegex.exec(buffer)) !== null) {
    const attrs = parseAttributes(match[1]);
    processRecord(attrs);
  }
  const workoutRegex = /<Workout\s+([^>]+?)(?:>[\s\S]*?<\/Workout>|\/>)/g;
  while ((match = workoutRegex.exec(buffer)) !== null) {
    processWorkout(match[1], match[0]);
  }

  console.log(`\n\nProcessing complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`Total bytes: ${bytesProcessed.toLocaleString()}\n`);

  // Build sleep sessions
  console.log('Building sleep sessions from segments...');
  const sleepSessions = buildSleepSessions();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));

  console.log(`\nData Sources Found: ${sources.size}`);
  for (const source of sources) {
    console.log(`  - ${source}`);
  }

  console.log('\nRaw Record Counts:');
  console.log(`  Sleep Records:     ${recordCounts.sleep.toLocaleString()}`);
  console.log(`  Heart Rate:        ${recordCounts.heartRate.toLocaleString()}`);
  console.log(`  HRV:               ${recordCounts.hrv.toLocaleString()}`);
  console.log(`  Workouts:          ${recordCounts.workouts.toLocaleString()}`);
  console.log(`  Weight:            ${recordCounts.weight.toLocaleString()}`);
  console.log(`  Steps:             ${recordCounts.steps.toLocaleString()}`);
  console.log(`  Other:             ${recordCounts.other.toLocaleString()}`);

  console.log('\nTransformed Data:');
  console.log(`  Sleep Sessions:    ${sleepSessions.length}`);
  console.log(`  Workout Sessions:  ${workoutSessions.length}`);
  console.log(`  Daily Metrics:     ${dailyMetrics.length}`);

  // Sample data
  if (sleepSessions.length > 0) {
    const sample = sleepSessions[sleepSessions.length - 1]; // Most recent
    console.log('\nMost Recent Sleep Session:');
    console.log(`  Date: ${sample.date}`);
    console.log(`  Duration: ${(sample.durationSeconds / 3600).toFixed(1)}h`);
    console.log(`  Deep: ${sample.deepSeconds ? (sample.deepSeconds / 60).toFixed(0) : 'N/A'}min`);
    console.log(`  REM: ${sample.remSeconds ? (sample.remSeconds / 60).toFixed(0) : 'N/A'}min`);
    console.log(`  Avg HR: ${sample.avgHeartRate?.toFixed(0) || 'N/A'} bpm`);
    console.log(`  Avg HRV: ${sample.avgHrv?.toFixed(0) || 'N/A'} ms`);
  }

  if (workoutSessions.length > 0) {
    console.log('\nWorkout Types:');
    const types = new Map<string, number>();
    for (const w of workoutSessions) {
      const t = w.workoutSubtype || w.workoutType;
      types.set(t, (types.get(t) || 0) + 1);
    }
    for (const [type, count] of [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`  ${type}: ${count}`);
    }
  }

  // Save output
  console.log(`\nSaving to: ${OUTPUT_JSON}`);
  const output = {
    sourceId: 'apple_health_import_' + Date.now(),
    userId: 'local-user',
    importedAt: new Date().toISOString(),
    sources: [...sources],
    recordCounts,
    sleepSessions,
    workoutSessions,
    dailyMetrics,
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
  console.log('Done!\n');
}

main().catch(console.error);
