/**
 * Data Quality & Outlier Detection
 * ==================================
 * Detects sensor glitches, impossible values, and statistical outliers.
 * Uses robust statistics (median, MAD) to avoid outliers affecting detection.
 */

import type { SleepSession, DataQualityFlags } from '../types/schema';

// ============================================================
// CONSTANTS
// ============================================================

// Biologically impossible or clearly erroneous values
const HARD_LIMITS = {
  // Heart rate
  heartRate: { min: 25, max: 220 },
  minHeartRate: { min: 25, max: 120 },
  maxHeartRate: { min: 40, max: 220 },

  // HRV (RMSSD in ms)
  hrv: { min: 5, max: 300 },

  // Respiratory rate (breaths per minute)
  respiratoryRate: { min: 4, max: 40 },

  // Sleep duration (seconds)
  sleepDuration: { min: 30 * 60, max: 16 * 60 * 60 }, // 30 min to 16 hours

  // Sleep stage percentages
  deepPercent: { min: 0, max: 60 },
  remPercent: { min: 0, max: 60 },

  // Temperature (Celsius)
  bodyTemp: { min: 15, max: 45 },
  roomTemp: { min: -10, max: 50 },

  // Workout duration (seconds)
  workoutDuration: { min: 60, max: 8 * 60 * 60 }, // 1 min to 8 hours

  // Calories
  calories: { min: 0, max: 5000 },
};

// Default outlier threshold (MAD multiplier)
const DEFAULT_MAD_THRESHOLD = 3.5;

// ============================================================
// ROBUST STATISTICS
// ============================================================

export function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function medianAbsoluteDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const med = median(values);
  const deviations = values.map((v) => Math.abs(v - med));

  return median(deviations);
}

/**
 * Robust z-score using median and MAD
 * More resistant to outliers than standard z-score
 */
export function robustZScore(value: number, med: number, mad: number): number {
  if (mad === 0) return 0;
  // 0.6745 is the constant that makes MAD comparable to standard deviation
  return (value - med) / (mad / 0.6745);
}

