/**
 * Generic Importer
 * =================
 * Handles imports using user-defined mapping configurations.
 * Used when no built-in importer matches the file format.
 */

import type {
  ImporterProfile,
  SleepSession,
  WorkoutSession,
  TimeSeries,
  FieldMapping,
  FieldTransform,
} from '../types/schema';
import type { ImportWarning } from './pipeline';
import { generateId } from '../utils/crypto';

// ============================================================
// TYPES
// ============================================================

interface TransformResult {
  sleepSessions: SleepSession[];
  workoutSessions: WorkoutSession[];
  timeSeries: TimeSeries[];
  warnings: ImportWarning[];
}

interface GenericRow {
  [key: string]: unknown;
}

// ============================================================
// TRANSFORMER
// ============================================================

export async function transformGeneric(
  data: unknown,
  profile: ImporterProfile,
  sourceId: string,
  userId: string,
  onProgress?: (processed: number, total: number) => void
): Promise<TransformResult> {
  const warnings: ImportWarning[] = [];
  const sleepSessions: SleepSession[] = [];
  const workoutSessions: WorkoutSession[] = [];
  const timeSeries: TimeSeries[] = [];

  for (const mapping of profile.mappings) {
    // Extract source data
    let sourceData: GenericRow[] = [];

    if (mapping.sourceType === 'json') {
      sourceData = extractJsonData(data, mapping.sourcePath);
    } else if (mapping.sourceType === 'csv' && Array.isArray(data)) {
      sourceData = data as GenericRow[];
    }

    if (sourceData.length === 0) {
      warnings.push({
        type: 'parse_error',
        message: `No data found at path: ${mapping.sourcePath || 'root'}`,
      });
      continue;
    }

    // Transform each row
    for (let i = 0; i < sourceData.length; i++) {
      onProgress?.(i + 1, sourceData.length);

      try {
        const row = sourceData[i];
        const transformed = transformRow(row, mapping.fieldMappings, sourceId, userId);

        // Apply filter if specified
        if (mapping.filter && !evaluateFilter(row, mapping.filter)) {
          continue;
        }

        switch (mapping.targetTable) {
          case 'sleep_sessions':
            sleepSessions.push(createSleepSession(transformed, sourceId, userId));
            break;
          case 'workout_sessions':
            workoutSessions.push(createWorkoutSession(transformed, sourceId, userId));
            break;
          // Add other table types as needed
        }
      } catch (e) {
        warnings.push({
          type: 'parse_error',
          message: `Failed to transform row ${i}: ${e instanceof Error ? e.message : 'Unknown error'}`,
          recordIndex: i,
        });
      }
    }
  }

  return { sleepSessions, workoutSessions, timeSeries, warnings };
}

// ============================================================
// JSON DATA EXTRACTION
// ============================================================

function extractJsonData(data: unknown, path?: string): GenericRow[] {
  if (!path || path === '$') {
    if (Array.isArray(data)) return data as GenericRow[];
    return [data as GenericRow];
  }

  // Simple JSONPath implementation
  const segments = path
    .replace(/^\$\.?/, '')
    .split(/\.|\[(\d+|\*)\]/)
    .filter(Boolean);

  let current: unknown = data;

  for (const segment of segments) {
    if (current === null || current === undefined) return [];

    if (segment === '*') {
      // Wildcard - expect array
      if (!Array.isArray(current)) return [];
      return current as GenericRow[];
    }

    if (/^\d+$/.test(segment)) {
      // Array index
      if (!Array.isArray(current)) return [];
      current = current[parseInt(segment)];
    } else {
      // Object property
      if (typeof current !== 'object' || current === null) return [];
      current = (current as Record<string, unknown>)[segment];
    }
  }

  if (Array.isArray(current)) return current as GenericRow[];
  if (current !== null && typeof current === 'object') return [current as GenericRow];
  return [];
}

// ============================================================
// ROW TRANSFORMATION
// ============================================================

function transformRow(
  row: GenericRow,
  mappings: FieldMapping[],
  _sourceId: string,
  _userId: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const mapping of mappings) {
    try {
      let value = extractValue(row, mapping.source);

      if (value === undefined || value === null) {
        if (mapping.required) {
          throw new Error(`Required field missing: ${mapping.source}`);
        }
        if (mapping.defaultValue !== undefined) {
          value = mapping.defaultValue;
        }
        continue;
      }

      if (mapping.transform) {
        value = applyTransform(value, mapping.transform, row);
      }

      result[mapping.target] = value;
    } catch (e) {
      // Skip this field but continue processing
      console.warn(`Failed to map field ${mapping.source}: ${e}`);
    }
  }

  return result;
}

