/**
 * Import Page
 * ============
 * Handles file imports from various sources.
 * Supports drag-and-drop and file selection.
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectFileType, importFile, type ImportResult, type ImportProgress } from '../importers/pipeline';
import { checkFileSizeWarning, formatFileSize } from '../workers';
import { getAll } from '../db/database';
import type { Source } from '../types/schema';

const DEFAULT_USER_ID = 'local-user'; // Single user for now

export default function ImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);

  // Load existing sources
  useState(() => {
    getAll('sources').then(setSources);
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  async function processFile(file: File) {
    setError(null);
    setResult(null);
    setIsProcessing(true);

    try {
      // Check file size
      const sizeCheck = checkFileSizeWarning(file.size);
      if (sizeCheck.level === 'error') {
        setError(sizeCheck.message);
        setIsProcessing(false);
        return;
      }

      if (sizeCheck.level === 'warning') {
        setProgress({
          stage: 'detecting',
          percent: 0,
          message: sizeCheck.message,
        });
      }

      // Read file content
      const content = await readFile(file);

      // Create import file object
      const importFile_: {
        name: string;
        size: number;
        type: string;
        content: string | ArrayBuffer;
      } = {
        name: file.name,
        size: file.size,
        type: file.type,
        content,
      };

      // Detect file type first
      setProgress({ stage: 'detecting', percent: 5, message: 'Analyzing file...' });
      const detection = await detectFileType(importFile_);

      if (detection.fileType === 'unknown') {
        setError('Could not determine file format. Please upload a JSON, CSV, or Apple Health XML file.');
        setIsProcessing(false);
        return;
      }

      // Import the file
      const importResult = await importFile(
        importFile_,
        DEFAULT_USER_ID,
        null, // Auto-detect profile
        (p) => setProgress(p)
      );

      setResult(importResult);

      if (importResult.success) {
        // Refresh sources list
        const newSources = await getAll('sources');
        setSources(newSources);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error during import');
    } finally {
      setIsProcessing(false);
    }
  }

  async function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Import Data</h2>
        <p className="text-gray-500">
          Upload your health data exports. Supported: Eight Sleep, Orangetheory, and more.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className={`dropzone ${isDragging ? 'active' : ''} ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,.xml,.zip"
          className="hidden"
          onChange={handleFileSelect}
        />

        {isProcessing ? (
          <div>
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-white font-medium mb-2">{progress?.message || 'Processing...'}</p>
            <div className="w-64 mx-auto h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-300"
                style={{ width: `${progress?.percent || 0}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">{progress?.percent || 0}%</p>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-4">📥</div>
            <p className="text-white font-medium mb-2">
              Drop your file here or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Supports JSON, CSV, XML, and ZIP files
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="card mt-6 border-red-500/30 bg-red-500/10">
          <h3 className="font-semibold text-red-400 mb-2">Import Failed</h3>
          <p className="text-sm text-gray-300">{error}</p>
        </div>
      )}

      {/* Success Result */}
      {result && result.success && (
        <div className="card mt-6 border-green-500/30 bg-green-500/10">
          <h3 className="font-semibold text-green-400 mb-4">Import Successful!</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {result.recordCounts.sleepSessions}
              </div>
              <div className="text-sm text-gray-400">Sleep Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {result.recordCounts.workoutSessions}
              </div>
              <div className="text-sm text-gray-400">Workouts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {result.qualitySummary.good}
              </div>
              <div className="text-sm text-gray-400">Good Quality</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {result.qualitySummary.warning + result.qualitySummary.bad}
              </div>
              <div className="text-sm text-gray-400">Needs Review</div>
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
              <h4 className="text-sm font-medium text-yellow-400 mb-2">
                {result.warnings.length} Warning(s)
              </h4>
              <ul className="text-sm text-gray-400 space-y-1">
                {result.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>• {w.message}</li>
                ))}
                {result.warnings.length > 5 && (
                  <li>...and {result.warnings.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="btn btn-primary"
            >
              View Dashboard
            </button>
            <button
              onClick={() => navigate('/quality')}
              className="btn btn-secondary"
            >
              Review Data Quality
            </button>
          </div>
        </div>
      )}

      {/* Supported Sources */}
      <div className="mt-12">
        <h3 className="text-lg font-semibold text-white mb-4">Supported Sources</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SourceCard
            name="Eight Sleep"
            icon="🛏️"
            status="supported"
            instructions="Export your data from the Eight Sleep app: Profile → Data Export → Request Export"
          />
          <SourceCard
            name="Orangetheory"
            icon="🍊"
            status="supported"
            instructions="Submit a DSAR request to Orangetheory. Upload the CSV when you receive it."
          />
          <SourceCard
            name="Our Dashboard Format"
            icon="📊"
            status="supported"
            instructions="Re-import dashboard_data.json files from earlier exports."
          />
          <SourceCard
            name="Oura Ring"
            icon="💍"
            status="coming"
            instructions="Coming soon: Export from Oura Cloud or connect via API."
          />
          <SourceCard
            name="Apple Health"
            icon="🍎"
            status="supported"
            instructions="Export from Health app: Profile → Export All Health Data. Upload the export.xml file."
          />
          <SourceCard
            name="Generic CSV"
            icon="📄"
            status="supported"
            instructions="Upload any CSV with date, sleep, or workout data. Map columns manually."
          />
        </div>
      </div>

      {/* Existing Imports */}
      {sources.length > 0 && (
        <div className="mt-12">
          <h3 className="text-lg font-semibold text-white mb-4">Previous Imports</h3>

          <div className="card">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-white/10">
                  <th className="text-left py-2">File</th>
                  <th className="text-left py-2">Source</th>
                  <th className="text-right py-2">Records</th>
                  <th className="text-right py-2">Size</th>
                  <th className="text-right py-2">Imported</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-2">{s.fileName}</td>
                    <td className="py-2 capitalize">{s.vendor.replace('_', ' ')}</td>
                    <td className="py-2 text-right">
                      {(s.recordCounts.sleepSessions || 0) + (s.recordCounts.workoutSessions || 0)}
                    </td>
                    <td className="py-2 text-right">{formatFileSize(s.fileSizeBytes)}</td>
                    <td className="py-2 text-right text-gray-500">
                      {new Date(s.importedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DSAR Information */}
      <div className="mt-12 card">
        <h3 className="text-lg font-semibold text-white mb-4">📋 Getting Your Data (DSAR)</h3>
        <p className="text-gray-400 mb-4">
          Under GDPR and CCPA, you have the right to request all data companies have about you.
          This is called a Data Subject Access Request (DSAR).
        </p>

        <div className="space-y-4">
          <details className="group">
            <summary className="cursor-pointer text-primary-400 hover:text-primary-300">
              How to request from Orangetheory
            </summary>
            <div className="mt-2 pl-4 text-sm text-gray-400">
              <ol className="list-decimal list-inside space-y-1">
                <li>Email privacy@orangetheory.com</li>
                <li>Include your name, email, and studio location</li>
                <li>Request "all personal data including workout history"</li>
                <li>They must respond within 30-45 days</li>
                <li>Upload the export here when you receive it</li>
              </ol>
            </div>
          </details>

          <details className="group">
            <summary className="cursor-pointer text-primary-400 hover:text-primary-300">
              DSAR Email Template
            </summary>
            <div className="mt-2 pl-4 text-sm text-gray-400 bg-white/5 p-3 rounded font-mono">
              Subject: Data Subject Access Request (DSAR)<br /><br />
              To Whom It May Concern,<br /><br />
              Under [GDPR Article 15 / CCPA], I am requesting access to all personal data
              you hold about me, including but not limited to: workout history, heart rate data,
              account information, and any derived analytics.<br /><br />
              Name: [Your Name]<br />
              Email: [Your Email]<br />
              Account ID: [If known]<br /><br />
              Please provide this data in a machine-readable format (CSV, JSON, or similar).<br /><br />
              Thank you.
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function SourceCard({
  name,
  icon,
  status,
  instructions,
}: {
  name: string;
  icon: string;
  status: 'supported' | 'coming' | 'beta';
  instructions: string;
}) {
  return (
    <div className={`card ${status === 'coming' ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h4 className="font-medium text-white">{name}</h4>
          <span className={`text-xs ${
            status === 'supported' ? 'text-green-400' :
            status === 'coming' ? 'text-yellow-400' : 'text-blue-400'
          }`}>
            {status === 'supported' ? '✓ Supported' :
             status === 'coming' ? '⏳ Coming Soon' : '🧪 Beta'}
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-400">{instructions}</p>
    </div>
  );
}
