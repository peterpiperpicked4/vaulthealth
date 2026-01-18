/**
 * ImportPanel Component
 * ======================
 * Condensed import functionality for overlay panel.
 */

import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { detectFileType, importFile, type ImportResult, type ImportProgress } from '../../importers/pipeline';
import { checkFileSizeWarning } from '../../workers';

const DEFAULT_USER_ID = 'local-user';

interface ImportPanelProps {
  onImportComplete?: () => void;
}

export function ImportPanel({ onImportComplete }: ImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const sizeCheck = checkFileSizeWarning(file.size);
      if (sizeCheck.level === 'error') {
        setError(sizeCheck.message);
        setIsProcessing(false);
        return;
      }

      const content = await readFile(file);
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

      setProgress({ stage: 'detecting', percent: 5, message: 'Analyzing file...' });
      const detection = await detectFileType(importFile_);

      if (detection.fileType === 'unknown') {
        setError('Could not determine file format. Please upload JSON, CSV, or XML.');
        setIsProcessing(false);
        return;
      }

      const importResult = await importFile(
        importFile_,
        DEFAULT_USER_ID,
        null,
        (p) => setProgress(p)
      );

      setResult(importResult);

      if (importResult.success) {
        onImportComplete?.();
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
    <div className="space-y-6">
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
          <div className="text-center">
            <motion.div
              className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-4"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-white font-medium mb-2">{progress?.message || 'Processing...'}</p>
            <div className="w-48 mx-auto h-1.5 bg-void-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-cyan-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress?.percent || 0}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-3xl mb-3">📥</div>
            <p className="text-white font-medium mb-1">Drop your file here</p>
            <p className="text-sm text-zinc-500">or click to browse</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-coral-500/10 border border-coral-500/20">
          <p className="text-coral-400 text-sm">{error}</p>
        </div>
      )}

      {/* Success */}
      {result?.success && (
        <motion.div
          className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-emerald-400 font-medium mb-3">Import Successful!</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-center p-2 bg-void-800 rounded">
              <div className="text-xl font-mono text-cyan-400">{result.recordCounts.sleepSessions}</div>
              <div className="text-xs text-zinc-500">Sleep Sessions</div>
            </div>
            <div className="text-center p-2 bg-void-800 rounded">
              <div className="text-xl font-mono text-coral-400">{result.recordCounts.workoutSessions}</div>
              <div className="text-xs text-zinc-500">Workouts</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Supported Sources */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">Supported Sources</h3>
        <div className="space-y-2">
          <SourceBadge name="Eight Sleep" icon="🛏️" />
          <SourceBadge name="Apple Health" icon="🍎" />
          <SourceBadge name="Orangetheory" icon="🍊" />
          <SourceBadge name="Generic CSV" icon="📄" />
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-void-800">
      <span>{icon}</span>
      <span className="text-sm text-zinc-300">{name}</span>
      <span className="text-xs text-emerald-400 ml-auto">Supported</span>
    </div>
  );
}
