/**
 * Insights Engine
 * ================
 * Generates actionable takeaways from sleep and workout data.
 *
 * Current data sources:
 * - Sleep sessions (duration, stages, HR, HRV, temperature)
 *
 * Future enhancements with additional context:
 * - Workout timing and intensity correlation
 * - Subjective ratings (morning energy, perceived quality)
 * - Environmental factors (travel, timezone changes)
 * - Behavioral factors (caffeine, alcohol, screen time)
 */

import type { SleepSession, WorkoutSession, MorningRating } from '../types/schema';

// ============================================================
// TYPES
// ============================================================

export interface Insight {
  id: string;
  category: InsightCategory;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation?: string;
  dataPoints?: DataPoint[];
  confidence: 'high' | 'medium' | 'low';
  basedOn: string; // Description of data used
}

export type InsightCategory =
  | 'consistency'
  | 'duration'
  | 'quality'
  | 'recovery'
  | 'stages'
  | 'temperature'
  | 'trend'
  | 'correlation'
  | 'subjective';

export interface DataPoint {
  label: string;
  value: number | string;
  unit?: string;
  comparison?: {
    baseline: number;
    direction: 'better' | 'worse' | 'neutral';
  };
}

export interface SleepConsistencyMetrics {
  bedtimeConsistencyScore: number; // 0-100
  wakeTimeConsistencyScore: number;
  overallConsistencyScore: number;
  avgBedtime: string; // HH:MM format
  avgWakeTime: string;
  bedtimeStdDevMinutes: number;
  wakeTimeStdDevMinutes: number;
  socialJetLagMinutes: number; // Weekend vs weekday difference
}

export interface RecoveryMetrics {
  currentHrvTrend: 'improving' | 'declining' | 'stable';
  hrvPercentile: number; // Where current HRV sits vs baseline
  restingHrTrend: 'improving' | 'declining' | 'stable';
  recoveryScore: number; // 0-100
  consecutiveGoodNights: number;
  consecutivePoorNights: number;
}

export interface DurationOptimization {
  optimalDurationRange: { min: number; max: number }; // hours
  currentAvg: number;
  qualityCorrelation: number; // -1 to 1
  recommendation: 'increase' | 'decrease' | 'maintain';
  targetDuration?: number;
}

export interface TemperatureInsight {
  optimalBedTemp?: number;
  optimalRoomTemp?: number;
  tempQualityCorrelation: number;
  currentTempSettings?: { bed: number; room: number };
}

// ============================================================
// MAIN ANALYSIS FUNCTION
// ============================================================

