/**
 * Orangetheory Fitness Importer
 * ==============================
 * Handles imports from Orangetheory DSAR exports or manual CSV exports.
 *
 * Since OTF DSAR format is not standardized, this importer uses a flexible
 * mapping approach that can handle various column name variations.
 *
 * Expected CSV columns (common variants):
 * - Date / Workout Date / Class Date
 * - Class Type / Workout Type
 * - Calories / Calories Burned / Total Calories
 * - Splat Points / Splats
 * - Avg HR / Average Heart Rate / Avg Heart Rate
 * - Max HR / Maximum Heart Rate / Max Heart Rate
 * - Duration / Class Duration / Workout Duration
 * - Zone 1 Mins / Gray Zone / Zone 1
 * - Zone 2 Mins / Blue Zone / Zone 2
 * - Zone 3 Mins / Green Zone / Zone 3
 * - Zone 4 Mins / Orange Zone / Zone 4
 * - Zone 5 Mins / Red Zone / Zone 5
 */

import type {
  ImporterProfile,
  SleepSession,
  WorkoutSession,
  TimeSeries,
  WorkoutType,
} from '../types/schema';
import type { ImportWarning } from './pipeline';
import { generateId } from '../utils/crypto';

// ============================================================
// IMPORTER PROFILE
// ============================================================

export const ORANGETHEORY_PROFILE: ImporterProfile = {
  id: 'orangetheory_v1',
  vendor: 'orangetheory',
  name: 'Orangetheory Fitness Export',
  version: '1.0.0',
  description: 'Import workout data from Orangetheory CSV export or DSAR',
  createdAt: new Date().toISOString(),
  isBuiltIn: true,
  filePatterns: [
    {
      fileType: 'csv',
      csvRequiredHeaders: ['splat'],
    },
    {
      fileType: 'csv',
      fileNamePattern: '(?i)orangetheory|otf',
    },
  ],
  mappings: [
    {
      targetTable: 'workout_sessions',
      sourceType: 'csv',
      fieldMappings: [
        { target: 'date', source: 'date', transform: { type: 'direct' } },
        { target: 'workoutSubtype', source: 'class_type', transform: { type: 'direct' } },
        { target: 'calories', source: 'calories', transform: { type: 'direct' } },
        { target: 'splatPoints', source: 'splat_points', transform: { type: 'direct' } },
        { target: 'avgHeartRate', source: 'avg_hr', transform: { type: 'direct' } },
        { target: 'maxHeartRate', source: 'max_hr', transform: { type: 'direct' } },
      ],
    },
  ],
};

// ============================================================
// COLUMN NAME VARIATIONS
// ============================================================

const COLUMN_ALIASES: Record<string, string[]> = {
  // Date
  date: ['date', 'workout_date', 'class_date', 'workout date', 'class date', 'session_date'],

  // Class type
  class_type: ['class_type', 'class type', 'workout_type', 'workout type', 'type', 'class'],

  // Duration
  duration: ['duration', 'class_duration', 'class duration', 'workout_duration', 'workout duration', 'time', 'total_time'],

  // Calories
  calories: ['calories', 'calories_burned', 'calories burned', 'total_calories', 'total calories', 'cal'],

  // Splat points
  splat_points: ['splat_points', 'splat points', 'splats', 'splat', 'splatpoints'],

  // Heart rate
  avg_hr: ['avg_hr', 'avg hr', 'average_heart_rate', 'average heart rate', 'avg_heart_rate', 'avg heart rate', 'avghr'],
  max_hr: ['max_hr', 'max hr', 'maximum_heart_rate', 'maximum heart rate', 'max_heart_rate', 'max heart rate', 'maxhr'],

  // HR zones
  zone_1: ['zone_1', 'zone 1', 'gray_zone', 'gray zone', 'grey_zone', 'grey zone', 'zone1', 'gray'],
  zone_2: ['zone_2', 'zone 2', 'blue_zone', 'blue zone', 'zone2', 'blue'],
  zone_3: ['zone_3', 'zone 3', 'green_zone', 'green zone', 'zone3', 'green'],
  zone_4: ['zone_4', 'zone 4', 'orange_zone', 'orange zone', 'zone4', 'orange'],
  zone_5: ['zone_5', 'zone 5', 'red_zone', 'red zone', 'zone5', 'red'],

  // Distance
  tread_distance: ['tread_distance', 'tread distance', 'treadmill_distance', 'treadmill distance', 'distance', 'miles'],
  row_distance: ['row_distance', 'row distance', 'rower_distance', 'rower distance', 'row_meters', 'row meters'],
};