/**
 * Calculate percentiles
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

// ============================================================
// HARD LIMIT CHECKS
// ============================================================

interface HardLimitViolation {
  field: string;
  value: number;
  limit: { min: number; max: number };
  violation: 'below_min' | 'above_max';
}

function checkHardLimits(
  value: number | undefined | null,
  field: string,
  limitKey: keyof typeof HARD_LIMITS
): HardLimitViolation | null {
  if (value === undefined || value === null) return null;

  const limits = HARD_LIMITS[limitKey];
  if (value < limits.min) {
    return { field, value, limit: limits, violation: 'below_min' };
  }
  if (value > limits.max) {
    return { field, value, limit: limits, violation: 'above_max' };
  }
  return null;
}

// ============================================================
// SLEEP SESSION QUALITY CHECK
// ============================================================

export interface SleepQualityReport {
  session: SleepSession;
  hardLimitViolations: HardLimitViolation[];
  outlierFields: string[];
  isComplete: boolean;
  missingFields: string[];
  overallQuality: 'good' | 'warning' | 'bad';
  suggestedAction: 'include' | 'exclude_from_baseline' | 'flag_for_review';
}

export function checkSleepSessionQuality(
  session: SleepSession,
  baseline?: { [metric: string]: { median: number; mad: number } },
  madThreshold: number = DEFAULT_MAD_THRESHOLD
): SleepQualityReport {
  const hardLimitViolations: HardLimitViolation[] = [];
  const outlierFields: string[] = [];
  const missingFields: string[] = [];

  // Check hard limits
  const checks: Array<{
    value: number | undefined;
    field: string;
    limitKey: keyof typeof HARD_LIMITS;
    required?: boolean;
  }> = [
    { value: session.minHeartRate, field: 'minHeartRate', limitKey: 'minHeartRate' },
    { value: session.avgHeartRate, field: 'avgHeartRate', limitKey: 'heartRate' },
    { value: session.maxHeartRate, field: 'maxHeartRate', limitKey: 'maxHeartRate' },
    { value: session.avgHrv, field: 'avgHrv', limitKey: 'hrv' },
    { value: session.avgRespiratoryRate, field: 'avgRespiratoryRate', limitKey: 'respiratoryRate' },
    { value: session.durationSeconds, field: 'durationSeconds', limitKey: 'sleepDuration', required: true },
    { value: session.avgBedTempC, field: 'avgBedTempC', limitKey: 'bodyTemp' },
    { value: session.avgRoomTempC, field: 'avgRoomTempC', limitKey: 'roomTemp' },
  ];

  for (const check of checks) {
    if (check.value === undefined || check.value === null) {
      if (check.required) {
        missingFields.push(check.field);
      }
      continue;
    }

    const violation = checkHardLimits(check.value, check.field, check.limitKey);
    if (violation) {
      hardLimitViolations.push(violation);
    }
  }

  // Check stage percentages
  const totalSleep = session.deepSeconds + session.remSeconds + session.lightSeconds;
  if (totalSleep > 0) {
    const deepPct = (session.deepSeconds / totalSleep) * 100;
    const remPct = (session.remSeconds / totalSleep) * 100;

    const deepViolation = checkHardLimits(deepPct, 'deepPercent', 'deepPercent');
    if (deepViolation) hardLimitViolations.push(deepViolation);

    const remViolation = checkHardLimits(remPct, 'remPercent', 'remPercent');
    if (remViolation) hardLimitViolations.push(remViolation);
  }

  // Check for statistical outliers against baseline
  if (baseline) {
    const metricsToCheck: Array<{ field: string; value: number | undefined }> = [
      { field: 'avgHrv', value: session.avgHrv },
      { field: 'minHeartRate', value: session.minHeartRate },
      { field: 'avgRespiratoryRate', value: session.avgRespiratoryRate },
      { field: 'durationSeconds', value: session.durationSeconds },
    ];

    for (const { field, value } of metricsToCheck) {
      if (value === undefined || !baseline[field]) continue;

      const { median: med, mad } = baseline[field];
      const zScore = robustZScore(value, med, mad);

      if (Math.abs(zScore) > madThreshold) {
        outlierFields.push(field);
      }
    }
  }

  // Determine overall quality
  const isComplete = missingFields.length === 0;
  let overallQuality: 'good' | 'warning' | 'bad';
  let suggestedAction: 'include' | 'exclude_from_baseline' | 'flag_for_review';

  if (hardLimitViolations.length > 0) {
    overallQuality = 'bad';
    suggestedAction = 'exclude_from_baseline';
  } else if (outlierFields.length >= 2) {
    overallQuality = 'warning';
    suggestedAction = 'flag_for_review';
  } else if (outlierFields.length === 1 || !isComplete) {
    overallQuality = 'warning';
    suggestedAction = 'include';
  } else {
    overallQuality = 'good';
    suggestedAction = 'include';
  }

  return {
    session,
    hardLimitViolations,
    outlierFields,
    isComplete,
    missingFields,
    overallQuality,
    suggestedAction,
  };
}

// ============================================================
// BASELINE CALCULATION WITH OUTLIER EXCLUSION
// ============================================================

export interface MetricBaseline {
  metric: string;
  median: number;
  mad: number;
  mean: number;
  stdDev: number;
  low: number; // median - 2*MAD
  high: number; // median + 2*MAD
  p25: number;
  p75: number;
  sampleSize: number;
  excludedCount: number;
}

export function calculateBaseline(
  values: number[],
  metric: string,
  excludeOutliers: boolean = true,
  madThreshold: number = DEFAULT_MAD_THRESHOLD
): MetricBaseline {
  if (values.length === 0) {
    return {
      metric,
      median: 0,
      mad: 0,
      mean: 0,
      stdDev: 0,
      low: 0,
      high: 0,
      p25: 0,
      p75: 0,
      sampleSize: 0,
      excludedCount: 0,
    };
  }

  // First pass: calculate median and MAD on all data
  const med = median(values);
  const mad = medianAbsoluteDeviation(values);

  // Filter outliers if requested
  let filteredValues = values;
  let excludedCount = 0;

  if (excludeOutliers && mad > 0) {
    filteredValues = values.filter((v) => {
      const zScore = robustZScore(v, med, mad);
      return Math.abs(zScore) <= madThreshold;
    });
    excludedCount = values.length - filteredValues.length;
  }

  // Recalculate on filtered data
  const finalMedian = median(filteredValues);
  const finalMad = medianAbsoluteDeviation(filteredValues);

  // Standard mean and stdDev for comparison
  const mean = filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length;
  const variance =
    filteredValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
    filteredValues.length;
  const stdDev = Math.sqrt(variance);

  return {
    metric,
    median: finalMedian,
    mad: finalMad,
    mean,
    stdDev,
    low: finalMedian - 2 * finalMad,
    high: finalMedian + 2 * finalMad,
    p25: percentile(filteredValues, 25),
    p75: percentile(filteredValues, 75),
    sampleSize: filteredValues.length,
    excludedCount,
  };
}

// ============================================================
// BATCH QUALITY ASSESSMENT
// ============================================================

export interface DataQualitySummary {
  totalSessions: number;
  goodSessions: number;
  warningSessions: number;
  badSessions: number;
  commonIssues: { issue: string; count: number }[];
  baselines: { [metric: string]: MetricBaseline };
  outlierDates: string[];
  recommendations: string[];
}

export function assessDataQuality(sessions: SleepSession[]): DataQualitySummary {
  // First, calculate baselines on all data (we'll refine after)
  const hrvValues = sessions.map((s) => s.avgHrv).filter((v): v is number => v !== undefined);
  const hrValues = sessions.map((s) => s.minHeartRate).filter((v): v is number => v !== undefined);
  const rrValues = sessions.map((s) => s.avgRespiratoryRate).filter((v): v is number => v !== undefined);
  const durationValues = sessions.map((s) => s.durationSeconds);

  const baselines: { [metric: string]: MetricBaseline } = {
    avgHrv: calculateBaseline(hrvValues, 'avgHrv'),
    minHeartRate: calculateBaseline(hrValues, 'minHeartRate'),
    avgRespiratoryRate: calculateBaseline(rrValues, 'avgRespiratoryRate'),
    durationSeconds: calculateBaseline(durationValues, 'durationSeconds'),
  };

  // Convert to the format expected by checkSleepSessionQuality
  const baselineForCheck: { [metric: string]: { median: number; mad: number } } = {};
  for (const [key, value] of Object.entries(baselines)) {
    baselineForCheck[key] = { median: value.median, mad: value.mad };
  }

  // Now check each session
  const reports = sessions.map((s) => checkSleepSessionQuality(s, baselineForCheck));

  // Aggregate results
  const issueCounter: { [issue: string]: number } = {};
  const outlierDates: string[] = [];

  let goodCount = 0;
  let warningCount = 0;
  let badCount = 0;

  for (const report of reports) {
    if (report.overallQuality === 'good') goodCount++;
    else if (report.overallQuality === 'warning') warningCount++;
    else badCount++;

    for (const violation of report.hardLimitViolations) {
      const key = `${violation.field}: ${violation.violation}`;
      issueCounter[key] = (issueCounter[key] || 0) + 1;
    }

    for (const field of report.outlierFields) {
      const key = `${field}: statistical outlier`;
      issueCounter[key] = (issueCounter[key] || 0) + 1;
    }

    if (report.suggestedAction === 'exclude_from_baseline' || report.suggestedAction === 'flag_for_review') {
      outlierDates.push(report.session.date);
    }
  }

  // Sort issues by frequency
  const commonIssues = Object.entries(issueCounter)
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Generate recommendations
  const recommendations: string[] = [];

  if (badCount > sessions.length * 0.1) {
    recommendations.push(
      `${badCount} sessions (${((badCount / sessions.length) * 100).toFixed(1)}%) have data quality issues. Consider reviewing sensor placement or device settings.`
    );
  }

  const hrvOutliers = baselines.avgHrv.excludedCount;
  if (hrvOutliers > 5) {
    recommendations.push(
      `${hrvOutliers} HRV readings were excluded as outliers. This may indicate sensor issues or unusual nights.`
    );
  }

  return {
    totalSessions: sessions.length,
    goodSessions: goodCount,
    warningSessions: warningCount,
    badSessions: badCount,
    commonIssues,
    baselines,
    outlierDates,
    recommendations,
  };
}

// ============================================================
// DATA QUALITY FLAGS GENERATOR
// ============================================================

export function generateDataQualityFlags(
  report: SleepQualityReport,
  existingFlags?: Partial<DataQualityFlags>
): DataQualityFlags {
  return {
    isComplete: report.isComplete,
    hasOutliers: report.outlierFields.length > 0 || report.hardLimitViolations.length > 0,
    outlierFields: [
      ...report.outlierFields,
      ...report.hardLimitViolations.map((v) => v.field),
    ],
    sensorGaps: existingFlags?.sensorGaps ?? 0,
    manuallyExcluded: existingFlags?.manuallyExcluded ?? false,
    exclusionReason: existingFlags?.exclusionReason,
  };
}
