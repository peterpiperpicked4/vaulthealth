/**
 * VaultHealth Canonical Data Schema
 * ==================================
 * All health data from any source gets normalized to these types.
 * This is the "single source of truth" for the app.
 */

// ============================================================
// CORE ENTITIES
// ============================================================

export interface User {
  id: string;
  createdAt: string; // ISO timestamp
  settings: UserSettings;
}

export interface UserSettings {
  sleepTarget: number; // hours per night
  timezone: string;
  displayUnits: 'metric' | 'imperial';
  outlierThreshold: number; // MAD multiplier for outlier detection
}

export interface Source {
  id: string;
  userId: string;
  vendor: VendorType;
  fileName: string;
  fileHash: string; // SHA-256 of original file
  fileSizeBytes: number;
  importedAt: string; // ISO timestamp
  importerProfileId: string;
  recordCounts: {
    sleepSessions?: number;
    workoutSessions?: number;
    dailyMetrics?: number;
    timeSeries?: number;
  };
  // Raw data stored as blob for re-processing if needed
  rawDataRef?: string; // Key to blob storage
}

export type VendorType =
  | 'eight_sleep'
  | 'oura'
  | 'orangetheory'
  | 'whoop'
  | 'apple_health'
  | 'garmin'
  | 'fitbit'
  | 'generic_csv'
  | 'generic_json'
  | 'unknown';

// ============================================================
// SLEEP DATA
// ============================================================

export interface SleepSession {
  id: string;
  userId: string;
  sourceId: string;

  // Timing
  date: string; // YYYY-MM-DD (the "night of" date)
  startedAt: string; // ISO timestamp (actual sleep start)
  endedAt: string; // ISO timestamp (actual wake)

  // Duration (all in seconds)
  durationSeconds: number; // total time asleep
  timeInBedSeconds: number; // total time in bed
  deepSeconds: number;
  remSeconds: number;
  lightSeconds: number;
  awakeSeconds: number; // time awake after initially falling asleep

  // Efficiency metrics
  sleepOnsetLatency?: number; // seconds to fall asleep
  wakeAfterSleepOnset?: number; // WASO in seconds
  efficiency?: number; // 0-100%

  // Biometrics (averages during sleep)
  avgHeartRate?: number;
  minHeartRate?: number;
  maxHeartRate?: number;
  avgHrv?: number;
  avgRespiratoryRate?: number;

  // Environment
  avgBedTempC?: number;
  avgRoomTempC?: number;

  // Quality flags
  dataQuality: DataQualityFlags;

  // Vendor-specific data we don't canonicalize yet
  vendorData?: Record<string, unknown>;
}

export interface DataQualityFlags {
  isComplete: boolean; // All expected fields present
  hasOutliers: boolean; // Any metric flagged as outlier
  outlierFields: string[]; // Which fields are outliers
  sensorGaps: number; // Number of data gaps detected
  manuallyExcluded: boolean; // User marked as bad data
  exclusionReason?: string;
}

// ============================================================
// WORKOUT DATA
// ============================================================

export interface WorkoutSession {
  id: string;
  userId: string;
  sourceId: string;

  // Timing
  date: string; // YYYY-MM-DD
  startedAt: string; // ISO timestamp
  endedAt?: string; // ISO timestamp
  durationSeconds: number;

  // Classification
  workoutType: WorkoutType;
  workoutSubtype?: string; // e.g., "Orange 60", "Lift 45", "5K Run"

  // Intensity metrics
  calories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgHeartRatePercent?: number; // % of max HR

  // Performance (varies by workout type)
  distance?: number; // meters
  distanceUnit?: 'meters' | 'miles' | 'kilometers';
  pace?: number; // seconds per km or mile
  elevationGain?: number; // meters

  // OTF-specific
  splatPoints?: number;
  zone1Minutes?: number;
  zone2Minutes?: number;
  zone3Minutes?: number;
  zone4Minutes?: number;
  zone5Minutes?: number;

  // Strength-specific
  sets?: number;
  reps?: number;
  volume?: number; // total weight moved

  // Quality
  dataQuality: DataQualityFlags;

  // Vendor-specific
  vendorData?: Record<string, unknown>;
}

