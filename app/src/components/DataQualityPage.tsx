/**
 * Data Quality Page
 * ==================
 * Shows data quality assessment, outliers, and allows excluding bad data.
 */

import { useState, useEffect, useMemo } from 'react';
import { getAll, put } from '../db/database';
import { assessDataQuality, type DataQualitySummary } from '../insights/dataQuality';
import type { SleepSession } from '../types/schema';

export default function DataQualityPage() {
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [qualitySummary, setQualitySummary] = useState<DataQualitySummary | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const allSessions = await getAll('sleepSessions');
    allSessions.sort((a, b) => a.date.localeCompare(b.date));
    setSessions(allSessions);

    if (allSessions.length > 0) {
      const summary = assessDataQuality(allSessions);
      setQualitySummary(summary);
    }

    setLoading(false);
  }

  // Sessions with quality issues
  const flaggedSessions = useMemo(() => {
    return sessions.filter(s =>
      s.dataQuality.hasOutliers ||
      !s.dataQuality.isComplete ||
      s.dataQuality.manuallyExcluded
    );
  }, [sessions]);

  async function toggleExclusion(session: SleepSession) {
    const updated = {
      ...session,
      dataQuality: {
        ...session.dataQuality,
        manuallyExcluded: !session.dataQuality.manuallyExcluded,
        exclusionReason: session.dataQuality.manuallyExcluded ? undefined : 'Manually excluded',
      },
    };

    await put('sleepSessions', updated);
    await loadData(); // Refresh
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Analyzing data quality...</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">No data to analyze. Import some data first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Data Quality</h2>
        <p className="text-gray-500">
          Review data quality issues and exclude problematic records from baselines.
        </p>
      </div>

      {/* Quality Summary */}
      {qualitySummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card text-center">
            <div className="text-3xl font-bold text-white">
              {qualitySummary.totalSessions}
            </div>
            <div className="text-sm text-gray-500">Total Sessions</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-green-400">
              {qualitySummary.goodSessions}
            </div>
            <div className="text-sm text-gray-500">Good Quality</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-yellow-400">
              {qualitySummary.warningSessions}
            </div>
            <div className="text-sm text-gray-500">Warnings</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-red-400">
              {qualitySummary.badSessions}
            </div>
            <div className="text-sm text-gray-500">Needs Review</div>
          </div>
        </div>
      )}

      {/* Baselines */}
      {qualitySummary && (
        <div className="card mb-8">
          <h3 className="font-semibold text-white mb-4">Your Baselines (Last 90 Days)</h3>
          <p className="text-sm text-gray-500 mb-4">
            These are your personal "normal" ranges. Values outside these may indicate issues or real changes.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Object.entries(qualitySummary.baselines).map(([metric, baseline]) => (
              <BaselineCard key={metric} metric={metric} baseline={baseline} />
            ))}
          </div>
        </div>
      )}

      {/* Common Issues */}
      {qualitySummary && qualitySummary.commonIssues.length > 0 && (
        <div className="card mb-8">
          <h3 className="font-semibold text-white mb-4">Common Issues Found</h3>
          <div className="space-y-2">
            {qualitySummary.commonIssues.map((issue, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{formatIssue(issue.issue)}</span>
                <span className="text-gray-500">{issue.count} occurrences</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {qualitySummary && qualitySummary.recommendations.length > 0 && (
        <div className="card mb-8 border-yellow-500/30 bg-yellow-500/5">
          <h3 className="font-semibold text-yellow-400 mb-4">Recommendations</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            {qualitySummary.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Flagged Sessions */}
      {flaggedSessions.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-white mb-4">
            Sessions Needing Review ({flaggedSessions.length})
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            These sessions have quality issues. You can exclude them from baseline calculations.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-white/10">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Issues</th>
                  <th className="text-right py-2">Sleep</th>
                  <th className="text-right py-2">Min HR</th>
                  <th className="text-right py-2">HRV</th>
                  <th className="text-center py-2">Status</th>
                  <th className="text-right py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {flaggedSessions.slice(0, 50).map((s) => (
                  <tr key={s.id} className={`border-t border-white/5 ${s.dataQuality.manuallyExcluded ? 'opacity-50' : ''}`}>
                    <td className="py-2">{s.date}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {s.dataQuality.outlierFields.map((f) => (
                          <span key={f} className="tag tag-negative text-xs">
                            {formatField(f)}
                          </span>
                        ))}
                        {!s.dataQuality.isComplete && (
                          <span className="tag tag-neutral text-xs">Incomplete</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      {(s.durationSeconds / 3600).toFixed(1)}h
                    </td>
                    <td className="py-2 text-right">
                      {s.minHeartRate || '-'}
                    </td>
                    <td className="py-2 text-right">
                      {s.avgHrv?.toFixed(0) || '-'}
                    </td>
                    <td className="py-2 text-center">
                      {s.dataQuality.manuallyExcluded ? (
                        <span className="text-gray-500">Excluded</span>
                      ) : (
                        <span className="text-yellow-400">Active</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => toggleExclusion(s)}
                        className="text-xs btn btn-secondary py-1 px-2"
                      >
                        {s.dataQuality.manuallyExcluded ? 'Include' : 'Exclude'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {flaggedSessions.length > 50 && (
              <p className="text-sm text-gray-500 mt-4">
                Showing first 50 of {flaggedSessions.length} flagged sessions.
              </p>
            )}
          </div>
        </div>
      )}

      {flaggedSessions.length === 0 && (
        <div className="card text-center py-8">
          <div className="text-4xl mb-4">✨</div>
          <h3 className="font-semibold text-white mb-2">Great Data Quality!</h3>
          <p className="text-gray-400">No sessions are currently flagged for review.</p>
        </div>
      )}

      {/* Explanation */}
      <div className="mt-8 disclaimer">
        <strong>How we detect issues:</strong> We use robust statistics (median and MAD)
        to establish your personal baselines. Values more than 3.5 MAD from your median
        are flagged as potential outliers. Hard limits also catch biologically impossible
        values (e.g., HRV &gt; 300ms, HR &lt; 25bpm).
      </div>
    </div>
  );
}

function BaselineCard({
  metric,
  baseline,
}: {
  metric: string;
  baseline: { median: number; mad: number; low: number; high: number; sampleSize: number; excludedCount: number };
}) {
  const labels: Record<string, string> = {
    sleepHours: 'Sleep Duration',
    minHeartRate: 'Min Heart Rate',
    avgHrv: 'HRV',
    avgRespiratoryRate: 'Respiratory Rate',
    durationSeconds: 'Duration',
  };

  const units: Record<string, string> = {
    sleepHours: 'h',
    minHeartRate: 'bpm',
    avgHrv: 'ms',
    avgRespiratoryRate: 'br/min',
    durationSeconds: 's',
  };

  return (
    <div className="text-center">
      <div className="text-sm text-gray-500 mb-1">{labels[metric] || metric}</div>
      <div className="text-xl font-bold text-white">
        {baseline.median.toFixed(1)}
        <span className="text-sm text-gray-500">{units[metric] || ''}</span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        Range: {baseline.low.toFixed(1)} - {baseline.high.toFixed(1)}
      </div>
      <div className="text-xs text-gray-600">
        n={baseline.sampleSize}
        {baseline.excludedCount > 0 && (
          <span className="text-yellow-500"> ({baseline.excludedCount} excluded)</span>
        )}
      </div>
    </div>
  );
}

function formatField(field: string): string {
  const map: Record<string, string> = {
    avgHrv: 'HRV',
    minHeartRate: 'Min HR',
    maxHeartRate: 'Max HR',
    avgRespiratoryRate: 'RR',
    durationSeconds: 'Duration',
    deepPercent: 'Deep %',
    remPercent: 'REM %',
  };
  return map[field] || field;
}

function formatIssue(issue: string): string {
  return issue
    .replace('avgHrv', 'HRV')
    .replace('minHeartRate', 'Min HR')
    .replace('durationSeconds', 'Duration')
    .replace('_', ' ');
}