export function generateInsights(
  sleepSessions: SleepSession[],
  workoutSessions: WorkoutSession[] = [],
  morningRatings: MorningRating[] = [],
  options: { lookbackDays?: number; minSessions?: number } = {}
): Insight[] {
  const { lookbackDays = 90, minSessions = 14 } = options;
  const insights: Insight[] = [];

  if (sleepSessions.length < minSessions) {
    return [{
      id: 'insufficient-data',
      category: 'quality',
      priority: 'high',
      title: 'Need More Data',
      description: `We need at least ${minSessions} sleep sessions to generate personalized insights. You have ${sleepSessions.length} sessions.`,
      confidence: 'high',
      basedOn: 'Session count',
    }];
  }

  // Sort sessions by date (newest first)
  const sorted = [...sleepSessions].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Filter to lookback period
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const recentSessions = sorted.filter(s => new Date(s.date) >= cutoff);

  if (recentSessions.length < minSessions) {
    // Use all sessions if not enough recent ones
  }

  const sessionsToAnalyze = recentSessions.length >= minSessions ? recentSessions : sorted.slice(0, Math.min(sorted.length, 90));

  // Generate insights from each analyzer
  insights.push(...analyzeConsistency(sessionsToAnalyze));
  insights.push(...analyzeDuration(sessionsToAnalyze));
  insights.push(...analyzeRecovery(sessionsToAnalyze));
  insights.push(...analyzeStages(sessionsToAnalyze));
  insights.push(...analyzeTemperature(sessionsToAnalyze));
  insights.push(...analyzeTrends(sessionsToAnalyze, sorted));

  if (workoutSessions.length > 0) {
    insights.push(...analyzeWorkoutCorrelation(sessionsToAnalyze, workoutSessions));
  }

  if (morningRatings.length > 0) {
    insights.push(...analyzeMorningRatings(sessionsToAnalyze, morningRatings));
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return insights;
}

// ============================================================
// CONSISTENCY ANALYSIS
// ============================================================

function analyzeConsistency(sessions: SleepSession[]): Insight[] {
  const insights: Insight[] = [];
  const metrics = calculateConsistencyMetrics(sessions);

  // Social jet lag insight
  if (metrics.socialJetLagMinutes > 60) {
    insights.push({
      id: 'social-jet-lag',
      category: 'consistency',
      priority: metrics.socialJetLagMinutes > 90 ? 'high' : 'medium',
      title: 'Weekend Sleep Shift Detected',
      description: `Your weekend sleep schedule shifts by ${Math.round(metrics.socialJetLagMinutes)} minutes compared to weekdays. This "social jet lag" can disrupt your circadian rhythm.`,
      recommendation: 'Try to keep your bedtime and wake time within 30 minutes of your weekday schedule on weekends.',
      dataPoints: [
        { label: 'Sleep shift', value: Math.round(metrics.socialJetLagMinutes), unit: 'min' },
      ],
      confidence: 'high',
      basedOn: `${sessions.length} sessions analyzed`,
    });
  }

  // Bedtime consistency
  if (metrics.bedtimeStdDevMinutes > 60) {
    insights.push({
      id: 'bedtime-inconsistency',
      category: 'consistency',
      priority: metrics.bedtimeStdDevMinutes > 90 ? 'high' : 'medium',
      title: 'Variable Bedtime Pattern',
      description: `Your bedtime varies by about ${Math.round(metrics.bedtimeStdDevMinutes)} minutes on average. Consistent sleep timing helps regulate your body's internal clock.`,
      recommendation: `Aim for a consistent bedtime around ${metrics.avgBedtime}. Set a "wind down" alarm 30 minutes before.`,
      dataPoints: [
        { label: 'Target bedtime', value: metrics.avgBedtime },
        { label: 'Current variation', value: `±${Math.round(metrics.bedtimeStdDevMinutes)}`, unit: 'min' },
      ],
      confidence: 'high',
      basedOn: `${sessions.length} sessions analyzed`,
    });
  } else if (metrics.bedtimeStdDevMinutes < 30) {
    insights.push({
      id: 'consistent-bedtime',
      category: 'consistency',
      priority: 'low',
      title: 'Excellent Sleep Consistency',
      description: `Your bedtime is very consistent (±${Math.round(metrics.bedtimeStdDevMinutes)} min). This supports healthy circadian rhythm regulation.`,
      dataPoints: [
        { label: 'Consistency score', value: metrics.overallConsistencyScore, unit: '/100' },
      ],
      confidence: 'high',
      basedOn: `${sessions.length} sessions analyzed`,
    });
  }

  return insights;
}

function calculateConsistencyMetrics(sessions: SleepSession[]): SleepConsistencyMetrics {
  const bedtimes: number[] = [];
  const wakeTimes: number[] = [];
  const weekdayBedtimes: number[] = [];
  const weekendBedtimes: number[] = [];

  for (const session of sessions) {
    if (!session.startedAt || !session.endedAt) continue;

    const start = new Date(session.startedAt);
    const end = new Date(session.endedAt);

    // Convert to minutes since midnight (handling overnight)
    const bedtimeMinutes = start.getHours() * 60 + start.getMinutes();
    const wakeMinutes = end.getHours() * 60 + end.getMinutes();

    // Adjust for bedtimes after midnight (treat as negative from midnight)
    const adjustedBedtime = bedtimeMinutes > 720 ? bedtimeMinutes : bedtimeMinutes + 1440;

    bedtimes.push(adjustedBedtime);
    wakeTimes.push(wakeMinutes);

    const dayOfWeek = start.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
      weekendBedtimes.push(adjustedBedtime);
    } else {
      weekdayBedtimes.push(adjustedBedtime);
    }
  }

  const avgBedtimeMinutes = mean(bedtimes);
  const avgWakeMinutes = mean(wakeTimes);
  const bedtimeStdDev = stdDev(bedtimes);
  const wakeStdDev = stdDev(wakeTimes);

  const avgWeekdayBedtime = weekdayBedtimes.length > 0 ? mean(weekdayBedtimes) : avgBedtimeMinutes;
  const avgWeekendBedtime = weekendBedtimes.length > 0 ? mean(weekendBedtimes) : avgBedtimeMinutes;
  const socialJetLag = Math.abs(avgWeekendBedtime - avgWeekdayBedtime);

  // Score consistency (lower std dev = higher score)
  const bedtimeScore = Math.max(0, 100 - bedtimeStdDev);
  const wakeScore = Math.max(0, 100 - wakeStdDev);

  return {
    bedtimeConsistencyScore: Math.round(bedtimeScore),
    wakeTimeConsistencyScore: Math.round(wakeScore),
    overallConsistencyScore: Math.round((bedtimeScore + wakeScore) / 2),
    avgBedtime: minutesToTimeString(avgBedtimeMinutes % 1440),
    avgWakeTime: minutesToTimeString(avgWakeMinutes),
    bedtimeStdDevMinutes: bedtimeStdDev,
    wakeTimeStdDevMinutes: wakeStdDev,
    socialJetLagMinutes: socialJetLag,
  };
}

// ============================================================
// DURATION ANALYSIS
// ============================================================