export type WorkoutType =
  | 'cardio'
  | 'strength'
  | 'hiit'
  | 'yoga'
  | 'cycling'
  | 'running'
  | 'swimming'
  | 'walking'
  | 'sports'
  | 'other';

// ============================================================
// DAILY METRICS (point-in-time readings)
// ============================================================

export interface DailyMetric {
  id: string;
  userId: string;
  sourceId: string;
  date: string; // YYYY-MM-DD

  metricType: DailyMetricType;
  value: number;
  unit: string;

  // Quality
  dataQuality: DataQualityFlags;
}

export type DailyMetricType =
  | 'resting_heart_rate'
  | 'hrv_morning'
  | 'weight'
  | 'body_fat_percent'
  | 'respiratory_rate'
  | 'spo2'
  | 'body_temperature'
  | 'readiness_score'
  | 'recovery_score'
  | 'strain_score';

// ============================================================
// TIME SERIES (high-frequency data)
// ============================================================

export interface TimeSeries {
  id: string;
  userId: string;
  sourceId: string;
  sessionId?: string; // Link to sleep or workout session

  metricType: TimeSeriesMetricType;
  startedAt: string; // ISO timestamp
  intervalSeconds: number; // Time between readings
  values: (number | null)[]; // Null for gaps

  // Quality
  gapCount: number;
  interpolatedCount: number;
}

export type TimeSeriesMetricType =
  | 'heart_rate'
  | 'hrv'
  | 'respiratory_rate'
  | 'spo2'
  | 'bed_temperature'
  | 'room_temperature'
  | 'movement'
  | 'sleep_stage'; // Encoded: 0=awake, 1=light, 2=deep, 3=rem

// ============================================================
// ANNOTATIONS (user-provided context)
// ============================================================

export interface Annotation {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD

  behaviors: BehaviorTag[];
  notes?: string;

  createdAt: string;
  updatedAt: string;
  source: 'manual' | 'imported';
}

export type BehaviorTag =
  // Substances
  | 'alcohol'
  | 'caffeine_late'
  | 'cannabis'
  | 'medication'
  // Food
  | 'late_meal'
  | 'heavy_meal'
  | 'sugar_late'
  | 'early_dinner'
  // Exercise
  | 'exercise'
  | 'exercise_late'
  | 'no_exercise'
  // Stress/Health
  | 'stress'
  | 'anxiety'
  | 'sick'
  | 'pain'
  // Environment
  | 'travel'
  | 'hot_room'
  | 'noise'
  | 'partner_disturbed'
  // Routine
  | 'screen_late'
  | 'late_bedtime'
  | 'good_routine'
  | 'nap'
  // Positive
  | 'relaxed'
  | 'meditation'
  | 'reading';

// ============================================================
// MORNING RATINGS (subjective feedback)
// ============================================================

export interface MorningRating {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD (the morning after sleep)
  sleepSessionId?: string; // Link to the previous night's sleep

  // Core rating (required)
  energyLevel: 1 | 2 | 3 | 4 | 5; // 1=exhausted, 5=fully energized

  // Optional additional ratings
  moodLevel?: 1 | 2 | 3 | 4 | 5; // 1=terrible, 5=great
  sleepQualityPerceived?: 1 | 2 | 3 | 4 | 5; // How well they think they slept

  // Quick notes
  notes?: string;
  tags?: MorningTag[];

  // Metadata
  ratedAt: string; // ISO timestamp when rating was submitted
}

export type MorningTag =
  | 'woke_refreshed'
  | 'woke_tired'
  | 'hard_to_wake'
  | 'woke_naturally'
  | 'vivid_dreams'
  | 'nightmares'
  | 'woke_during_night'
  | 'slept_through'
  | 'feel_rested'
  | 'feel_groggy'
  | 'headache'
  | 'muscle_soreness';

// ============================================================
// COMPUTED INSIGHTS
// ============================================================

export interface ComputedInsight {
  id: string;
  userId: string;
  computedAt: string; // ISO timestamp

  insightType: InsightType;

  // What data was used to compute this
  parameters: {
    dateRange: { start: string; end: string };
    sourceIds: string[];
    filters?: Record<string, unknown>;
  };

  // The insight itself
  result: InsightResult;

  // Confidence metrics
  confidence: number; // 0-1
  sampleSize: number;

  // When to recompute
  validUntil: string; // ISO timestamp
  invalidatedBy?: string; // Source ID that invalidated this
}