// ============================================================
// CSV ROW TYPE
// ============================================================

interface CsvRow {
  [key: string]: string;
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

export async function transformOrangetheory(
  data: unknown,
  sourceId: string,
  userId: string,
  onProgress?: (processed: number, total: number) => void
): Promise<TransformResult> {
  const warnings: ImportWarning[] = [];
  const workoutSessions: WorkoutSession[] = [];

  // Expect CSV data as array of objects
  if (!Array.isArray(data)) {
    warnings.push({
      type: 'parse_error',
      message: 'Expected array of CSV rows',
    });
    return { sleepSessions: [], workoutSessions: [], timeSeries: [], warnings };
  }

  const rows = data as CsvRow[];

  if (rows.length === 0) {
    warnings.push({
      type: 'parse_error',
      message: 'No workout data found in file',
    });
    return { sleepSessions: [], workoutSessions: [], timeSeries: [], warnings };
  }

  // Build column mapping from first row's headers
  const columnMap = buildColumnMap(rows[0]);

  for (let i = 0; i < rows.length; i++) {
    onProgress?.(i + 1, rows.length);

    const row = rows[i];

    try {
      const session = transformOTFRow(row, columnMap, sourceId, userId);
      if (session) {
        workoutSessions.push(session);
      }
    } catch (e) {
      warnings.push({
        type: 'parse_error',
        message: `Failed to parse row ${i + 1}: ${e instanceof Error ? e.message : 'Unknown error'}`,
        recordIndex: i,
      });
    }
  }

  return { sleepSessions: [], workoutSessions, timeSeries: [], warnings };
}

function buildColumnMap(sampleRow: CsvRow): Record<string, string> {
  const map: Record<string, string> = {};
  const headers = Object.keys(sampleRow).map(h => h.toLowerCase().trim());

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const matchingHeader = headers.find(h =>
        h === alias.toLowerCase() ||
        h.includes(alias.toLowerCase())
      );

      if (matchingHeader) {
        // Find the original case header
        const originalHeader = Object.keys(sampleRow).find(
          h => h.toLowerCase().trim() === matchingHeader
        );
        if (originalHeader) {
          map[canonical] = originalHeader;
          break;
        }
      }
    }
  }

  return map;
}

function getField(row: CsvRow, columnMap: Record<string, string>, field: string): string | undefined {
  const column = columnMap[field];
  if (!column) return undefined;
  return row[column]?.trim();
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const num = parseFloat(value.replace(/[^\d.-]/g, ''));
  return isNaN(num) ? undefined : num;
}

function parseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;

  // Try various date formats
  const formats = [
    // ISO
    /^(\d{4})-(\d{2})-(\d{2})/,
    // US format
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})/,
    // European format
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})/,
  ];

  // Try ISO first
  let match = value.match(formats[0]);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }

  // Try US format (MM/DD/YYYY or MM/DD/YY)
  match = value.match(formats[1]) || value.match(formats[2]);
  if (match) {
    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    let year = match[3];
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // Try European format (DD.MM.YYYY)
  match = value.match(formats[3]);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  // Last resort: try native Date parsing
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return undefined;
}