function extractValue(row: GenericRow, source: string): unknown {
  // Handle literal strings (wrapped in quotes)
  if (source.startsWith("'") && source.endsWith("'")) {
    return source.slice(1, -1);
  }

  // Handle simple field access
  if (!source.includes('.') && !source.includes('[')) {
    return row[source];
  }

  // Handle nested path (simple dot notation)
  const segments = source.split('.');
  let current: unknown = row;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;

    // Handle array access like "stages[0]"
    const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, prop, index] = arrayMatch;
      current = (current as Record<string, unknown>)[prop];
      if (Array.isArray(current)) {
        current = current[parseInt(index)];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current;
}

// ============================================================
// VALUE TRANSFORMS
// ============================================================

function applyTransform(value: unknown, transform: FieldTransform, row: GenericRow): unknown {
  switch (transform.type) {
    case 'direct':
      return value;

    case 'timestamp':
      return transformTimestamp(value, transform.format);

    case 'duration':
      return transformDuration(value, transform.fromUnit, transform.toUnit);

    case 'multiply':
      return typeof value === 'number' ? value * transform.factor : value;

    case 'divide':
      return typeof value === 'number' ? value / transform.divisor : value;

    case 'map':
      return transform.mapping[String(value)] ?? value;

    case 'regex':
      if (typeof value !== 'string') return value;
      const match = value.match(new RegExp(transform.pattern));
      return match?.[transform.group] ?? value;

    case 'jsonpath':
      return extractValue(row, transform.path);

    case 'compute':
      return evaluateFormula(transform.formula, row);

    case 'coalesce':
      for (const source of transform.sources) {
        const v = extractValue(row, source);
        if (v !== undefined && v !== null) return v;
      }
      return undefined;

    default:
      return value;
  }
}