function analyzeDuration(sessions: SleepSession[]): Insight[] {
  const insights: Insight[] = [];

  const durations = sessions
    .filter(s => s.durationSeconds && s.durationSeconds > 0)
    .map(s => s.durationSeconds);

  if (durations.length < 14) return insights;

  const avgDuration = mean(durations) / 3600; // Convert to hours

  // Calculate quality as deep + REM percentage
  const sessionsWithQuality = sessions.filter(s =>
    s.durationSeconds > 0 && (s.deepSeconds !== undefined || s.remSeconds !== undefined)
  );

  // Calculate optimal duration (where quality is highest)
  const durationQualityPairs = sessionsWithQuality.map(s => ({
    duration: s.durationSeconds / 3600,
    quality: ((s.deepSeconds || 0) + (s.remSeconds || 0)) / s.durationSeconds * 100
  }));

  if (durationQualityPairs.length >= 14) {
    const optimalRange = findOptimalDurationRange(durationQualityPairs);

    if (avgDuration < optimalRange.min - 0.25) {
      insights.push({
        id: 'sleep-duration-low',
        category: 'duration',
        priority: avgDuration < optimalRange.min - 0.5 ? 'high' : 'medium',
        title: 'You May Need More Sleep',
        description: `Your average sleep (${avgDuration.toFixed(1)}h) is below your optimal range. Your data shows best quality between ${optimalRange.min.toFixed(1)}-${optimalRange.max.toFixed(1)} hours.`,
        recommendation: `Try going to bed ${Math.round((optimalRange.min - avgDuration) * 60)} minutes earlier to hit your optimal duration.`,
        dataPoints: [
          { label: 'Current avg', value: avgDuration.toFixed(1), unit: 'h' },
          { label: 'Your optimal', value: `${optimalRange.min.toFixed(1)}-${optimalRange.max.toFixed(1)}`, unit: 'h' },
        ],
        confidence: 'high',
        basedOn: `Quality correlation across ${durationQualityPairs.length} nights`,
      });
    } else if (avgDuration > optimalRange.max + 0.25) {
      insights.push({
        id: 'sleep-duration-high',
        category: 'duration',
        priority: 'low',
        title: 'Consider Adjusting Sleep Duration',
        description: `You're sleeping ${avgDuration.toFixed(1)}h on average. Your data suggests quality peaks between ${optimalRange.min.toFixed(1)}-${optimalRange.max.toFixed(1)} hours.`,
        recommendation: 'Oversleeping can sometimes indicate underlying issues or lead to grogginess. Monitor how you feel.',
        dataPoints: [
          { label: 'Current avg', value: avgDuration.toFixed(1), unit: 'h' },
          { label: 'Your optimal', value: `${optimalRange.min.toFixed(1)}-${optimalRange.max.toFixed(1)}`, unit: 'h' },
        ],
        confidence: 'medium',
        basedOn: `Quality correlation across ${durationQualityPairs.length} nights`,
      });
    }
  }

  return insights;
}

function findOptimalDurationRange(pairs: { duration: number; quality: number }[]): { min: number; max: number } {
  // Bucket durations and find where quality is highest
  const buckets: Map<number, number[]> = new Map();

  for (const pair of pairs) {
    const bucket = Math.round(pair.duration * 2) / 2; // Round to nearest 0.5h
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(pair.quality);
  }

  // Find bucket with highest average quality
  let bestBucket = 7.5;
  let bestQuality = 0;

  for (const [bucket, qualities] of buckets) {
    if (qualities.length >= 3) {
      const avgQuality = mean(qualities);
      if (avgQuality > bestQuality) {
        bestQuality = avgQuality;
        bestBucket = bucket;
      }
    }
  }

  return { min: bestBucket - 0.5, max: bestBucket + 0.5 };
}

// ============================================================
// RECOVERY ANALYSIS
// ============================================================

