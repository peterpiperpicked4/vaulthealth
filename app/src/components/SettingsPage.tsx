/**
 * Settings Page
 * ==============
 * User preferences and data management.
 */

import { useState, useEffect } from 'react';
import { getStorageEstimate, deleteDatabase, exportAllData, count } from '../db/database';

export default function SettingsPage() {
  const [storageInfo, setStorageInfo] = useState<{
    usage: number;
    quota: number;
    percentUsed: number;
  } | null>(null);
  const [recordCounts, setRecordCounts] = useState<{
    sleepSessions: number;
    workoutSessions: number;
    sources: number;
  }>({ sleepSessions: 0, workoutSessions: 0, sources: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadInfo();
  }, []);

  async function loadInfo() {
    const storage = await getStorageEstimate();
    setStorageInfo(storage);

    const [sleepCount, workoutCount, sourceCount] = await Promise.all([
      count('sleepSessions'),
      count('workoutSessions'),
      count('sources'),
    ]);

    setRecordCounts({
      sleepSessions: sleepCount,
      workoutSessions: workoutCount,
      sources: sourceCount,
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
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
        <p className="text-gray-500">Manage your data and preferences.</p>
      </div>

      {/* Storage Info */}
      <div className="card mb-6">
        <h3 className="font-semibold text-white mb-4">Storage</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">Sleep Sessions</div>
            <div className="text-2xl font-bold text-white">{recordCounts.sleepSessions}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Workout Sessions</div>
            <div className="text-2xl font-bold text-white">{recordCounts.workoutSessions}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Import Sources</div>
            <div className="text-2xl font-bold text-white">{recordCounts.sources}</div>
          </div>
        </div>

        {storageInfo && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Storage Used</span>
              <span className="text-white">
                {formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500"
                style={{ width: `${Math.min(storageInfo.percentUsed, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {storageInfo.percentUsed.toFixed(1)}% of available storage used
            </p>
          </div>
        )}
      </div>

      {/* Export */}
      <div className="card mb-6">
        <h3 className="font-semibold text-white mb-4">Export Data</h3>
        <p className="text-sm text-gray-400 mb-4">
          Download all your data as a JSON file. You can use this to back up your data
          or import it into another instance.
        </p>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="btn btn-secondary"
        >
          {isExporting ? 'Exporting...' : '📥 Export All Data'}
        </button>
      </div>

      {/* Preferences */}
      <div className="card mb-6">
        <h3 className="font-semibold text-white mb-4">Preferences</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white">Sleep Target</div>
              <div className="text-sm text-gray-500">
                Hours of sleep you aim for each night
              </div>
            </div>
            <select className="input w-24">
              <option value="7">7.0h</option>
              <option value="7.5" selected>7.5h</option>
              <option value="8">8.0h</option>
              <option value="8.5">8.5h</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-white">Outlier Sensitivity</div>
              <div className="text-sm text-gray-500">
                How aggressive to be in flagging outliers
              </div>
            </div>
            <select className="input w-32">
              <option value="2">High (2 MAD)</option>
              <option value="3" selected>Medium (3 MAD)</option>
              <option value="4">Low (4 MAD)</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Note: Preference saving is not yet implemented. Coming soon!
        </p>
      </div>

      {/* Privacy Info */}
      <div className="card mb-6">
        <h3 className="font-semibold text-white mb-4">🔒 Privacy</h3>

        <div className="space-y-3 text-sm text-gray-400">
          <p>
            <strong className="text-white">100% Local:</strong> All your data is stored
            in your browser's IndexedDB. Nothing is sent to any server.
          </p>
          <p>
            <strong className="text-white">Your Data, Your Control:</strong> You can export
            or delete all your data at any time.
          </p>
          <p>
            <strong className="text-white">No Tracking:</strong> We don't use cookies,
            analytics, or any form of tracking.
          </p>
        </div>
      </div>

      {/* Delete Data */}
      <div className="card border-red-500/30">
        <h3 className="font-semibold text-red-400 mb-4">Danger Zone</h3>

        {!showDeleteConfirm ? (
          <div>
            <p className="text-sm text-gray-400 mb-4">
              Delete all data from this browser. This cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
            >
              Delete All Data
            </button>
          </div>
        ) : (
          <div className="bg-red-500/10 p-4 rounded-lg">
            <p className="text-white mb-4">
              Are you sure? This will permanently delete:
            </p>
            <ul className="text-sm text-gray-400 mb-4 space-y-1">
              <li>• {recordCounts.sleepSessions} sleep sessions</li>
              <li>• {recordCounts.workoutSessions} workout sessions</li>
              <li>• All computed insights and baselines</li>
              <li>• All import history</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="btn bg-red-500 text-white hover:bg-red-600"
              >
                Yes, Delete Everything
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* About */}
      <div className="card mt-6">
        <h3 className="font-semibold text-white mb-4">About VaultHealth</h3>
        <p className="text-sm text-gray-400 mb-4">
          VaultHealth is a local-first health data dashboard. It helps you understand
          your sleep and workout patterns using data you already own.
        </p>
        <div className="text-sm text-gray-500">
          <p>Version: 0.1.0 (Phase 1)</p>
          <p>Built with React, Chart.js, and IndexedDB</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="disclaimer mt-8">
        <strong>Not Medical Advice:</strong> VaultHealth provides general wellness insights
        based on your personal data. It is not intended to diagnose, treat, cure, or prevent
        any disease or health condition. Always consult with qualified healthcare professionals
        for medical advice.
      </div>
    </div>
  );
}