function transformOTFRow(
  row: CsvRow,
  columnMap: Record<string, string>,
  sourceId: string,
  userId: string
): WorkoutSession | null {
  // Parse date (required)
  const dateStr = parseDate(getField(row, columnMap, 'date'));
  if (!dateStr) {
    return null;
  }

  // Parse duration
  const durationRaw = getField(row, columnMap, 'duration');
  let durationSeconds = 3600; // Default 60 minutes

  if (durationRaw) {
    const durationNum = parseNumber(durationRaw);
    if (durationNum) {
      // Could be minutes (e.g., 60) or a string like "60 mins"
      durationSeconds = durationNum * 60;
    }
  }

  // Parse class type
  const classType = getField(row, columnMap, 'class_type') || 'Orange 60';

  // Determine workout type from class name
  let workoutType: WorkoutType = 'hiit';
  const classLower = classType.toLowerCase();
  if (classLower.includes('lift') || classLower.includes('strength')) {
    workoutType = 'strength';
  } else if (classLower.includes('run') || classLower.includes('tread')) {
    workoutType = 'running';
  } else if (classLower.includes('row')) {
    workoutType = 'cardio';
  }

  // Parse heart rate zones
  const zone1 = parseNumber(getField(row, columnMap, 'zone_1'));
  const zone2 = parseNumber(getField(row, columnMap, 'zone_2'));
  const zone3 = parseNumber(getField(row, columnMap, 'zone_3'));
  const zone4 = parseNumber(getField(row, columnMap, 'zone_4'));
  const zone5 = parseNumber(getField(row, columnMap, 'zone_5'));

  // Estimate started_at (we don't have exact time, assume morning)
  const startedAt = new Date(`${dateStr}T09:00:00`).toISOString();

  return {
    id: generateId(),
    userId,
    sourceId,
    date: dateStr,
    startedAt,
    endedAt: new Date(new Date(startedAt).getTime() + durationSeconds * 1000).toISOString(),
    durationSeconds,
    workoutType,
    workoutSubtype: classType,
    calories: parseNumber(getField(row, columnMap, 'calories')),
    avgHeartRate: parseNumber(getField(row, columnMap, 'avg_hr')),
    maxHeartRate: parseNumber(getField(row, columnMap, 'max_hr')),
    splatPoints: parseNumber(getField(row, columnMap, 'splat_points')),
    zone1Minutes: zone1,
    zone2Minutes: zone2,
    zone3Minutes: zone3,
    zone4Minutes: zone4,
    zone5Minutes: zone5,
    distance: parseNumber(getField(row, columnMap, 'tread_distance')),
    distanceUnit: 'miles', // OTF uses miles for treadmill
    dataQuality: {
      isComplete: true,
      hasOutliers: false,
      outlierFields: [],
      sensorGaps: 0,
      manuallyExcluded: false,
    },
    vendorData: {
      originalRow: row,
      rowDistance: parseNumber(getField(row, columnMap, 'row_distance')),
    },
  };
}

// ============================================================
// USER MAPPING CONFIGURATION
// ============================================================

/**
 * Generate a mapping configuration UI needs
 * This returns the detected columns and suggested mappings
 */
export function analyzeOTFColumns(headers: string[]): {
  detectedMappings: Record<string, string>;
  unmappedHeaders: string[];
  suggestions: Array<{
    header: string;
    suggestedField: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
} {
  const columnMap = buildColumnMap(
    Object.fromEntries(headers.map(h => [h, '']))
  );

  const detectedMappings: Record<string, string> = {};
  const unmappedHeaders: string[] = [];
  const suggestions: Array<{
    header: string;
    suggestedField: string;
    confidence: 'high' | 'medium' | 'low';
  }> = [];

  const mappedColumns = new Set(Object.values(columnMap));

  for (const header of headers) {
    if (mappedColumns.has(header)) {
      const field = Object.entries(columnMap).find(([, col]) => col === header)?.[0];
      if (field) {
        detectedMappings[header] = field;
      }
    } else {
      unmappedHeaders.push(header);

      // Try to suggest based on partial matches
      const headerLower = header.toLowerCase();
      for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
        for (const alias of aliases) {
          if (headerLower.includes(alias) || alias.includes(headerLower)) {
            suggestions.push({
              header,
              suggestedField: canonical,
              confidence: headerLower === alias ? 'high' : 'medium',
            });
            break;
          }
        }
      }
    }
  }

  return { detectedMappings, unmappedHeaders, suggestions };
}