function analyzeRecovery(sessions: SleepSession[]): Insight[] {
  const insights: Insight[] = [];

  const hrvValues = sessions
    .filter(s => s.avgHrv && s.avgHrv > 0)
    .map(s => ({ date: s.date, hrv: s.avgHrv! }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (hrvValues.length < 14) return insights;

  // Calculate HRV baseline and trend
  const allHrv = hrvValues.map(v => v.hrv);
  const baseline = mean(allHrv);
  const recent7 = hrvValues.slice(-7).map(v => v.hrv);
  const previous7 = hrvValues.slice(-14, -7).map(v => v.hrv);

  const recentAvg = mean(recent7);
  const previousAvg = mean(previous7);
  const change = ((recentAvg - previousAvg) / previousAvg) * 100;

  const trend: 'improving' | 'declining' | 'stable' =
    change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable';

  const currentPercentile = percentileRank(allHrv, recentAvg);

  // Calculate recovery score (composite)
  const recoveryScore = Math.min(100, Math.round(
    (currentPercentile * 0.5) +
    (trend === 'improving' ? 25 : trend === 'stable' ? 15 : 5) +
    (recentAvg > baseline ? 25 : 15)
  ));

  if (trend === 'declining' && change < -10) {
    insights.push({
      id: 'hrv-declining',
      category: 'recovery',
      priority: 'high',
      title: 'HRV Trending Down',
      description: `Your HRV has dropped ${Math.abs(change).toFixed(0)}% over the past week. This may indicate accumulated stress, insufficient recovery, or oncoming illness.`,
      recommendation: 'Consider prioritizing rest, reducing training intensity, and ensuring adequate sleep duration this week.',
      dataPoints: [
        { label: 'Recent avg', value: Math.round(recentAvg), unit: 'ms' },
        { label: 'Change', value: `${change.toFixed(0)}%` },
        { label: 'Your baseline', value: Math.round(baseline), unit: 'ms' },
      ],
      confidence: 'high',
      basedOn: `HRV data from ${hrvValues.length} nights`,
    });
  } else if (trend === 'improving' && change > 10) {
    insights.push({
      id: 'hrv-improving',
      category: 'recovery',
      priority: 'low',
      title: 'Strong Recovery Trend',
      description: `Your HRV is up ${change.toFixed(0)}% this week compared to last. Your body is adapting well to your current routine.`,
      dataPoints: [
        { label: 'Recent avg', value: Math.round(recentAvg), unit: 'ms' },
        { label: 'Recovery score', value: recoveryScore, unit: '/100' },
      ],
      confidence: 'high',
      basedOn: `HRV data from ${hrvValues.length} nights`,
    });
  }

  // Resting HR analysis
  const hrValues = sessions
    .filter(s => s.minHeartRate && s.minHeartRate > 30)
    .map(s => ({ date: s.date, hr: s.minHeartRate! }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (hrValues.length >= 14) {
    const recentHr = mean(hrValues.slice(-7).map(v => v.hr));
    const previousHr = mean(hrValues.slice(-14, -7).map(v => v.hr));
    const hrChange = recentHr - previousHr;

    if (hrChange > 3) {
      insights.push({
        id: 'resting-hr-elevated',
        category: 'recovery',
        priority: 'medium',
        title: 'Elevated Resting Heart Rate',
        description: `Your minimum HR is ${hrChange.toFixed(0)} bpm higher than last week. This can indicate stress, insufficient recovery, or dehydration.`,
        recommendation: 'Focus on hydration and consider lighter activity for the next few days.',
        dataPoints: [
          { label: 'Current', value: Math.round(recentHr), unit: 'bpm' },
          { label: 'vs last week', value: `+${hrChange.toFixed(0)}`, unit: 'bpm' },
        ],
        confidence: 'medium',
        basedOn: `HR data from ${hrValues.length} nights`,
      });
    }
  }

  return insights;
}

// ============================================================
// SLEEP STAGES ANALYSIS
// ============================================================

function analyzeStages(sessions: SleepSession[]): Insight[] {
  const insights: Insight[] = [];

  const stageData = sessions.filter(s =>
    s.deepSeconds !== undefined &&
    s.remSeconds !== undefined &&
    s.durationSeconds && s.durationSeconds > 0
  );

  if (stageData.length < 14) return insights;

  const deepPercents = stageData.map(s => (s.deepSeconds / s.durationSeconds) * 100);
  const remPercents = stageData.map(s => (s.remSeconds / s.durationSeconds) * 100);

  const avgDeep = mean(deepPercents);
  const avgRem = mean(remPercents);

  // Target ranges (general guidelines)
  const deepTarget = { min: 15, max: 25 };
  const remTarget = { min: 20, max: 25 };

  if (avgDeep < deepTarget.min) {
    insights.push({
      id: 'low-deep-sleep',
      category: 'stages',
      priority: avgDeep < 12 ? 'high' : 'medium',
      title: 'Deep Sleep Below Optimal',
      description: `Your deep sleep averages ${avgDeep.toFixed(1)}%, below the recommended ${deepTarget.min}-${deepTarget.max}%. Deep sleep is critical for physical recovery and immune function.`,
      recommendation: 'To improve deep sleep: exercise regularly (but not too close to bedtime), keep your room cool (65-68°F), and avoid alcohol before bed.',
      dataPoints: [
        { label: 'Your average', value: avgDeep.toFixed(1), unit: '%' },
        { label: 'Target range', value: `${deepTarget.min}-${deepTarget.max}`, unit: '%' },
      ],
      confidence: 'medium',
      basedOn: `${stageData.length} nights with stage data`,
    });
  }

  if (avgRem < remTarget.min) {
    insights.push({
      id: 'low-rem-sleep',
      category: 'stages',
      priority: avgRem < 15 ? 'high' : 'medium',
      title: 'REM Sleep Below Optimal',
      description: `Your REM sleep averages ${avgRem.toFixed(1)}%, below the recommended ${remTarget.min}-${remTarget.max}%. REM is essential for memory consolidation and emotional regulation.`,
      recommendation: 'To improve REM: maintain consistent sleep times, get enough total sleep (REM increases in later cycles), and limit alcohol which suppresses REM.',
      dataPoints: [
        { label: 'Your average', value: avgRem.toFixed(1), unit: '%' },
        { label: 'Target range', value: `${remTarget.min}-${remTarget.max}`, unit: '%' },
      ],
      confidence: 'medium',
      basedOn: `${stageData.length} nights with stage data`,
    });
  }

  return insights;
}

// ============================================================
// TEMPERATURE ANALYSIS
// ============================================================

function analyzeTemperature(sessions: SleepSession[]): Insight[] {
  const insights: Insight[] = [];

  const tempData = sessions.filter(s =>
    s.avgBedTempC !== undefined || s.avgRoomTempC !== undefined
  );

  if (tempData.length < 14) return insights;

  // Analyze bed temperature correlation with quality
  const bedTempQuality = tempData
    .filter(s => s.avgBedTempC && s.durationSeconds > 0)
    .map(s => ({
      temp: s.avgBedTempC!,
      quality: ((s.deepSeconds || 0) + (s.remSeconds || 0)) / s.durationSeconds * 100
    }));

  if (bedTempQuality.length >= 14) {
    const correlation = calculateCorrelation(
      bedTempQuality.map(d => d.temp),
      bedTempQuality.map(d => d.quality)
    );

    // Find optimal temperature range
    const optimalTemp = findOptimalTemperature(bedTempQuality);

    if (Math.abs(correlation) > 0.2) {
      const recent = bedTempQuality.slice(-7);
      const avgRecentTemp = mean(recent.map(d => d.temp));
      const tempDiff = avgRecentTemp - optimalTemp;

      if (Math.abs(tempDiff) > 1) {
        insights.push({
          id: 'bed-temp-optimization',
          category: 'temperature',
          priority: Math.abs(tempDiff) > 2 ? 'medium' : 'low',
          title: 'Temperature Optimization Opportunity',
          description: `Your data shows best sleep quality around ${optimalTemp.toFixed(1)}°C (${celsiusToFahrenheit(optimalTemp).toFixed(0)}°F). Recently you've averaged ${avgRecentTemp.toFixed(1)}°C.`,
          recommendation: tempDiff > 0
            ? `Try cooling your bed by ${Math.abs(tempDiff).toFixed(1)}°C for potentially better sleep.`
            : `Try warming your bed by ${Math.abs(tempDiff).toFixed(1)}°C for potentially better sleep.`,
          dataPoints: [
            { label: 'Your optimal', value: optimalTemp.toFixed(1), unit: '°C' },
            { label: 'Recent avg', value: avgRecentTemp.toFixed(1), unit: '°C' },
          ],
          confidence: Math.abs(correlation) > 0.3 ? 'high' : 'medium',
          basedOn: `Temperature-quality correlation (r=${correlation.toFixed(2)}) across ${bedTempQuality.length} nights`,
        });
      }
    }
  }

  return insights;
}

function findOptimalTemperature(pairs: { temp: number; quality: number }[]): number {
  const buckets: Map<number, number[]> = new Map();

  for (const pair of pairs) {
    const bucket = Math.round(pair.temp);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(pair.quality);
  }

  let bestTemp = 21; // Default
  let bestQuality = 0;

  for (const [temp, qualities] of buckets) {
    if (qualities.length >= 3) {
      const avgQuality = mean(qualities);
      if (avgQuality > bestQuality) {
        bestQuality = avgQuality;
        bestTemp = temp;
      }
    }
  }

  return bestTemp;
}

// ============================================================
// TREND ANALYSIS
// ============================================================

function analyzeTrends(recent: SleepSession[], all: SleepSession[]): Insight[] {
  const insights: Insight[] = [];

  // Compare recent 30 days to historical average
  const recent30 = recent.slice(0, 30);
  const historical = all.slice(30);

  if (recent30.length < 7 || historical.length < 30) return insights;

  // Calculate quality as deep + REM percentage
  const getQuality = (s: SleepSession) =>
    s.durationSeconds > 0 ? ((s.deepSeconds || 0) + (s.remSeconds || 0)) / s.durationSeconds * 100 : 0;

  const recentQuality = mean(recent30.filter(s => s.durationSeconds > 0).map(getQuality));
  const historicalQuality = mean(historical.filter(s => s.durationSeconds > 0).map(getQuality));

  const qualityChange = ((recentQuality - historicalQuality) / historicalQuality) * 100;

  if (qualityChange < -10) {
    insights.push({
      id: 'quality-declining-trend',
      category: 'trend',
      priority: qualityChange < -15 ? 'high' : 'medium',
      title: 'Sleep Quality Declining',
      description: `Your recent sleep quality (${recentQuality.toFixed(0)}%) is ${Math.abs(qualityChange).toFixed(0)}% lower than your historical average. This sustained decline warrants attention.`,
      recommendation: 'Review your recent routine for changes: stress levels, exercise patterns, diet, screen time, or sleep environment changes.',
      dataPoints: [
        { label: 'Recent avg', value: recentQuality.toFixed(0), unit: '%' },
        { label: 'Historical', value: historicalQuality.toFixed(0), unit: '%' },
        { label: 'Change', value: `${qualityChange.toFixed(0)}%` },
      ],
      confidence: 'high',
      basedOn: `Comparing last 30 days to ${historical.length} historical nights`,
    });
  } else if (qualityChange > 10) {
    insights.push({
      id: 'quality-improving-trend',
      category: 'trend',
      priority: 'low',
      title: 'Sleep Quality Improving',
      description: `Your recent sleep quality (${recentQuality.toFixed(0)}%) is ${qualityChange.toFixed(0)}% better than your historical average. Whatever you're doing is working!`,
      dataPoints: [
        { label: 'Recent avg', value: recentQuality.toFixed(0), unit: '%' },
        { label: 'Historical', value: historicalQuality.toFixed(0), unit: '%' },
      ],
      confidence: 'high',
      basedOn: `Comparing last 30 days to ${historical.length} historical nights`,
    });
  }

  return insights;
}

// ============================================================
// WORKOUT CORRELATION ANALYSIS
// ============================================================

function analyzeWorkoutCorrelation(
  sleepSessions: SleepSession[],
  workoutSessions: WorkoutSession[]
): Insight[] {
  const insights: Insight[] = [];

  if (workoutSessions.length < 10) return insights;

  // Match sleep nights with previous day's workouts
  const pairs: { workout: WorkoutSession; sleep: SleepSession }[] = [];

  for (const sleep of sleepSessions) {
    const sleepDate = new Date(sleep.date);
    const prevDay = new Date(sleepDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayStr = prevDay.toISOString().split('T')[0];

    const workout = workoutSessions.find(w => w.date === prevDayStr);
    if (workout) {
      pairs.push({ workout, sleep });
    }
  }

  if (pairs.length < 10) return insights;

  // Analyze workout timing effect
  const morningWorkouts = pairs.filter(p => {
    if (!p.workout.startedAt) return false;
    const hour = new Date(p.workout.startedAt).getHours();
    return hour < 12;
  });

  const eveningWorkouts = pairs.filter(p => {
    if (!p.workout.startedAt) return false;
    const hour = new Date(p.workout.startedAt).getHours();
    return hour >= 17;
  });

  if (morningWorkouts.length >= 5 && eveningWorkouts.length >= 5) {
    const getQuality = (s: SleepSession) =>
      s.durationSeconds > 0 ? ((s.deepSeconds || 0) + (s.remSeconds || 0)) / s.durationSeconds * 100 : 0;

    const morningQuality = mean(morningWorkouts.map(p => getQuality(p.sleep)));
    const eveningQuality = mean(eveningWorkouts.map(p => getQuality(p.sleep)));
    const diff = morningQuality - eveningQuality;

    if (Math.abs(diff) > 5) {
      const betterTime = diff > 0 ? 'morning' : 'evening';
      insights.push({
        id: 'workout-timing',
        category: 'correlation',
        priority: Math.abs(diff) > 10 ? 'medium' : 'low',
        title: `${betterTime.charAt(0).toUpperCase() + betterTime.slice(1)} Workouts = Better Sleep`,
        description: `When you exercise in the ${betterTime}, your sleep quality is ${Math.abs(diff).toFixed(0)}% higher compared to ${diff > 0 ? 'evening' : 'morning'} workouts.`,
        recommendation: `Consider scheduling your workouts in the ${betterTime} when possible.`,
        dataPoints: [
          { label: 'Morning workout sleep', value: morningQuality.toFixed(0), unit: '%' },
          { label: 'Evening workout sleep', value: eveningQuality.toFixed(0), unit: '%' },
        ],
        confidence: 'medium',
        basedOn: `${morningWorkouts.length} morning, ${eveningWorkouts.length} evening workout nights`,
      });
    }
  }

  return insights;
}

// ============================================================
// MORNING RATINGS CORRELATION ANALYSIS
// ============================================================

function analyzeMorningRatings(
  sleepSessions: SleepSession[],
  morningRatings: MorningRating[]
): Insight[] {
  const insights: Insight[] = [];

  if (morningRatings.length < 7) {
    insights.push({
      id: 'need-more-ratings',
      category: 'subjective',
      priority: 'low',
      title: 'Keep Logging Morning Energy',
      description: `You have ${morningRatings.length} morning ratings. Log at least 7 to unlock personalized insights about what makes you feel energized.`,
      confidence: 'high',
      basedOn: 'Rating count',
    });
    return insights;
  }

  // Match ratings with sleep sessions
  const pairs: { sleep: SleepSession; rating: MorningRating }[] = [];

  for (const rating of morningRatings) {
    // Morning rating date corresponds to the sleep session from the night before
    const ratingDate = new Date(rating.date);
    const sleepDate = new Date(ratingDate);
    sleepDate.setDate(sleepDate.getDate() - 1);
    const sleepDateStr = sleepDate.toISOString().split('T')[0];

    const matchingSession = sleepSessions.find(s => s.date === sleepDateStr);
    if (matchingSession) {
      pairs.push({ sleep: matchingSession, rating });
    }
  }

  if (pairs.length < 7) return insights;

  // Analyze what correlates with high energy
  const highEnergy = pairs.filter(p => p.rating.energyLevel >= 4);
  const lowEnergy = pairs.filter(p => p.rating.energyLevel <= 2);

  if (highEnergy.length >= 3 && lowEnergy.length >= 3) {
    // Duration analysis
    const highEnergyDuration = mean(highEnergy.map(p => p.sleep.durationSeconds / 3600));
    const lowEnergyDuration = mean(lowEnergy.map(p => p.sleep.durationSeconds / 3600));
    const durationDiff = highEnergyDuration - lowEnergyDuration;

    if (Math.abs(durationDiff) > 0.5) {
      insights.push({
        id: 'energy-duration-correlation',
        category: 'subjective',
        priority: 'medium',
        title: durationDiff > 0 ? 'More Sleep = More Energy' : 'Sleep Sweet Spot Found',
        description: durationDiff > 0
          ? `On high-energy mornings, you averaged ${highEnergyDuration.toFixed(1)}h of sleep vs ${lowEnergyDuration.toFixed(1)}h on low-energy mornings.`
          : `Interestingly, you feel more energized with ${lowEnergyDuration.toFixed(1)}h than ${highEnergyDuration.toFixed(1)}h. You may be oversleeping.`,
        recommendation: durationDiff > 0
          ? `Aim for ${highEnergyDuration.toFixed(1)}h of sleep to maximize your morning energy.`
          : `Your sweet spot appears to be around ${lowEnergyDuration.toFixed(1)}h of sleep.`,
        dataPoints: [
          { label: 'High energy nights', value: highEnergyDuration.toFixed(1), unit: 'h' },
          { label: 'Low energy nights', value: lowEnergyDuration.toFixed(1), unit: 'h' },
        ],
        confidence: 'high',
        basedOn: `${pairs.length} nights with energy ratings`,
      });
    }

    // Deep sleep analysis
    const highEnergyDeep = mean(highEnergy.map(p =>
      p.sleep.durationSeconds > 0 ? (p.sleep.deepSeconds / p.sleep.durationSeconds) * 100 : 0
    ));
    const lowEnergyDeep = mean(lowEnergy.map(p =>
      p.sleep.durationSeconds > 0 ? (p.sleep.deepSeconds / p.sleep.durationSeconds) * 100 : 0
    ));
    const deepDiff = highEnergyDeep - lowEnergyDeep;

    if (deepDiff > 3) {
      insights.push({
        id: 'energy-deep-correlation',
        category: 'subjective',
        priority: 'medium',
        title: 'Deep Sleep Drives Your Energy',
        description: `On high-energy mornings, you got ${highEnergyDeep.toFixed(0)}% deep sleep vs ${lowEnergyDeep.toFixed(0)}% on low-energy mornings. Deep sleep is key for you.`,
        recommendation: 'Prioritize deep sleep: exercise earlier, avoid alcohol, keep your room cool (65-68°F).',
        dataPoints: [
          { label: 'High energy deep %', value: highEnergyDeep.toFixed(0), unit: '%' },
          { label: 'Low energy deep %', value: lowEnergyDeep.toFixed(0), unit: '%' },
        ],
        confidence: 'high',
        basedOn: `${pairs.length} nights with energy ratings`,
      });
    }

    // HRV analysis
    const highEnergyHrv = highEnergy.filter(p => p.sleep.avgHrv);
    const lowEnergyHrv = lowEnergy.filter(p => p.sleep.avgHrv);

    if (highEnergyHrv.length >= 3 && lowEnergyHrv.length >= 3) {
      const avgHighHrv = mean(highEnergyHrv.map(p => p.sleep.avgHrv!));
      const avgLowHrv = mean(lowEnergyHrv.map(p => p.sleep.avgHrv!));
      const hrvDiff = avgHighHrv - avgLowHrv;

      if (hrvDiff > 5) {
        insights.push({
          id: 'energy-hrv-correlation',
          category: 'subjective',
          priority: 'medium',
          title: 'HRV Predicts Your Energy',
          description: `When your HRV is higher (${avgHighHrv.toFixed(0)} ms), you feel more energized. Low-energy mornings average ${avgLowHrv.toFixed(0)} ms HRV.`,
          recommendation: 'HRV reflects recovery. On low HRV days, consider lighter activities and earlier bedtime.',
          dataPoints: [
            { label: 'High energy HRV', value: Math.round(avgHighHrv), unit: 'ms' },
            { label: 'Low energy HRV', value: Math.round(avgLowHrv), unit: 'ms' },
          ],
          confidence: 'high',
          basedOn: `${highEnergyHrv.length + lowEnergyHrv.length} nights with HRV and energy data`,
        });
      }
    }
  }

  // Overall energy trend
  const recentRatings = [...morningRatings]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 7);

  const avgRecentEnergy = mean(recentRatings.map(r => r.energyLevel));
  const avgOverallEnergy = mean(morningRatings.map(r => r.energyLevel));

  if (avgRecentEnergy - avgOverallEnergy > 0.5) {
    insights.push({
      id: 'energy-improving',
      category: 'subjective',
      priority: 'low',
      title: 'Energy Levels Improving',
      description: `Your recent morning energy (${avgRecentEnergy.toFixed(1)}/5) is better than your average (${avgOverallEnergy.toFixed(1)}/5). Keep up what you're doing!`,
      dataPoints: [
        { label: 'Recent avg', value: avgRecentEnergy.toFixed(1), unit: '/5' },
        { label: 'Overall avg', value: avgOverallEnergy.toFixed(1), unit: '/5' },
      ],
      confidence: 'medium',
      basedOn: `${morningRatings.length} total ratings`,
    });
  } else if (avgOverallEnergy - avgRecentEnergy > 0.5) {
    insights.push({
      id: 'energy-declining',
      category: 'subjective',
      priority: 'high',
      title: 'Energy Levels Declining',
      description: `Your recent morning energy (${avgRecentEnergy.toFixed(1)}/5) is lower than your average (${avgOverallEnergy.toFixed(1)}/5). Consider reviewing recent changes to your routine.`,
      recommendation: 'Check if recent changes (stress, schedule, diet) might be affecting your sleep quality.',
      dataPoints: [
        { label: 'Recent avg', value: avgRecentEnergy.toFixed(1), unit: '/5' },
        { label: 'Overall avg', value: avgOverallEnergy.toFixed(1), unit: '/5' },
      ],
      confidence: 'medium',
      basedOn: `${morningRatings.length} total ratings`,
    });
  }

  return insights;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

function percentileRank(values: number[], target: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter(v => v < target).length;
  return (below / sorted.length) * 100;
}

function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = Math.round(minutes % 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function celsiusToFahrenheit(celsius: number): number {
  return celsius * 9/5 + 32;
}

// ============================================================
// EXPORT METRICS CALCULATORS
// ============================================================

export function getConsistencyMetrics(sessions: SleepSession[]): SleepConsistencyMetrics {
  return calculateConsistencyMetrics(sessions);
}

export function getRecoveryMetrics(sessions: SleepSession[]): RecoveryMetrics | null {
  const hrvValues = sessions
    .filter(s => s.avgHrv && s.avgHrv > 0)
    .map(s => ({ date: s.date, hrv: s.avgHrv! }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (hrvValues.length < 14) return null;

  const allHrv = hrvValues.map(v => v.hrv);
  const baseline = mean(allHrv);
  const recent7 = hrvValues.slice(-7).map(v => v.hrv);
  const previous7 = hrvValues.slice(-14, -7).map(v => v.hrv);

  const recentAvg = mean(recent7);
  const previousAvg = mean(previous7);
  const change = ((recentAvg - previousAvg) / previousAvg) * 100;

  const trend: 'improving' | 'declining' | 'stable' =
    change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable';

  const currentPercentile = percentileRank(allHrv, recentAvg);

  // Count consecutive good/poor nights based on sleep quality (deep + REM percentage)
  let consecutiveGood = 0;
  let consecutivePoor = 0;

  const getQuality = (s: SleepSession) =>
    s.durationSeconds > 0 ? ((s.deepSeconds || 0) + (s.remSeconds || 0)) / s.durationSeconds * 100 : 0;

  for (let i = sessions.length - 1; i >= 0; i--) {
    const quality = getQuality(sessions[i]);
    if (quality >= 45) { // 45% deep+REM is good
      if (consecutivePoor === 0) consecutiveGood++;
      else break;
    } else if (quality < 35) { // Below 35% is poor
      if (consecutiveGood === 0) consecutivePoor++;
      else break;
    } else {
      break;
    }
  }

  const recoveryScore = Math.min(100, Math.round(
    (currentPercentile * 0.5) +
    (trend === 'improving' ? 25 : trend === 'stable' ? 15 : 5) +
    (recentAvg > baseline ? 25 : 15)
  ));

  return {
    currentHrvTrend: trend,
    hrvPercentile: Math.round(currentPercentile),
    restingHrTrend: 'stable', // Simplified
    recoveryScore,
    consecutiveGoodNights: consecutiveGood,
    consecutivePoorNights: consecutivePoor,
  };
}
