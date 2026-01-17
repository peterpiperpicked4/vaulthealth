/**
 * VaultHealth Dashboard - Precision Observatory Design
 * =====================================================
 * A premium health analytics dashboard with blended multi-source data.
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getAll } from '../db/database';
import type { SleepSession, WorkoutSession, MorningRating } from '../types/schema';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type TimeFilter = 14 | 30 | 90 | 0;

export default function Dashboard() {
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [morningRatings, setMorningRatings] = useState<MorningRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(30);
  const [selectedNight, setSelectedNight] = useState<SleepSession | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [allSessions, allWorkouts, allRatings] = await Promise.all([
        getAll('sleepSessions'),
        getAll('workoutSessions'),
        getAll('morningRatings'),
      ]);
      allSessions.sort((a, b) => a.date.localeCompare(b.date));
      allWorkouts.sort((a, b) => a.date.localeCompare(b.date));
      setSessions(allSessions);
      setWorkouts(allWorkouts);
      setMorningRatings(allRatings as MorningRating[]);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load your health data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }

  // Filter sessions by time range
  const filteredSessions = useMemo(() => {
    if (timeFilter === 0) return sessions;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timeFilter);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return sessions.filter(s => s.date >= cutoffStr);
  }, [sessions, timeFilter]);

  // Get unique data sources
  const dataSources = useMemo(() => {
    const sourceMap = new Map<string, number>();
    for (const s of sessions) {
      const src = getSessionSource(s);
      sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
    }
    return [...sourceMap.entries()].sort((a, b) => b[1] - a[1]);
  }, [sessions]);

  // Calculate stats with safe division
  const stats = useMemo(() => {
    if (filteredSessions.length === 0) return null;

    const sleepHours = filteredSessions.map(s => safeDivide(s.durationSeconds, 3600));
    const deepPcts = filteredSessions.map(s =>
      safeDivide(s.deepSeconds, s.durationSeconds) * 100
    );
    const remPcts = filteredSessions.map(s =>
      safeDivide(s.remSeconds, s.durationSeconds) * 100
    );

    const hrSessions = filteredSessions.filter(s => s.minHeartRate && isFinite(s.minHeartRate));
    const hrvSessions = filteredSessions.filter(s => s.avgHrv && isFinite(s.avgHrv));
    // Filter and clamp efficiency values
    const effSessions = filteredSessions
      .filter(s => s.efficiency !== undefined && s.efficiency !== null)
      .map(s => clampEfficiency(s.efficiency)!);

    return {
      avgSleep: avg(sleepHours),
      avgDeep: avg(deepPcts),
      avgRem: avg(remPcts),
      avgQuality: Math.min(avg(deepPcts) + avg(remPcts), 100), // Cap at 100%
      avgMinHr: hrSessions.length > 0 ? Math.round(avg(hrSessions.map(s => s.minHeartRate!))) : null,
      avgHrv: hrvSessions.length > 0 ? Math.round(avg(hrvSessions.map(s => s.avgHrv!))) : null,
      avgEfficiency: effSessions.length > 0 ? avg(effSessions) : null,
      totalNights: filteredSessions.length,
    };
  }, [filteredSessions]);

  // Workout correlation analysis
  const workoutCorrelation = useMemo(() => {
    if (filteredSessions.length < 7 || workouts.length === 0) return null;

    const workoutDates = new Set(workouts.map(w => w.date));
    const withWorkout: number[] = [];
    const withoutWorkout: number[] = [];

    for (const session of filteredSessions) {
      const quality = session.durationSeconds > 0
        ? ((session.deepSeconds + session.remSeconds) / session.durationSeconds) * 100
        : 0;

      // Check if there was a workout the day of or before this sleep
      const dayBefore = new Date(session.date);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayBeforeStr = dayBefore.toISOString().split('T')[0];

      if (workoutDates.has(session.date) || workoutDates.has(dayBeforeStr)) {
        withWorkout.push(quality);
      } else {
        withoutWorkout.push(quality);
      }
    }

    if (withWorkout.length < 3 || withoutWorkout.length < 3) return null;

    const avgWith = avg(withWorkout);
    const avgWithout = avg(withoutWorkout);
    const diff = avgWith - avgWithout;

    return {
      avgWithWorkout: avgWith,
      avgWithoutWorkout: avgWithout,
      difference: diff,
      percentChange: (diff / avgWithout) * 100,
      workoutDaysCount: withWorkout.length,
      restDaysCount: withoutWorkout.length,
    };
  }, [filteredSessions, workouts]);

  // Workout type breakdown
  const workoutTypes = useMemo(() => {
    const types = new Map<string, number>();
    for (const w of workouts) {
      const type = w.workoutSubtype || w.workoutType || 'Other';
      types.set(type, (types.get(type) || 0) + 1);
    }
    return [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [workouts]);

  if (loading) {
    return (
      <div className="min-h-screen pb-12">
        {/* Skeleton Header */}
        <header className="border-b border-void-700/50 bg-void-900/50 h-14" />
        <main className="max-w-7xl mx-auto px-4 pt-6">
          {/* Skeleton Hero */}
          <section className="grid grid-cols-12 gap-4 mb-6">
            <div className="col-span-12 lg:col-span-3 data-panel p-6 h-40 animate-pulse">
              <div className="h-4 w-20 bg-void-700 rounded mx-auto mb-4" />
              <div className="h-12 w-24 bg-void-700 rounded mx-auto" />
            </div>
            <div className="col-span-12 lg:col-span-9 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="data-panel p-4 animate-pulse">
                  <div className="h-3 w-16 bg-void-700 rounded mb-2" />
                  <div className="h-8 w-12 bg-void-700 rounded" />
                </div>
              ))}
            </div>
          </section>
          {/* Skeleton Timeline */}
          <section className="data-panel mb-6 h-52 animate-pulse">
            <div className="p-4 flex items-end gap-1 h-40">
              {Array.from({ length: 30 }, (_, i) => (
                <div key={i} className="flex-1 bg-void-700 rounded-t" style={{ height: `${30 + Math.random() * 50}%` }} />
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center data-panel p-8 max-w-md">
          <div className="text-coral-400 text-4xl mb-4">⚠</div>
          <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
          <p className="text-zinc-500 mb-6">{error}</p>
          <button
            onClick={loadData}
            className="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 mb-4">No sleep data yet.</p>
          <a href="/import" className="btn btn-primary">Import Data</a>
        </div>
      </div>
    );
  }

  const lastSession = filteredSessions[filteredSessions.length - 1];
  const TIME_FILTER_LABELS: Record<TimeFilter, string> = {
    14: 'Last 14 days',
    30: 'Last 30 days',
    90: 'Last 90 days',
    0: 'All time',
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-cyan-500 focus:text-void-950 focus:rounded-md focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b border-void-700/50 bg-void-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="font-semibold text-white tracking-tight">VaultHealth</h1>
            <nav className="flex gap-1" role="tablist" aria-label="Time range filter">
              {([14, 30, 90, 0] as TimeFilter[]).map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeFilter(days)}
                  role="tab"
                  aria-selected={timeFilter === days}
                  aria-label={TIME_FILTER_LABELS[days]}
                  className={`px-3 py-1.5 text-xs rounded transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1 focus:ring-offset-void-900 ${
                    timeFilter === days
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  {days === 0 ? 'ALL' : `${days}D`}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="hidden sm:inline">{sessions[0]?.date} → {sessions[sessions.length - 1]?.date}</span>
            <span className="badge badge-cyan">{sessions.length} nights</span>
            {workouts.length > 0 && (
              <span className="badge badge-coral">{workouts.length} workouts</span>
            )}
            <Link
              to="/chat"
              className="ml-2 px-3 py-1.5 bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-lg hover:bg-violet-500/30 transition-colors flex items-center gap-1.5"
            >
              <span>Ask AI</span>
              <span className="text-[10px] opacity-75">✨</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-7xl mx-auto px-4 pt-6">
        {/* Hero Section - Key Metrics */}
        <section className="grid grid-cols-12 gap-4 mb-6">
          {/* Sleep Score */}
          <div className="col-span-12 lg:col-span-3 data-panel p-6 flex flex-col items-center justify-center">
            <div className="metric-label mb-2">Last Night</div>
            <div className="metric-value text-cyan-400">
              {lastSession ? (lastSession.durationSeconds / 3600).toFixed(1) : '-'}
              <span className="text-2xl text-zinc-500 ml-1">h</span>
            </div>
            <div className="text-xs text-zinc-500 mt-2">
              {lastSession?.date}
            </div>
            {lastSession && (
              <div className="flex gap-3 mt-4 text-xs">
                <div className="text-center">
                  <div className="text-sleep-deep font-mono font-semibold">
                    {Math.round(lastSession.deepSeconds / 60)}m
                  </div>
                  <div className="text-zinc-600">Deep</div>
                </div>
                <div className="text-center">
                  <div className="text-sleep-rem font-mono font-semibold">
                    {Math.round(lastSession.remSeconds / 60)}m
                  </div>
                  <div className="text-zinc-600">REM</div>
                </div>
                <div className="text-center">
                  <div className="text-zinc-400 font-mono font-semibold">
                    {clampEfficiency(lastSession.efficiency)?.toFixed(0) || '-'}%
                  </div>
                  <div className="text-zinc-600">Eff</div>
                </div>
              </div>
            )}
          </div>

          {/* Vitals Strip */}
          <div className="col-span-12 lg:col-span-9 grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Avg Duration"
              value={stats?.avgSleep.toFixed(1) || '-'}
              unit="h"
              color="cyan"
              subtext={`${stats?.totalNights || 0} nights`}
            />
            <MetricCard
              label="Sleep Quality"
              value={stats?.avgQuality.toFixed(0) || '-'}
              unit="%"
              color="violet"
              subtext="Deep + REM"
            />
            <MetricCard
              label="Resting HR"
              value={stats?.avgMinHr?.toFixed(0) || '-'}
              unit="bpm"
              color="coral"
              subtext="Avg minimum"
            />
            <MetricCard
              label="HRV"
              value={stats?.avgHrv?.toFixed(0) || '-'}
              unit="ms"
              color="emerald"
              subtext="Avg SDNN"
            />
          </div>
        </section>

        {/* Sleep Architecture Timeline - Hero Visual */}
        <section className="data-panel mb-6 overflow-hidden">
          <div className="data-panel-header">
            <div className="data-panel-title">Sleep Architecture</div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-sleep-deep" />
                <span className="text-zinc-500">Deep</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-sleep-rem" />
                <span className="text-zinc-500">REM</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-sleep-light" />
                <span className="text-zinc-500">Light</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-sleep-awake" />
                <span className="text-zinc-500">Awake</span>
              </div>
            </div>
          </div>
          <div className="p-4">
            <SleepTimeline
              sessions={filteredSessions.slice(-30)}
              workouts={workouts}
              onSelect={setSelectedNight}
              selected={selectedNight}
            />
          </div>
        </section>

        {/* Detail Grid */}
        <div className="grid grid-cols-12 gap-4 mb-6">
          {/* Left Column - Selected Night Details or Last 14 */}
          <div className="col-span-12 lg:col-span-7">
            {selectedNight ? (
              <NightDetailPanel
                session={selectedNight}
                workouts={workouts}
                rating={morningRatings.find(r => r.date === selectedNight.date)}
                onClose={() => setSelectedNight(null)}
              />
            ) : (
              <Last14NightsPanel
                sessions={filteredSessions.slice(-14).reverse()}
                workouts={workouts}
                onSelect={setSelectedNight}
              />
            )}
          </div>

          {/* Right Column - Workout & Recovery */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            {/* Workout Correlation */}
            {workoutCorrelation && (
              <div className="data-panel">
                <div className="data-panel-header">
                  <div className="data-panel-title">Workout Impact</div>
                  <span className="badge badge-coral">{workouts.length} sessions</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-center flex-1">
                      <div className="text-2xl font-mono font-semibold text-coral-400">
                        {workoutCorrelation.avgWithWorkout.toFixed(1)}%
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        After workout<br />
                        <span className="text-zinc-600">({workoutCorrelation.workoutDaysCount} nights)</span>
                      </div>
                    </div>
                    <div className="px-4">
                      <div className={`text-sm font-mono font-semibold ${
                        workoutCorrelation.difference > 0 ? 'text-emerald-400' : 'text-coral-400'
                      }`}>
                        {workoutCorrelation.difference > 0 ? '+' : ''}
                        {workoutCorrelation.difference.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-mono font-semibold text-zinc-400">
                        {workoutCorrelation.avgWithoutWorkout.toFixed(1)}%
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Rest days<br />
                        <span className="text-zinc-600">({workoutCorrelation.restDaysCount} nights)</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 text-center border-t border-void-700/50 pt-3">
                    {workoutCorrelation.difference > 2
                      ? '✓ Exercise appears to improve your sleep quality'
                      : workoutCorrelation.difference < -2
                      ? '⚠ Exercise may be disrupting your sleep'
                      : 'Sleep quality similar on workout vs rest days'}
                  </div>
                </div>
              </div>
            )}

            {/* Workout Types */}
            {workoutTypes.length > 0 && (
              <div className="data-panel">
                <div className="data-panel-header">
                  <div className="data-panel-title">Activity Breakdown</div>
                </div>
                <div className="p-4 space-y-2">
                  {workoutTypes.map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-400">{type}</span>
                          <span className="text-xs font-mono text-zinc-500">{count}</span>
                        </div>
                        <div className="h-1.5 bg-void-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-coral-500 to-coral-400 rounded-full"
                            style={{ width: `${(count / workoutTypes[0][1]) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Sources */}
            <div className="data-panel">
              <div className="data-panel-header">
                <div className="data-panel-title">Data Sources</div>
                <span className="badge badge-cyan">{dataSources.length} sources</span>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {dataSources.slice(0, 8).map(([source, count]) => (
                    <div key={source} className="px-2 py-1 bg-void-800 rounded text-xs">
                      <span className="text-zinc-400">{source}</span>
                      <span className="text-zinc-600 ml-1.5">{count}</span>
                    </div>
                  ))}
                  {dataSources.length > 8 && (
                    <div className="px-2 py-1 text-xs text-zinc-600">
                      +{dataSources.length - 8} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trends Chart */}
        <section className="data-panel mb-6">
          <div className="data-panel-header">
            <div className="data-panel-title">Trends</div>
          </div>
          <div className="p-4 h-72">
            <TrendChart sessions={filteredSessions} />
          </div>
        </section>
      </main>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function MetricCard({
  label,
  value,
  unit,
  color,
  subtext,
}: {
  label: string;
  value: string;
  unit: string;
  color: 'cyan' | 'coral' | 'emerald' | 'violet' | 'amber';
  subtext?: string;
}) {
  const colorClasses = {
    cyan: 'text-cyan-400',
    coral: 'text-coral-400',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
    amber: 'text-amber-400',
  };

  return (
    <div className="data-panel p-4">
      <div className="metric-label mb-1">{label}</div>
      <div className={`metric-value-sm ${colorClasses[color]}`}>
        {value}
        <span className="text-sm text-zinc-600 ml-0.5">{unit}</span>
      </div>
      {subtext && <div className="text-xs text-zinc-600 mt-1">{subtext}</div>}
    </div>
  );
}

function SleepTimeline({
  sessions,
  workouts,
  onSelect,
  selected,
}: {
  sessions: SleepSession[];
  workouts: WorkoutSession[];
  onSelect: (s: SleepSession | null) => void;
  selected: SleepSession | null;
}) {
  const workoutDates = new Set(workouts.map(w => w.date));
  const maxDuration = Math.max(...sessions.map(s => s.durationSeconds), 1); // Avoid division by zero
  const MAX_HEIGHT_PX = 144; // 9rem = 144px for the chart area
  const MIN_TOUCH_TARGET = 44; // WCAG 2.5.5 minimum touch target size

  return (
    <div
      className="flex items-end gap-0.5 md:gap-1"
      style={{ height: `${MAX_HEIGHT_PX + 24}px` }} // Extra 24px for labels
      role="group"
      aria-label="Sleep architecture timeline showing sleep stages for recent nights. Use arrow keys to navigate."
    >
      {sessions.map((session, idx) => {
        // Calculate pixel height based on duration
        const totalHeightPx = safeDivide(session.durationSeconds, maxDuration) * MAX_HEIGHT_PX;

        // Calculate stage percentages with safe division
        const deepPct = safeDivide(session.deepSeconds, session.durationSeconds) * 100;
        const remPct = safeDivide(session.remSeconds, session.durationSeconds) * 100;
        const awakePct = safeDivide(session.awakeSeconds, session.durationSeconds) * 100;
        const lightPct = Math.max(0, 100 - deepPct - remPct - awakePct);

        const hasWorkout = workoutDates.has(session.date);
        const isSelected = selected?.id === session.id;

        // Calculate pixel heights for each stage
        const deepPx = (deepPct / 100) * totalHeightPx;
        const remPx = (remPct / 100) * totalHeightPx;
        const lightPx = (lightPct / 100) * totalHeightPx;
        const awakePx = (awakePct / 100) * totalHeightPx;

        return (
          <button
            key={session.id}
            type="button"
            className={`flex-1 flex flex-col items-center cursor-pointer group relative focus:outline-none focus:z-10 ${
              isSelected ? 'z-10' : ''
            }`}
            style={{ minWidth: `${MIN_TOUCH_TARGET}px` }}
            onClick={() => onSelect(isSelected ? null : session)}
            aria-label={`${session.date}: ${(session.durationSeconds / 3600).toFixed(1)} hours sleep, ${deepPct.toFixed(0)}% deep, ${remPct.toFixed(0)}% REM${hasWorkout ? ', workout day' : ''}`}
            aria-pressed={isSelected}
          >
            {/* Invisible expanded touch target for mobile */}
            <span
              className="absolute inset-0 -top-2"
              style={{ minHeight: `${MIN_TOUCH_TARGET}px` }}
              aria-hidden="true"
            />
            <div
              className={`w-full rounded-t transition-all ${
                isSelected
                  ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-void-900'
                  : 'group-hover:ring-1 group-hover:ring-white/30 group-focus:ring-2 group-focus:ring-cyan-400'
              }`}
              style={{ height: `${Math.max(totalHeightPx, 4)}px` }}
            >
              {/* Stacked bar with patterns for color-blind accessibility */}
              <div className="w-full h-full flex flex-col-reverse rounded-t overflow-hidden">
                {/* Deep sleep - solid with horizontal lines pattern */}
                <div
                  className="bg-sleep-deep flex-shrink-0 relative"
                  style={{
                    height: `${deepPx}px`,
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.1) 3px, rgba(255,255,255,0.1) 4px)',
                  }}
                  title={`Deep: ${deepPct.toFixed(0)}%`}
                  aria-hidden="true"
                />
                {/* REM - diagonal stripes pattern */}
                <div
                  className="bg-sleep-rem flex-shrink-0"
                  style={{
                    height: `${remPx}px`,
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)',
                  }}
                  title={`REM: ${remPct.toFixed(0)}%`}
                  aria-hidden="true"
                />
                {/* Light - solid (no pattern needed, neutral gray) */}
                <div
                  className="bg-sleep-light flex-shrink-0"
                  style={{ height: `${lightPx}px` }}
                  title={`Light: ${lightPct.toFixed(0)}%`}
                  aria-hidden="true"
                />
                {/* Awake - dotted pattern */}
                <div
                  className="bg-sleep-awake flex-shrink-0"
                  style={{
                    height: `${awakePx}px`,
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
                    backgroundSize: '4px 4px',
                  }}
                  title={`Awake: ${awakePct.toFixed(0)}%`}
                  aria-hidden="true"
                />
              </div>
            </div>
            {hasWorkout && (
              <div
                className="w-1.5 h-1.5 rounded-full bg-coral-400 mt-1"
                aria-hidden="true"
              />
            )}
            {idx % 5 === 0 && (
              <div className="text-[9px] text-zinc-500 mt-1">
                {session.date.slice(5)}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function NightDetailPanel({
  session,
  workouts,
  rating,
  onClose,
}: {
  session: SleepSession;
  workouts: WorkoutSession[];
  rating?: MorningRating;
  onClose: () => void;
}) {
  const dayWorkouts = workouts.filter(w => w.date === session.date);
  const dayBefore = new Date(session.date);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const prevDayWorkouts = workouts.filter(w => w.date === dayBefore.toISOString().split('T')[0]);
  const allRelevantWorkouts = [...prevDayWorkouts, ...dayWorkouts];

  const sleepHours = safeDivide(session.durationSeconds, 3600);
  const deepPct = safeDivide(session.deepSeconds, session.durationSeconds) * 100;
  const remPct = safeDivide(session.remSeconds, session.durationSeconds) * 100;
  const lightPct = safeDivide(session.lightSeconds, session.durationSeconds) * 100;
  const awakePct = safeDivide(session.awakeSeconds, session.durationSeconds) * 100;

  return (
    <div className="data-panel" role="dialog" aria-labelledby="night-detail-title">
      <div className="data-panel-header">
        <div className="flex items-center gap-3">
          <div id="night-detail-title" className="data-panel-title">Night of {session.date}</div>
          {rating && (
            <span className="badge badge-amber">
              Energy: {rating.energyLevel}/5
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="btn-ghost px-2 py-1 text-xs"
          aria-label="Close night details"
        >
          ✕ Close
        </button>
      </div>
      <div className="p-4">
        {/* Main stats - responsive grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <div className="metric-label">Duration</div>
            <div className="text-2xl font-mono font-semibold text-cyan-400">
              {sleepHours.toFixed(1)}h
            </div>
          </div>
          <div>
            <div className="metric-label">Efficiency</div>
            <div className="text-2xl font-mono font-semibold text-violet-400">
              {clampEfficiency(session.efficiency)?.toFixed(0) || '-'}%
            </div>
          </div>
          <div>
            <div className="metric-label">Resting HR</div>
            <div className="text-2xl font-mono font-semibold text-coral-400">
              {formatHeartRate(session.minHeartRate)}
            </div>
          </div>
          <div>
            <div className="metric-label">HRV</div>
            <div className="text-2xl font-mono font-semibold text-emerald-400">
              {formatHRV(session.avgHrv)}
            </div>
          </div>
        </div>

        {/* Sleep stages bar */}
        <div className="mb-6">
          <div className="metric-label mb-2">Sleep Stages</div>
          <div className="h-8 flex rounded overflow-hidden" role="img" aria-label="Sleep stage breakdown">
            <div className="bg-sleep-deep" style={{ width: `${deepPct}%` }} title={`Deep: ${deepPct.toFixed(0)}%`} />
            <div className="bg-sleep-rem" style={{ width: `${remPct}%` }} title={`REM: ${remPct.toFixed(0)}%`} />
            <div className="bg-sleep-light" style={{ width: `${lightPct}%` }} title={`Light: ${lightPct.toFixed(0)}%`} />
            {awakePct > 0 && (
              <div className="bg-sleep-awake" style={{ width: `${awakePct}%` }} title={`Awake: ${awakePct.toFixed(0)}%`} />
            )}
          </div>
          <div className="flex flex-wrap justify-between mt-2 text-xs gap-2">
            <span className="text-sleep-deep">Deep {deepPct.toFixed(0)}% ({Math.round(session.deepSeconds / 60)}m)</span>
            <span className="text-sleep-rem">REM {remPct.toFixed(0)}% ({Math.round(session.remSeconds / 60)}m)</span>
            <span className="text-zinc-500">Light {lightPct.toFixed(0)}% ({Math.round(session.lightSeconds / 60)}m)</span>
          </div>
        </div>

        {/* Timing */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-void-800 rounded p-3">
            <div className="metric-label">Bedtime</div>
            <div className="text-lg font-mono text-white">
              {new Date(session.startedAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </div>
          </div>
          <div className="bg-void-800 rounded p-3">
            <div className="metric-label">Wake Time</div>
            <div className="text-lg font-mono text-white">
              {new Date(session.endedAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </div>
          </div>
        </div>

        {/* Related workouts */}
        {allRelevantWorkouts.length > 0 && (
          <div>
            <div className="metric-label mb-2">Related Workouts</div>
            <div className="space-y-2">
              {allRelevantWorkouts.map(w => (
                <div key={w.id} className="flex items-center justify-between bg-void-800 rounded p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-coral-400" aria-hidden="true" />
                    <span className="text-zinc-300">{w.workoutSubtype || w.workoutType}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>{Math.round(w.durationSeconds / 60)}min</span>
                    {w.calories && <span>{Math.round(w.calories)} cal</span>}
                    {w.avgHeartRate && <span>{Math.round(w.avgHeartRate)} bpm</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source */}
        <div className="mt-4 pt-4 border-t border-void-700/50 text-xs text-zinc-600">
          Source: {getSessionSource(session)}
        </div>
      </div>
    </div>
  );
}

function Last14NightsPanel({
  sessions,
  workouts,
  onSelect,
}: {
  sessions: SleepSession[];
  workouts: WorkoutSession[];
  onSelect: (s: SleepSession) => void;
}) {
  const workoutDates = new Set(workouts.map(w => w.date));
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="data-panel">
      <div className="data-panel-header">
        <div className="data-panel-title">Recent Nights</div>
        <span className="text-xs text-zinc-600 hidden sm:inline">Click row for details</span>
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full" role="grid" aria-label="Recent sleep sessions">
          <thead>
            <tr className="text-left text-xs text-zinc-600 border-b border-void-700/50">
              <th scope="col" className="px-4 py-3 font-medium">Date</th>
              <th scope="col" className="px-4 py-3 font-medium">Sleep</th>
              <th scope="col" className="px-4 py-3 font-medium">Deep</th>
              <th scope="col" className="px-4 py-3 font-medium">REM</th>
              <th scope="col" className="px-4 py-3 font-medium">Eff</th>
              <th scope="col" className="px-4 py-3 font-medium">HR</th>
              <th scope="col" className="px-4 py-3 font-medium">HRV</th>
              <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Workout</span></th>
            </tr>
          </thead>
          <tbody className="font-mono text-sm">
            {sessions.map((s) => {
              const sleepH = safeDivide(s.durationSeconds, 3600);
              const deepPct = safeDivide(s.deepSeconds, s.durationSeconds) * 100;
              const remPct = safeDivide(s.remSeconds, s.durationSeconds) * 100;
              const date = new Date(s.date);
              const weekday = weekdays[date.getDay()];
              const hasWorkout = workoutDates.has(s.date);
              const efficiency = clampEfficiency(s.efficiency);

              return (
                <tr
                  key={s.id}
                  className="border-b border-void-700/30 hover:bg-void-800/50 cursor-pointer transition-colors focus-within:bg-void-800/50"
                  onClick={() => onSelect(s)}
                  tabIndex={0}
                  role="row"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(s);
                    }
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">{s.date.slice(5)}</span>
                      <span className="text-zinc-600 text-xs">{weekday}</span>
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${sleepH < 6 ? 'text-coral-400' : sleepH < 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {sleepH.toFixed(1)}h
                  </td>
                  <td className={`px-4 py-3 ${deepPct < 15 ? 'text-coral-400' : 'text-sleep-deep'}`}>
                    {deepPct.toFixed(0)}%
                  </td>
                  <td className={`px-4 py-3 ${remPct < 18 ? 'text-coral-400' : 'text-sleep-rem'}`}>
                    {remPct.toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {efficiency?.toFixed(0) || '-'}%
                  </td>
                  <td className={`px-4 py-3 ${s.minHeartRate && s.minHeartRate > 55 ? 'text-coral-400' : 'text-zinc-400'}`}>
                    {formatHeartRate(s.minHeartRate)}
                  </td>
                  <td className={`px-4 py-3 ${s.avgHrv && s.avgHrv < 30 ? 'text-coral-400' : 'text-emerald-400'}`}>
                    {formatHRV(s.avgHrv)}
                  </td>
                  <td className="px-4 py-3">
                    {hasWorkout && (
                      <span className="w-2 h-2 rounded-full bg-coral-400 inline-block" title="Workout day" aria-label="Workout day" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden divide-y divide-void-700/30">
        {sessions.map((s) => {
          const sleepH = safeDivide(s.durationSeconds, 3600);
          const deepPct = safeDivide(s.deepSeconds, s.durationSeconds) * 100;
          const remPct = safeDivide(s.remSeconds, s.durationSeconds) * 100;
          const date = new Date(s.date);
          const weekday = weekdays[date.getDay()];
          const hasWorkout = workoutDates.has(s.date);
          const efficiency = clampEfficiency(s.efficiency);

          return (
            <button
              key={s.id}
              className="w-full p-4 text-left hover:bg-void-800/50 transition-colors"
              onClick={() => onSelect(s)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-mono">{s.date.slice(5)}</span>
                  <span className="text-zinc-600 text-xs">{weekday}</span>
                  {hasWorkout && (
                    <span className="w-2 h-2 rounded-full bg-coral-400 inline-block" />
                  )}
                </div>
                <span className={`font-mono font-semibold ${sleepH < 6 ? 'text-coral-400' : sleepH < 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {sleepH.toFixed(1)}h
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <div className="text-zinc-600">Deep</div>
                  <div className={`font-mono ${deepPct < 15 ? 'text-coral-400' : 'text-sleep-deep'}`}>
                    {deepPct.toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div className="text-zinc-600">REM</div>
                  <div className={`font-mono ${remPct < 18 ? 'text-coral-400' : 'text-sleep-rem'}`}>
                    {remPct.toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div className="text-zinc-600">Eff</div>
                  <div className="font-mono text-zinc-400">{efficiency?.toFixed(0) || '-'}%</div>
                </div>
                <div>
                  <div className="text-zinc-600">HR</div>
                  <div className="font-mono text-zinc-400">{formatHeartRate(s.minHeartRate)}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TrendChart({ sessions }: { sessions: SleepSession[] }) {
  // Calculate dynamic ranges from data
  const sleepHours = sessions.map(s => safeDivide(s.durationSeconds, 3600));
  const qualityPcts = sessions.map(s => {
    const q = safeDivide(s.deepSeconds + s.remSeconds, s.durationSeconds) * 100;
    return Math.min(q, 100); // Cap quality at 100%
  });

  // Dynamic Y-axis ranges with padding
  const minSleep = Math.max(0, Math.floor(Math.min(...sleepHours) - 1));
  const maxSleep = Math.ceil(Math.max(...sleepHours) + 1);
  const minQuality = Math.max(0, Math.floor(Math.min(...qualityPcts) - 5));
  const maxQuality = Math.min(100, Math.ceil(Math.max(...qualityPcts) + 5));

  // Theme colors matching tailwind config
  const COLORS = {
    cyan: { main: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
    violet: { main: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    zinc: { label: '#71717a', tick: '#52525b', grid: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.05)' },
  };

  const data = {
    labels: sessions.map(s => s.date.slice(5)),
    datasets: [
      {
        label: 'Sleep (h)',
        data: sleepHours.map(h => h.toFixed(2)),
        borderColor: COLORS.cyan.main,
        backgroundColor: COLORS.cyan.bg,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
      {
        label: 'Quality (%)',
        data: qualityPcts.map(q => q.toFixed(1)),
        borderColor: COLORS.violet.main,
        backgroundColor: COLORS.violet.bg,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          color: COLORS.zinc.label,
          boxWidth: 12,
          boxHeight: 12,
          padding: 16,
          font: { size: 11, family: 'JetBrains Mono' },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (label.includes('Sleep')) return `${label}: ${value}h`;
            return `${label}: ${value}%`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: COLORS.zinc.tick, maxTicksLimit: 10, font: { size: 10 } },
        grid: { color: COLORS.zinc.grid },
        border: { color: COLORS.zinc.border },
      },
      y: {
        min: minSleep,
        max: maxSleep,
        position: 'left' as const,
        ticks: { color: COLORS.cyan.main, font: { size: 10 } },
        grid: { color: COLORS.zinc.grid },
        border: { color: COLORS.zinc.border },
        title: {
          display: true,
          text: 'Hours',
          color: COLORS.cyan.main,
          font: { size: 10 },
        },
      },
      y1: {
        min: minQuality,
        max: maxQuality,
        position: 'right' as const,
        ticks: { color: COLORS.violet.main, font: { size: 10 } },
        grid: { drawOnChartArea: false },
        border: { color: COLORS.zinc.border },
        title: {
          display: true,
          text: 'Quality %',
          color: COLORS.violet.main,
          font: { size: 10 },
        },
      },
    },
  };

  return <Line data={data} options={options} />;
}

// ============================================================
// UTILITIES
// ============================================================

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// Clamp efficiency to valid range (0-100%)
function clampEfficiency(efficiency: number | undefined | null): number | null {
  if (efficiency === undefined || efficiency === null) return null;
  return Math.max(0, Math.min(100, efficiency));
}

// Round heart rate to integer
function formatHeartRate(hr: number | undefined | null): string {
  if (hr === undefined || hr === null) return '-';
  return Math.round(hr).toString();
}

// Get source from session with fallback chain
function getSessionSource(session: SleepSession): string {
  return (session.vendorData?.source as string)
    || (session as any).vendor
    || 'Unknown Source';
}

// Format HRV value
function formatHRV(hrv: number | undefined | null): string {
  if (hrv === undefined || hrv === null) return '-';
  return Math.round(hrv).toString();
}

// Safe division to avoid NaN/Infinity
function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (denominator === 0 || !isFinite(denominator)) return fallback;
  const result = numerator / denominator;
  return isFinite(result) ? result : fallback;
}
