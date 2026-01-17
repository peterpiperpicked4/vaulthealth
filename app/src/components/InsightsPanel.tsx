/**
 * InsightsPanel Component
 * =======================
 * Displays actionable insights and recommendations based on sleep data.
 */

import { useMemo, useState, useEffect } from 'react';
import type { SleepSession, WorkoutSession, MorningRating } from '../types/schema';
import { getAll } from '../db/database';
import {
  generateInsights,
  getConsistencyMetrics,
  getRecoveryMetrics,
  type Insight,
  type InsightCategory,
} from '../insights/insightsEngine';

interface InsightsPanelProps {
  sleepSessions: SleepSession[];
  workoutSessions?: WorkoutSession[];
  morningRatings?: MorningRating[];
}

const categoryIcons: Record<InsightCategory, string> = {
  consistency: '🕐',
  duration: '⏱️',
  quality: '✨',
  recovery: '💚',
  stages: '🌙',
  temperature: '🌡️',
  trend: '📈',
  correlation: '🔗',
  subjective: '☀️',
};

const categoryColors: Record<InsightCategory, string> = {
  consistency: 'border-purple-500/50 bg-purple-500/10',
  duration: 'border-blue-500/50 bg-blue-500/10',
  quality: 'border-yellow-500/50 bg-yellow-500/10',
  recovery: 'border-green-500/50 bg-green-500/10',
  stages: 'border-indigo-500/50 bg-indigo-500/10',
  temperature: 'border-orange-500/50 bg-orange-500/10',
  trend: 'border-cyan-500/50 bg-cyan-500/10',
  correlation: 'border-pink-500/50 bg-pink-500/10',
  subjective: 'border-amber-500/50 bg-amber-500/10',
};

const priorityStyles = {
  high: 'ring-2 ring-red-500/50',
  medium: '',
  low: 'opacity-90',
};

export default function InsightsPanel({ sleepSessions, workoutSessions = [], morningRatings: propRatings }: InsightsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [morningRatings, setMorningRatings] = useState<MorningRating[]>(propRatings || []);

  // Load morning ratings from database if not provided via props
  useEffect(() => {
    if (!propRatings) {
      getAll('morningRatings').then((ratings) => {
        setMorningRatings(ratings as MorningRating[]);
      });
    }
  }, [propRatings]);

  const insights = useMemo(
    () => generateInsights(sleepSessions, workoutSessions, morningRatings, { lookbackDays: 90, minSessions: 14 }),
    [sleepSessions, workoutSessions, morningRatings]
  );

  const consistencyMetrics = useMemo(
    () => sleepSessions.length >= 14 ? getConsistencyMetrics(sleepSessions) : null,
    [sleepSessions]
  );

  const recoveryMetrics = useMemo(
    () => getRecoveryMetrics(sleepSessions),
    [sleepSessions]
  );

  const displayedInsights = showAll ? insights : insights.slice(0, 4);
  const hasMore = insights.length > 4;

  if (sleepSessions.length < 14) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          💡 Insights & Recommendations
        </h2>
        <div className="text-slate-400 text-center py-8">
          <div className="text-4xl mb-3">📊</div>
          <p>Need at least 14 sleep sessions to generate personalized insights.</p>
          <p className="text-sm mt-2">You have {sleepSessions.length} sessions. Import more data to unlock insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          💡 Insights & Recommendations
        </h2>
        {consistencyMetrics && recoveryMetrics && (
          <div className="flex gap-4 text-sm">
            <ScoreBadge
              label="Consistency"
              value={consistencyMetrics.overallConsistencyScore}
              color="purple"
            />
            <ScoreBadge
              label="Recovery"
              value={recoveryMetrics.recoveryScore}
              color={recoveryMetrics.currentHrvTrend === 'improving' ? 'green' :
                     recoveryMetrics.currentHrvTrend === 'declining' ? 'red' : 'yellow'}
            />
          </div>
        )}
      </div>

      {/* Insights Grid */}
      <div className="grid gap-3">
        {displayedInsights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            isExpanded={expandedId === insight.id}
            onToggle={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
          />
        ))}
      </div>

      {/* Show More Button */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-4 w-full py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          {showAll ? 'Show Less' : `Show ${insights.length - 4} More Insights`}
        </button>
      )}

      {/* Context Hint */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          💡 <strong>Want more accurate insights?</strong>
          {morningRatings.length < 7
            ? ` Log your morning energy daily (${morningRatings.length}/7 ratings) to unlock personalized energy correlations.`
            : ' Import workout data (Orangetheory, etc.) to see sleep ↔ exercise correlations.'
          }
        </p>
      </div>
    </div>
  );
}

interface InsightCardProps {
  insight: Insight;
  isExpanded: boolean;
  onToggle: () => void;
}

function InsightCard({ insight, isExpanded, onToggle }: InsightCardProps) {
  return (
    <div
      className={`
        border rounded-lg p-4 cursor-pointer transition-all
        ${categoryColors[insight.category]}
        ${priorityStyles[insight.priority]}
        hover:border-opacity-80
      `}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{categoryIcons[insight.category]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium">{insight.title}</h3>
            {insight.priority === 'high' && (
              <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                Important
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded ${
              insight.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
              insight.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-slate-500/20 text-slate-400'
            }`}>
              {insight.confidence} confidence
            </span>
          </div>
          <p className="text-sm text-slate-300">{insight.description}</p>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="mt-3 space-y-3">
              {/* Data Points */}
              {insight.dataPoints && insight.dataPoints.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {insight.dataPoints.map((dp, i) => (
                    <div key={i} className="bg-slate-900/50 rounded px-3 py-1.5">
                      <div className="text-xs text-slate-400">{dp.label}</div>
                      <div className="font-mono font-semibold">
                        {dp.value}{dp.unit && <span className="text-slate-400 text-sm"> {dp.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendation */}
              {insight.recommendation && (
                <div className="bg-slate-900/50 rounded p-3 border-l-2 border-cyan-500">
                  <div className="text-xs text-cyan-400 font-medium mb-1">Recommendation</div>
                  <p className="text-sm">{insight.recommendation}</p>
                </div>
              )}

              {/* Data Source */}
              <p className="text-xs text-slate-500">
                Based on: {insight.basedOn}
              </p>
            </div>
          )}
        </div>
        <div className="text-slate-500">
          {isExpanded ? '▲' : '▼'}
        </div>
      </div>
    </div>
  );
}

interface ScoreBadgeProps {
  label: string;
  value: number;
  color: 'purple' | 'green' | 'red' | 'yellow';
}

function ScoreBadge({ label, value, color }: ScoreBadgeProps) {
  const colorClasses = {
    purple: 'text-purple-400',
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{label}:</span>
      <span className={`font-mono font-semibold ${colorClasses[color]}`}>
        {value}
      </span>
    </div>
  );
}