export type InsightType =
  | 'baseline'
  | 'correlation'
  | 'lag_correlation'
  | 'anomaly'
  | 'behavior_impact'
  | 'experiment_result'
  | 'trend';

export type InsightResult =
  | BaselineInsight
  | CorrelationInsight
  | AnomalyInsight
  | BehaviorImpactInsight
  | ExperimentInsight;

export interface BaselineInsight {
  type: 'baseline';
  metric: string;
  median: number;
  mad: number; // Median Absolute Deviation
  low: number; // median - 2*MAD
  high: number; // median + 2*MAD
  mean: number;
  stdDev: number;
  p25: number;
  p75: number;
}

export interface CorrelationInsight {
  type: 'correlation';
  metric1: string;
  metric2: string;
  pearsonR: number;
  pValue: number;
  lagDays: number; // 0 = same day, 1 = metric1 leads metric2 by 1 day
  interpretation: string;
}

export interface AnomalyInsight {
  type: 'anomaly';
  date: string;
  affectedMetrics: {
    metric: string;
    value: number;
    expected: number;
    zScore: number;
  }[];
  severity: 'low' | 'medium' | 'high';
  possibleCauses: string[];
}

export interface BehaviorImpactInsight {
  type: 'behavior_impact';
  behavior: BehaviorTag;
  affectedMetric: string;
  withBehavior: { mean: number; n: number };
  withoutBehavior: { mean: number; n: number };
  delta: number;
  deltaPercent: number;
  confidenceInterval: [number, number];
  isSignificant: boolean;
  interpretation: string;
}

export interface ExperimentInsight {
  type: 'experiment';
  experimentId: string;
  intervention: string;
  targetMetric: string;
  preWindow: { start: string; end: string; mean: number; n: number };
  duringWindow: { start: string; end: string; mean: number; n: number };
  postWindow?: { start: string; end: string; mean: number; n: number };
  effect: number;
  effectPercent: number;
  conclusion: string;
}

// ============================================================
// IMPORTER CONFIGURATION
// ============================================================

export interface ImporterProfile {
  id: string;
  vendor: VendorType;
  name: string;
  version: string;
  description: string;

  // How to identify files that match this profile
  filePatterns: FilePattern[];

  // How to extract data
  mappings: TableMapping[];

  // Metadata
  createdAt: string;
  isBuiltIn: boolean; // true for our standard importers
}

export interface FilePattern {
  fileType: 'json' | 'csv' | 'xml' | 'zip';

  // For JSON: JSONPath expression that must exist and return non-empty
  jsonSignature?: string;

  // For CSV: required column headers (case-insensitive)
  csvRequiredHeaders?: string[];

  // For ZIP: files that must exist inside
  zipContains?: string[];

  // For any: regex on filename
  fileNamePattern?: string;
}

export interface TableMapping {
  targetTable: 'sleep_sessions' | 'workout_sessions' | 'daily_metrics' | 'time_series' | 'annotations';

  sourceType: 'json' | 'csv';

  // For JSON: JSONPath to the array of records
  // For CSV: the CSV file name within a ZIP, or omit for single file
  sourcePath?: string;

  // Field-level mappings
  fieldMappings: FieldMapping[];

  // Optional filter (only include rows where this expression is true)
  filter?: string;
}

export interface FieldMapping {
  // Target field in canonical schema
  target: string;

  // Source expression (field name, JSONPath, or formula)
  source: string;

  // How to transform the value
  transform?: FieldTransform;

  // Is this field required?
  required?: boolean;

  // Default value if missing
  defaultValue?: unknown;
}

export type FieldTransform =
  | { type: 'direct' }
  | { type: 'timestamp'; format: 'unix_seconds' | 'unix_millis' | 'iso8601' | string }
  | { type: 'duration'; fromUnit: 'seconds' | 'minutes' | 'hours'; toUnit: 'seconds' }
  | { type: 'multiply'; factor: number }
  | { type: 'divide'; divisor: number }
  | { type: 'map'; mapping: Record<string, unknown> }
  | { type: 'regex'; pattern: string; group: number }
  | { type: 'jsonpath'; path: string }
  | { type: 'compute'; formula: string }
  | { type: 'coalesce'; sources: string[] };
