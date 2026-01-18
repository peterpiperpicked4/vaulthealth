/**
 * SettingsPanel Component
 * ========================
 * Condensed settings for overlay panel.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getStorageEstimate, deleteDatabase, exportAllData, count } from '../../db/database';

interface SettingsPanelProps {
  onClose?: () => void;
}

export function SettingsPanel({ onClose: _onClose }: SettingsPanelProps) {
  const [storageInfo, setStorageInfo] = useState<{
    usage: number;
    quota: number;
    percentUsed: number;
  } | null>(null);
  const [recordCounts, setRecordCounts] = useState({
    sleepSessions: 0,
    workoutSessions: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadInfo();
  }, []);

  async function loadInfo() {
    const storage = await getStorageEstimate();
    setStorageInfo(storage);

    const [sleepCount, workoutCount] = await Promise.all([
      count('sleepSessions'),
      count('workoutSessions'),
    ]);

    setRecordCounts({
      sleepSessions: sleepCount,
      workoutSessions: workoutCount,
    });
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaulthealth-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDelete() {
    await deleteDatabase();
    window.location.reload();
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-6">
      {/* Data Summary */}
      <section>
        <h3 className="text-sm font-medium text-white mb-3">Your Data</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-void-800">
            <div className="text-2xl font-mono text-cyan-400">{recordCounts.sleepSessions}</div>
            <div className="text-xs text-zinc-500">Sleep Sessions</div>
          </div>
          <div className="p-3 rounded-lg bg-void-800">
            <div className="text-2xl font-mono text-coral-400">{recordCounts.workoutSessions}</div>
            <div className="text-xs text-zinc-500">Workouts</div>
          </div>
        </div>
      </section>

      {/* Storage */}
      {storageInfo && (
        <section>
          <h3 className="text-sm font-medium text-white mb-3">Storage</h3>
          <div className="p-3 rounded-lg bg-void-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-500">Used</span>
              <span className="text-white">
                {formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}
              </span>
            </div>
            <div className="h-1.5 bg-void-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-cyan-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(storageInfo.percentUsed, 100)}%` }}
              />
            </div>
            <p className="text-xs text-zinc-600 mt-2">
              {storageInfo.percentUsed.toFixed(1)}% used
            </p>
          </div>
        </section>
      )}

      {/* Export */}
      <section>
        <h3 className="text-sm font-medium text-white mb-3">Export Data</h3>
        <p className="text-sm text-zinc-500 mb-3">
          Download all your data as a JSON file for backup.
        </p>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full py-2.5 px-4 rounded-lg bg-void-700 text-white text-sm font-medium
                     hover:bg-void-600 transition-colors disabled:opacity-50"
        >
          {isExporting ? 'Exporting...' : 'Export All Data'}
        </button>
      </section>

      {/* Privacy */}
      <section>
        <h3 className="text-sm font-medium text-white mb-3">Privacy</h3>
        <div className="space-y-2 text-sm text-zinc-500">
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">✓</span>
            <span>All data stored locally in your browser</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">✓</span>
            <span>Nothing sent to any server</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">✓</span>
            <span>No tracking or analytics</span>
          </div>
        </div>
      </section>

      {/* Delete Data */}
      <section>
        <h3 className="text-sm font-medium text-coral-400 mb-3">Danger Zone</h3>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-2.5 px-4 rounded-lg bg-coral-500/10 text-coral-400 text-sm font-medium
                       border border-coral-500/20 hover:bg-coral-500/20 transition-colors"
          >
            Delete All Data
          </button>
        ) : (
          <div className="p-3 rounded-lg bg-coral-500/10 border border-coral-500/20">
            <p className="text-sm text-white mb-3">
              This will permanently delete all your data. Are you sure?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 py-2 rounded bg-coral-500 text-white text-sm font-medium
                           hover:bg-coral-400 transition-colors"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded bg-void-700 text-white text-sm
                           hover:bg-void-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* About */}
      <section className="text-center pt-4 border-t border-void-700">
        <p className="text-xs text-zinc-600">
          VaultHealth v0.2.0<br />
          Built with privacy in mind
        </p>
      </section>
    </div>
  );
}
