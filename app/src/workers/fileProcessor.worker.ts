/**
 * File Processor Web Worker
 * ==========================
 * Handles large file processing off the main thread.
 * Supports chunked parsing for files >100MB.
 *
 * Messages:
 * - { type: 'parse', file: ArrayBuffer, fileType: 'json'|'csv', fileName: string }
 * - { type: 'cancel' }
 *
 * Responses:
 * - { type: 'progress', percent: number, message: string }
 * - { type: 'complete', data: unknown }
 * - { type: 'error', message: string }
 * - { type: 'warning', message: string, sizeBytes: number }
 */

const SOFT_LIMIT_BYTES = 100 * 1024 * 1024; // 100MB
const HARD_LIMIT_BYTES = 500 * 1024 * 1024; // 500MB
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for progress reporting

interface WorkerMessage {
  type: 'parse' | 'cancel';
  file?: ArrayBuffer;
  fileType?: 'json' | 'csv' | 'xml';
  fileName?: string;
}

interface WorkerResponse {
  type: 'progress' | 'complete' | 'error' | 'warning';
  percent?: number;
  message?: string;
  data?: unknown;
  sizeBytes?: number;
}

let cancelled = false;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, file, fileType, fileName } = event.data;

  if (type === 'cancel') {
    cancelled = true;
    return;
  }

  if (type === 'parse' && file) {
    cancelled = false;
    await processFile(file, fileType || 'json', fileName || 'unknown');
  }
};

async function processFile(
  buffer: ArrayBuffer,
  fileType: string,
  _fileName: string
): Promise<void> {
  const sizeBytes = buffer.byteLength;

  // Check file size limits
  if (sizeBytes > HARD_LIMIT_BYTES) {
    respond({
      type: 'error',
      message: `File too large (${formatBytes(sizeBytes)}). Maximum supported size is ${formatBytes(HARD_LIMIT_BYTES)}.`,
    });
    return;
  }

  if (sizeBytes > SOFT_LIMIT_BYTES) {
    respond({
      type: 'warning',
      message: `Large file detected (${formatBytes(sizeBytes)}). Processing may take a while. Consider exporting a shorter date range if possible.`,
      sizeBytes,
    });
  }

  respond({ type: 'progress', percent: 0, message: 'Reading file...' });

  try {
    // Decode buffer to string in chunks to avoid memory spikes
    const text = await decodeBufferChunked(buffer);

    if (cancelled) {
      respond({ type: 'error', message: 'Cancelled by user' });
      return;
    }

    respond({ type: 'progress', percent: 30, message: 'Parsing content...' });

    let data: unknown;

    switch (fileType) {
      case 'json':
        data = parseJsonChunked(text);
        break;
      case 'csv':
        data = parseCsvChunked(text);
        break;
      case 'xml':
        data = parseXmlChunked(text);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    if (cancelled) {
      respond({ type: 'error', message: 'Cancelled by user' });
      return;
    }

    respond({ type: 'progress', percent: 90, message: 'Finalizing...' });
    respond({ type: 'complete', data });
  } catch (e) {
    respond({
      type: 'error',
      message: e instanceof Error ? e.message : 'Unknown error during parsing',
    });
  }
}

// ============================================================
// CHUNKED DECODERS
// ============================================================

async function decodeBufferChunked(buffer: ArrayBuffer): Promise<string> {
  const decoder = new TextDecoder('utf-8');
  const bytes = new Uint8Array(buffer);
  const totalChunks = Math.ceil(bytes.length / CHUNK_SIZE);

  let result = '';

  for (let i = 0; i < totalChunks; i++) {
    if (cancelled) throw new Error('Cancelled');

    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, bytes.length);
    const chunk = bytes.slice(start, end);

    // Use stream: true for all but the last chunk
    const isLast = i === totalChunks - 1;
    result += decoder.decode(chunk, { stream: !isLast });

    // Report progress
    const percent = Math.floor((i / totalChunks) * 30);
    respond({ type: 'progress', percent, message: `Reading file... ${percent}%` });

    // Yield to prevent blocking
    await sleep(0);
  }

  return result;
}

// ============================================================
// JSON PARSER
// ============================================================

function parseJsonChunked(text: string): unknown {
  // For JSON, we can't really parse in chunks easily
  // But we can try streaming JSON parser for arrays

  const trimmed = text.trim();

  // Quick check for structure
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    throw new Error('Invalid JSON: must start with { or [');
  }

  respond({ type: 'progress', percent: 50, message: 'Parsing JSON...' });

  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to provide more helpful error
    if (e instanceof SyntaxError) {
      const match = e.message.match(/position (\d+)/);
      if (match) {
        const position = parseInt(match[1]);
        const context = text.slice(Math.max(0, position - 50), position + 50);
        throw new Error(`JSON syntax error near: ...${context}...`);
      }
    }
    throw e;
  }
}

// ============================================================
// CSV PARSER (streaming)
// ============================================================

interface CsvRow {
  [key: string]: string;
}

function parseCsvChunked(text: string): CsvRow[] {
  const lines = text.split('\n');
  const totalLines = lines.length;

  if (totalLines < 2) {
    return [];
  }

  // Parse headers
  const headers = parseCsvLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < totalLines; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const row: CsvRow = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }

    rows.push(row);

    // Report progress periodically
    if (i % 1000 === 0) {
      const percent = 30 + Math.floor((i / totalLines) * 60);
      respond({ type: 'progress', percent, message: `Parsing row ${i} of ${totalLines}...` });
    }
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// ============================================================
// XML PARSER (basic for Apple Health)
// ============================================================

function parseXmlChunked(text: string): unknown {
  // This is a simplified XML parser for Apple Health exports
  // Full XML parsing is complex; this handles the common patterns

  respond({ type: 'progress', percent: 40, message: 'Parsing XML...' });

  // Extract records using regex (works for Apple Health format)
  const records: Array<Record<string, string>> = [];

  // Match <Record ... /> elements
  const recordRegex = /<Record\s+([^>]+)\/>/g;
  let match;

  while ((match = recordRegex.exec(text)) !== null) {
    const attrs = parseXmlAttributes(match[1]);
    records.push(attrs);

    if (records.length % 10000 === 0) {
      const percent = 40 + Math.floor((match.index / text.length) * 50);
      respond({ type: 'progress', percent, message: `Parsed ${records.length} records...` });
    }
  }

  // Also match <Workout ... /> elements
  const workoutRegex = /<Workout\s+([^>]+)(?:\/>|>[\s\S]*?<\/Workout>)/g;
  const workouts: Array<Record<string, string>> = [];

  while ((match = workoutRegex.exec(text)) !== null) {
    const attrs = parseXmlAttributes(match[1]);
    workouts.push(attrs);
  }

  return { records, workouts };
}

function parseXmlAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;

  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }

  return attrs;
}

// ============================================================
// UTILITIES
// ============================================================

function respond(response: WorkerResponse): void {
  self.postMessage(response);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// TypeScript needs this to treat file as a module
export {};