function transformTimestamp(value: unknown, format: string): string {
  if (typeof value === 'number') {
    if (format === 'unix_seconds') {
      return new Date(value * 1000).toISOString();
    }
    if (format === 'unix_millis') {
      return new Date(value).toISOString();
    }
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return String(value);
}

function transformDuration(value: unknown, fromUnit: string, toUnit: string): number {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return 0;

  // Convert to seconds first
  let seconds: number;
  switch (fromUnit) {
    case 'hours':
      seconds = numValue * 3600;
      break;
    case 'minutes':
      seconds = numValue * 60;
      break;
    case 'seconds':
    default:
      seconds = numValue;
  }

  // Convert from seconds to target unit
  switch (toUnit) {
    case 'hours':
      return seconds / 3600;
    case 'minutes':
      return seconds / 60;
    case 'seconds':
    default:
      return seconds;
  }
}

// ============================================================
// FORMULA EVALUATION (simplified)
// ============================================================

function evaluateFormula(formula: string, row: GenericRow): unknown {
  // Handle sum(array[*].field)
  const sumMatch = formula.match(/^sum\((\w+)\[\*\]\.(\w+)\)$/);
  if (sumMatch) {
    const [, arrayField, valueField] = sumMatch;
    const array = row[arrayField];
    if (Array.isArray(array)) {
      return array.reduce((sum, item) => {
        const val = (item as Record<string, unknown>)[valueField];
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);
    }
    return 0;
  }

  // Handle sum(array[?condition].field)
  const sumFilterMatch = formula.match(/^sum\((\w+)\[\?(\w+)=='(\w+)'\]\.(\w+)\)$/);
  if (sumFilterMatch) {
    const [, arrayField, filterField, filterValue, valueField] = sumFilterMatch;
    const array = row[arrayField];
    if (Array.isArray(array)) {
      return array
        .filter(item => (item as Record<string, unknown>)[filterField] === filterValue)
        .reduce((sum, item) => {
          const val = (item as Record<string, unknown>)[valueField];
          return sum + (typeof val === 'number' ? val : 0);
        }, 0);
    }
    return 0;
  }

  // Simple arithmetic (field1 + field2, etc.)
  // This is intentionally limited for security
  const arithmeticMatch = formula.match(/^(\w+)\s*([\+\-\*\/])\s*(\w+)$/);
  if (arithmeticMatch) {
    const [, left, op, right] = arithmeticMatch;
    const leftVal = typeof row[left] === 'number' ? row[left] : parseFloat(String(row[left]));
    const rightVal = typeof row[right] === 'number' ? row[right] : parseFloat(String(row[right]));

    if (isNaN(leftVal as number) || isNaN(rightVal as number)) return 0;

    switch (op) {
      case '+': return (leftVal as number) + (rightVal as number);
      case '-': return (leftVal as number) - (rightVal as number);
      case '*': return (leftVal as number) * (rightVal as number);
      case '/': return rightVal !== 0 ? (leftVal as number) / (rightVal as number) : 0;
    }
  }

  return undefined;
}

// ============================================================
// FILTER EVALUATION
// ============================================================

function evaluateFilter(row: GenericRow, filter: string): boolean {
  // Simple equality filter: "field == 'value'"
  const eqMatch = filter.match(/^(\w+)\s*==\s*'(.+)'$/);
  if (eqMatch) {
    const [, field, value] = eqMatch;
    return String(row[field]) === value;
  }

  // Numeric comparison: "field > 100"
  const numMatch = filter.match(/^(\w+)\s*([<>=!]+)\s*(\d+(?:\.\d+)?)$/);
  if (numMatch) {
    const [, field, op, valueStr] = numMatch;
    const fieldVal = typeof row[field] === 'number' ? row[field] : parseFloat(String(row[field]));
    const compareVal = parseFloat(valueStr);

    if (isNaN(fieldVal as number)) return false;

    switch (op) {
      case '>': return (fieldVal as number) > compareVal;
      case '>=': return (fieldVal as number) >= compareVal;
      case '<': return (fieldVal as number) < compareVal;
      case '<=': return (fieldVal as number) <= compareVal;
      case '==': return (fieldVal as number) === compareVal;
      case '!=': return (fieldVal as number) !== compareVal;
    }
  }

  return true;
}

// ============================================================
// RECORD CREATORS
// ============================================================

function createSleepSession(
  data: Record<string, unknown>,
  sourceId: string,
  userId: string
): SleepSession {
  return {
    id: generateId(),
    userId,
    sourceId,
    date: String(data.date || new Date().toISOString().split('T')[0]),
    startedAt: String(data.startedAt || new Date().toISOString()),
    endedAt: String(data.endedAt || new Date().toISOString()),
    durationSeconds: Number(data.durationSeconds || 0),
    timeInBedSeconds: Number(data.timeInBedSeconds || data.durationSeconds || 0),
    deepSeconds: Number(data.deepSeconds || 0),
    remSeconds: Number(data.remSeconds || 0),
    lightSeconds: Number(data.lightSeconds || 0),
    awakeSeconds: Number(data.awakeSeconds || 0),
    avgHeartRate: data.avgHeartRate !== undefined ? Number(data.avgHeartRate) : undefined,
    minHeartRate: data.minHeartRate !== undefined ? Number(data.minHeartRate) : undefined,
    maxHeartRate: data.maxHeartRate !== undefined ? Number(data.maxHeartRate) : undefined,
    avgHrv: data.avgHrv !== undefined ? Number(data.avgHrv) : undefined,
    avgRespiratoryRate: data.avgRespiratoryRate !== undefined ? Number(data.avgRespiratoryRate) : undefined,
    avgBedTempC: data.avgBedTempC !== undefined ? Number(data.avgBedTempC) : undefined,
    avgRoomTempC: data.avgRoomTempC !== undefined ? Number(data.avgRoomTempC) : undefined,
    dataQuality: {
      isComplete: true,
      hasOutliers: false,
      outlierFields: [],
      sensorGaps: 0,
      manuallyExcluded: false,
    },
    vendorData: data,
  };
}

function createWorkoutSession(
  data: Record<string, unknown>,
  sourceId: string,
  userId: string
): WorkoutSession {
  return {
    id: generateId(),
    userId,
    sourceId,
    date: String(data.date || new Date().toISOString().split('T')[0]),
    startedAt: String(data.startedAt || new Date().toISOString()),
    endedAt: data.endedAt ? String(data.endedAt) : undefined,
    durationSeconds: Number(data.durationSeconds || 0),
    workoutType: (data.workoutType as any) || 'other',
    workoutSubtype: data.workoutSubtype ? String(data.workoutSubtype) : undefined,
    calories: data.calories !== undefined ? Number(data.calories) : undefined,
    avgHeartRate: data.avgHeartRate !== undefined ? Number(data.avgHeartRate) : undefined,
    maxHeartRate: data.maxHeartRate !== undefined ? Number(data.maxHeartRate) : undefined,
    distance: data.distance !== undefined ? Number(data.distance) : undefined,
    splatPoints: data.splatPoints !== undefined ? Number(data.splatPoints) : undefined,
    dataQuality: {
      isComplete: true,
      hasOutliers: false,
      outlierFields: [],
      sensorGaps: 0,
      manuallyExcluded: false,
    },
    vendorData: data,
  };
}
