/**
 * Health Context Builder
 * =======================
 * Aggregates user health data into a context object for the AI chat.
 */

import { getAll, getSleepSessionsByDateRange, getWorkoutSessionsByDateRange } from '../db/database';
import { generateInsights } from '../insights/insightsEngine';
import type { SleepSession, WorkoutSession } from '../types/schema';
import type { HealthContext, SleepSessionSummary, WorkoutSummary, InsightSummary } from './types';

const DEFAULT_USER_ID = 'local-user';

/**
 * Get date string for N days ago
 */
function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Calculate average of an array, handling empty arrays
 */
function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Safe division to avoid NaN
 */
function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (denominator === 0 || !isFinite(denominator)) return fallback;
  const result = numerator / denominator;
  return isFinite(result) ? result : fallback;
}

/**
 * Determine trend direction based on two averages
 */
function getTrend(recent: number, older: number): 'improving' | 'declining' | 'stable' {
  const diff = recent - older;
  const percentChange = safeDivide(diff, older) * 100;

  if (percentChange > 5) return 'improving';
  if (percentChange < -5) return 'declining';
  return 'stable';
}

/**
 * Convert a SleepSession to a summary for the AI context
 */
function summarizeSleepSession(session: SleepSession): SleepSessionSummary {
  const sleepHours = safeDivide(session.durationSeconds, 3600);
  const deepPercent = safeDivide(session.deepSeconds, session.durationSeconds) * 100;
  const remPercent = safeDivide(session.remSeconds, session.durationSeconds) * 100;

  return {
    date: session.date,
    sleepHours: Math.round(sleepHours * 10) / 10,
    deepPercent: Math.round(deepPercent),
    remPercent: Math.round(remPercent),
    efficiency: session.efficiency ? Math.min(100, Math.round(session.efficiency)) : null,
    restingHR: session.minHeartRate ? Math.round(session.minHeartRate) : null,
    hrv: session.avgHrv ? Math.round(session.avgHrv) : null,
  };
}

/**
 * Convert a WorkoutSession to a summary for the AI context
 */
function summarizeWorkout(workout: WorkoutSession): WorkoutSummary {
  return {
    date: workout.date,
    type: workout.workoutSubtype || workout.workoutType || 'Unknown',
    durationMinutes: Math.round(safeDivide(workout.durationSeconds, 60)),
    calories: workout.calories ? Math.round(workout.calories) : null,
    avgHR: workout.avgHeartRate ? Math.round(workout.avgHeartRate) : null,
  };
}

/**
 * Build the complete health context for AI chat
 */
