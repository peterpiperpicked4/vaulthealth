/**
 * Worker Utilities
 * =================
 * Wrapper for using Web Workers from the main thread.
 */

export interface FileProcessorResult {
  success: boolean;
  data?: unknown;
  error?: string;
  warnings?: string[];
}

export interface ProcessorProgress {
  percent: number;
  message: string;
}

/**
 * Process a file using the Web Worker
 */
export async function processFileInWorker(
  file: File,
  onProgress?: (progress: ProcessorProgress) => void
): Promise<FileProcessorResult> {
  return new Promise((resolve) => {
    // Create worker
    const worker = new Worker(
      new URL('./fileProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );

    const warnings: string[] = [];

    worker.onmessage = (event) => {
      const { type, percent, message, data } = event.data;

      switch (type) {
        case 'progress':
          onProgress?.({ percent: percent || 0, message: message || '' });
          break;

        case 'warning':
          warnings.push(message || 'Unknown warning');
          onProgress?.({ percent: 0, message: message || '' });
          break;

        case 'complete':
          worker.terminate();
          resolve({ success: true, data, warnings });
          break;

        case 'error':
          worker.terminate();
          resolve({ success: false, error: message, warnings });
          break;
      }
    };

    worker.onerror = (error) => {
      worker.terminate();
      resolve({ success: false, error: error.message, warnings });
    };

    // Determine file type
    const fileType = getFileType(file.name, file.type);

    // Read file and send to worker
    const reader = new FileReader();

    reader.onload = () => {
      worker.postMessage({
        type: 'parse',
        file: reader.result,
        fileType,
        fileName: file.name,
      });
    };

    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read file', warnings });
    };

    reader.readAsArrayBuffer(file);
  });
}

function getFileType(fileName: string, mimeType: string): 'json' | 'csv' | 'xml' {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'json' || mimeType === 'application/json') return 'json';
  if (ext === 'csv' || mimeType === 'text/csv') return 'csv';
  if (ext === 'xml' || mimeType === 'application/xml' || mimeType === 'text/xml') return 'xml';

  // Default to JSON
  return 'json';
}

/**
 * Cancel an in-progress file processing
 */
export function cancelProcessing(worker: Worker): void {
  worker.postMessage({ type: 'cancel' });
  worker.terminate();
}

/**
 * Check if Web Workers are supported
 */
export function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Check if file is likely too large and warn user
 */
export function checkFileSizeWarning(sizeBytes: number): {
  level: 'ok' | 'warning' | 'error';
  message: string;
} {
  const SOFT_LIMIT = 100 * 1024 * 1024; // 100MB
  const HARD_LIMIT = 600 * 1024 * 1024; // 600MB

  if (sizeBytes > HARD_LIMIT) {
    return {
      level: 'error',
      message: `File is too large (${formatFileSize(sizeBytes)}). Maximum supported size is ${formatFileSize(HARD_LIMIT)}. Try exporting a shorter date range.`,
    };
  }

  if (sizeBytes > SOFT_LIMIT) {
    return {
      level: 'warning',
      message: `Large file detected (${formatFileSize(sizeBytes)}). Processing may be slow. For better performance, consider exporting a shorter date range.`,
    };
  }

  return {
    level: 'ok',
    message: '',
  };
}
