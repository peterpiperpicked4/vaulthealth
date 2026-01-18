/**
 * Proactive Greeting Builder
 * ===========================
 * Generates personalized AI greetings based on recent health data.
 */

import { getAll } from '../db/database';
import type { SleepSession } from '../types/schema';
import type { Visualization, SleepStackData, TrendDataPoint } from './types';

interface GreetingContext {
  greeting: string;
  visualizations: Visualization[];
  hasData: boolean;
}

/**
 * Get time-appropriate greeting
 */
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

/**
 * Calculate average of values
 */
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Safe division
 */
function safeDivide(a: number, b: number): number {
  if (b === 0) return 0;
  return a / b;
}

/**
 * Build proactive greeting context based on user's health data
 */
export async function buildProactiveGreeting(): Promise<GreetingContext> {
  try {
    const allSessions = await getAll('sleepSessions') as SleepSession[];

    if (allSessions.length === 0) {
      return {
        greeting: `${getTimeGreeting()}. I don't see any sleep data yet. Would you like to import some data to get started?`,
        visualizations: [],
        hasData: false,
      };
    }

    // Sort by date descending
    allSessions.sort((a, b) => b.date.localeCompare(a.date));

    const lastNight = allSessions[0];
    const lastWeek = allSessions.slice(0, 7);
    const previousWeek = allSessions.slice(7, 14);

    // Calculate last night's metrics
    const sleepHours = safeDivide(lastNight.durationSeconds, 3600);
    const deepPercent = Math.round(safeDivide(lastNight.deepSeconds, lastNight.durationSeconds) * 100);
    const remPercent = Math.round(safeDivide(lastNight.remSeconds, lastNight.durationSeconds) * 100);
    const lightPercent = Math.round(safeDivide(lastNight.lightSeconds, lastNight.durationSeconds) * 100);
    const awakePercent = Math.max(0, 100 - deepPercent - remPercent - lightPercent);
    const qualityPercent = deepPercent + remPercent;

    // Calculate 7-day averages
    const avgSleepHours = avg(lastWeek.map(s => safeDivide(s.durationSeconds, 3600)));

    // Compare to previous week (if available)
    let weekComparison = '';
    if (previousWeek.length >= 7) {
      const prevAvgSleep = avg(previousWeek.map(s => safeDivide(s.durationSeconds, 3600)));
      const sleepDiff = avgSleepHours - prevAvgSleep;
      if (Math.abs(sleepDiff) > 0.3) {
        weekComparison = sleepDiff > 0
          ? ` You're sleeping ${Math.abs(sleepDiff).toFixed(1)} hours more on average than last week.`
          : ` You're sleeping ${Math.abs(sleepDiff).toFixed(1)} hours less on average than last week.`;
      }
    }

    // Determine if this was a good night
    const isGoodNight = sleepHours >= 7 && deepPercent >= 15;
    const isGreatNight = sleepHours >= 7.5 && deepPercent >= 20;

    // Find best deep sleep in past 14 days
    const bestDeepNight = [...allSessions].slice(0, 14)
      .sort((a, b) =>
        safeDivide(b.deepSeconds, b.durationSeconds) - safeDivide(a.deepSeconds, a.durationSeconds)
      )[0];
    const isBestDeep = bestDeepNight?.id === lastNight.id && deepPercent >= 20;

    // Build greeting message
    let greeting = `${getTimeGreeting()}. `;

    if (isBestDeep) {
      greeting += `Last night you slept ${sleepHours.toFixed(1)} hours with ${deepPercent}% deep sleep — your best in two weeks.`;
    } else if (isGreatNight) {
      greeting += `Last night was a great night! You got ${sleepHours.toFixed(1)} hours of sleep with ${deepPercent}% deep and ${remPercent}% REM.`;
    } else if (isGoodNight) {
      greeting += `You slept ${sleepHours.toFixed(1)} hours last night with ${deepPercent}% deep sleep and ${remPercent}% REM.`;
    } else if (sleepHours < 6) {
      greeting += `You only got ${sleepHours.toFixed(1)} hours of sleep last night. That's below your usual. Is everything okay?`;
    } else if (deepPercent < 15) {
      greeting += `You slept ${sleepHours.toFixed(1)} hours, but your deep sleep was only ${deepPercent}%. Let's look at what might help improve that.`;
    } else {
      greeting += `Last night: ${sleepHours.toFixed(1)} hours of sleep with ${qualityPercent}% quality (deep + REM).`;
    }

    greeting += weekComparison;

    // Build visualizations
    const visualizations: Visualization[] = [];

    // Add sleep stack for last night
    const sleepStackData: SleepStackData = {
      deepPercent,
      remPercent,
      lightPercent,
      awakePercent,
      totalHours: sleepHours,
    };

    visualizations.push({
      type: 'sleep-stack',
      date: lastNight.date,
      data: sleepStackData,
    });

    // Add trend if we have enough data
    if (lastWeek.length >= 5) {
      const trendData: TrendDataPoint[] = lastWeek
        .slice(0, 7)
        .reverse()
        .map(s => ({
          date: s.date,
          value: safeDivide(s.durationSeconds, 3600),
        }));

      visualizations.push({
        type: 'trend',
        metric: 'sleep',
        days: 7,
        data: trendData,
      });
    }

    return {
      greeting,
      visualizations,
      hasData: true,
    };
  } catch (error) {
    console.error('Failed to build proactive greeting:', error);
    return {
      greeting: `${getTimeGreeting()}. I'm ready to help you understand your health data. What would you like to know?`,
      visualizations: [],
      hasData: false,
    };
  }
}