export async function buildHealthContext(): Promise<HealthContext> {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = getDaysAgo(7);
  const thirtyDaysAgo = getDaysAgo(30);

  // Fetch all data
  const [allSessions, allWorkouts] = await Promise.all([
    getAll('sleepSessions') as Promise<SleepSession[]>,
    getAll('workoutSessions') as Promise<WorkoutSession[]>,
  ]);

  // Sort sessions by date (most recent first for recent nights)
  allSessions.sort((a, b) => b.date.localeCompare(a.date));
  allWorkouts.sort((a, b) => b.date.localeCompare(a.date));

  // Get recent data (last 7 days)
  const recentSessions = allSessions.filter(s => s.date >= sevenDaysAgo);
  const recentWorkouts = allWorkouts.filter(w => w.date >= sevenDaysAgo);

  // Get 30-day data for trends
  const thirtyDaySessions = allSessions.filter(s => s.date >= thirtyDaysAgo);

  // Calculate summary statistics
  const sleepHours = thirtyDaySessions.map(s => safeDivide(s.durationSeconds, 3600));
  const qualityPcts = thirtyDaySessions.map(s =>
    safeDivide(s.deepSeconds + s.remSeconds, s.durationSeconds) * 100
  );
  const hrvValues = thirtyDaySessions
    .filter(s => s.avgHrv && isFinite(s.avgHrv))
    .map(s => s.avgHrv!);
  const hrValues = thirtyDaySessions
    .filter(s => s.minHeartRate && isFinite(s.minHeartRate))
    .map(s => s.minHeartRate!);

  // Calculate trends (compare recent 7 days to previous 7 days)
  const recentSleepAvg = avg(recentSessions.map(s => safeDivide(s.durationSeconds, 3600)));
  const recentQualityAvg = avg(recentSessions.map(s =>
    safeDivide(s.deepSeconds + s.remSeconds, s.durationSeconds) * 100
  ));

  const olderSessions = thirtyDaySessions.filter(s => s.date < sevenDaysAgo && s.date >= getDaysAgo(14));
  const olderSleepAvg = avg(olderSessions.map(s => safeDivide(s.durationSeconds, 3600)));
  const olderQualityAvg = avg(olderSessions.map(s =>
    safeDivide(s.deepSeconds + s.remSeconds, s.durationSeconds) * 100
  ));

  // Generate insights using existing engine
  const insights = generateInsights(
    thirtyDaySessions,
    allWorkouts.filter(w => w.date >= thirtyDaysAgo),
    [], // No morning ratings for now
    { lookbackDays: 30, minSessions: 7 }
  );

  // Build the context object
  const context: HealthContext = {
    summary: {
      totalNights: allSessions.length,
      dateRange: {
        start: allSessions.length > 0 ? allSessions[allSessions.length - 1].date : today,
        end: allSessions.length > 0 ? allSessions[0].date : today,
      },
      avgSleepHours: Math.round(avg(sleepHours) * 10) / 10,
      avgQuality: Math.round(avg(qualityPcts)),
      avgHRV: hrvValues.length > 0 ? Math.round(avg(hrvValues)) : null,
      avgRestingHR: hrValues.length > 0 ? Math.round(avg(hrValues)) : null,
    },
    recentNights: recentSessions.slice(0, 7).map(summarizeSleepSession),
    recentWorkouts: recentWorkouts.slice(0, 7).map(summarizeWorkout),
    insights: insights.slice(0, 5).map((i): InsightSummary => ({
      title: i.title,
      description: i.description,
      priority: i.priority,
    })),
    trends: {
      sleepTrending: getTrend(recentSleepAvg, olderSleepAvg || recentSleepAvg),
      qualityTrending: getTrend(recentQualityAvg, olderQualityAvg || recentQualityAvg),
    },
  };

  return context;
}

/**
 * Build context for a specific date range
 */
export async function buildHealthContextForRange(
  startDate: string,
  endDate: string
): Promise<HealthContext> {
  const sessions = await getSleepSessionsByDateRange(DEFAULT_USER_ID, startDate, endDate);
  const workouts = await getWorkoutSessionsByDateRange(DEFAULT_USER_ID, startDate, endDate);

  sessions.sort((a, b) => b.date.localeCompare(a.date));
  workouts.sort((a, b) => b.date.localeCompare(a.date));

  const sleepHours = sessions.map(s => safeDivide(s.durationSeconds, 3600));
  const qualityPcts = sessions.map(s =>
    safeDivide(s.deepSeconds + s.remSeconds, s.durationSeconds) * 100
  );
  const hrvValues = sessions.filter(s => s.avgHrv).map(s => s.avgHrv!);
  const hrValues = sessions.filter(s => s.minHeartRate).map(s => s.minHeartRate!);

  const insights = generateInsights(sessions, workouts, [], {
    lookbackDays: 90,
    minSessions: Math.min(sessions.length, 7),
  });

  return {
    summary: {
      totalNights: sessions.length,
      dateRange: { start: startDate, end: endDate },
      avgSleepHours: Math.round(avg(sleepHours) * 10) / 10,
      avgQuality: Math.round(avg(qualityPcts)),
      avgHRV: hrvValues.length > 0 ? Math.round(avg(hrvValues)) : null,
      avgRestingHR: hrValues.length > 0 ? Math.round(avg(hrValues)) : null,
    },
    recentNights: sessions.slice(0, 7).map(summarizeSleepSession),
    recentWorkouts: workouts.slice(0, 7).map(summarizeWorkout),
    insights: insights.slice(0, 5).map((i): InsightSummary => ({
      title: i.title,
      description: i.description,
      priority: i.priority,
    })),
    trends: {
      sleepTrending: 'stable',
      qualityTrending: 'stable',
    },
  };
}
