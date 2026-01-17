/**
 * Import Pipeline
 * ================
 * Orchestrates the file import process:
 * 1. Detect file type and vendor
 * 2. Apply importer profile (or prompt user for mapping)
 * 3. Transform to canonical schema
 * 4. Validate and flag quality issues
 * 5. Store in IndexedDB
 */

import type {
  Source,
  SleepSession,
  WorkoutSession,
  DailyMetric,
  TimeSeries,
  ImporterProfile,
  VendorType,
} from '../types/schema';
import { sha256, generateId } from '../utils/crypto';
import { put, putMany, getByIndex, getAll } from '../db/database';
import { checkSleepSessionQuality, generateDataQualityFlags } from '../insights/dataQuality';

// ============================================================
// TYPES
// ============================================================

export interface ImportFile {
  name: string;
  size: number;
  type: string;
  content: ArrayBuffer | string;
}

export interface ImportResult {
  success: boolean;
  sourceId: string;
  vendor: VendorType;
  recordCounts: {
    sleepSessions: number;
    workoutSessions: number;
    dailyMetrics: number;
    timeSeries: number;
  };
  warnings: ImportWarning[];
  errors: ImportError[];
  qualitySummary: {
    good: number;
    warning: number;
    bad: number;
  };
}

export interface ImportWarning {
  type: 'missing_field' | 'outlier' | 'parse_error' | 'duplicate';
  message: string;
  recordIndex?: number;
  field?: string;
}

export interface ImportError {
  type: 'invalid_format' | 'unsupported_vendor' | 'parse_error' | 'storage_error';
  message: string;
  details?: unknown;
}

export interface ImportProgress {
  stage: 'detecting' | 'parsing' | 'transforming' | 'validating' | 'storing' | 'complete';
  percent: number;
  message: string;
  recordsProcessed?: number;
  totalRecords?: number;
}

export type ProgressCallback = (progress: ImportProgress) => void;

// ============================================================
// DATA DEDUPLICATION
// ============================================================

/**
 * Calculate a "completeness score" for a session based on how many fields have data
 */
function getSessionCompleteness(session: SleepSession): number {
  let score = 0;
  if (session.durationSeconds > 0) score += 10;
  if (session.deepSeconds > 0) score += 5;
  if (session.remSeconds > 0) score += 5;
  if (session.lightSeconds > 0) score += 5;
  if (session.awakeSeconds > 0) score += 2;
  if (session.minHeartRate && session.minHeartRate > 0) score += 5;
  if (session.avgHrv && session.avgHrv > 0) score += 5;
  if (session.efficiency && session.efficiency > 0 && session.efficiency <= 100) score += 3;
  if (session.avgRespiratoryRate && session.avgRespiratoryRate > 0) score += 3;
  if (session.avgBedTempC !== undefined) score += 2;
  return score;
}

/**
 * Merge two sessions, preferring data from the more complete one
 */
function mergeSessions(existing: SleepSession, incoming: SleepSession): SleepSession {
  const existingScore = getSessionCompleteness(existing);
  const incomingScore = getSessionCompleteness(incoming);

  // Use the more complete session as the base
  const base = existingScore >= incomingScore ? existing : incoming;
  const supplement = existingScore >= incomingScore ? incoming : existing;

  return {
    ...base,
    // Fill in any missing fields from the other session
    deepSeconds: base.deepSeconds || supplement.deepSeconds,
    remSeconds: base.remSeconds || supplement.remSeconds,
    lightSeconds: base.lightSeconds || supplement.lightSeconds,
    awakeSeconds: base.awakeSeconds || supplement.awakeSeconds,
    minHeartRate: base.minHeartRate || supplement.minHeartRate,
    avgHeartRate: base.avgHeartRate || supplement.avgHeartRate,
    avgHrv: base.avgHrv || supplement.avgHrv,
    avgRespiratoryRate: base.avgRespiratoryRate || supplement.avgRespiratoryRate,
    avgBedTempC: base.avgBedTempC ?? supplement.avgBedTempC,
    avgRoomTempC: base.avgRoomTempC ?? supplement.avgRoomTempC,
    efficiency: (base.efficiency && base.efficiency <= 100)
      ? base.efficiency
      : (supplement.efficiency && supplement.efficiency <= 100)
        ? supplement.efficiency
        : base.efficiency,
    // Combine vendor data sources
    vendorData: {
      ...supplement.vendorData,
      ...base.vendorData,
      mergedSources: [
        base.vendorData?.source,
        supplement.vendorData?.source,
      ].filter(Boolean),
    },
  };
}

/**
 * Deduplicate sessions against existing database records
 * Returns deduplicated sessions and count of merged/skipped records
 */
async function deduplicateSessions(
  sessions: SleepSession[],
  userId: string
): Promise<{
  sessions: SleepSession[];
  mergedCount: number;
  skippedCount: number;
}> {
  // Get all existing sessions for this user
  const existingSessions = await getAll('sleepSessions') as SleepSession[];
  const existingByDate = new Map<string, SleepSession>();

  for (const session of existingSessions) {
    if (session.userId === userId) {
      const key = session.date;
      // If multiple sessions exist for same date, keep the most complete
      const existing = existingByDate.get(key);
      if (!existing || getSessionCompleteness(session) > getSessionCompleteness(existing)) {
        existingByDate.set(key, session);
      }
    }
  }

  const result: SleepSession[] = [];
  let mergedCount = 0;
  let skippedCount = 0;

  // Also deduplicate within the incoming sessions
  const incomingByDate = new Map<string, SleepSession>();
  for (const session of sessions) {
    const key = session.date;
    const existing = incomingByDate.get(key);
    if (existing) {
      // Merge duplicate incoming sessions
      incomingByDate.set(key, mergeSessions(existing, session));
    } else {
      incomingByDate.set(key, session);
    }
  }

  // Now check against existing database records
  for (const [date, session] of incomingByDate) {
    const existing = existingByDate.get(date);

    if (existing) {
      const existingScore = getSessionCompleteness(existing);
      const incomingScore = getSessionCompleteness(session);

      if (incomingScore > existingScore) {
        // Incoming is better, merge and update
        const merged = mergeSessions(existing, session);
        merged.id = existing.id; // Keep the existing ID for update
        result.push(merged);
        mergedCount++;
      } else {
        // Existing is better or equal, skip
        skippedCount++;
      }
    } else {
      // No duplicate, add as new
      result.push(session);
    }
  }

  return { sessions: result, mergedCount, skippedCount };
}

/**
 * Validate and clamp efficiency values
 */
function validateEfficiency(efficiency: number | undefined | null): number | undefined {
  if (efficiency === undefined || efficiency === null) return undefined;
  if (efficiency < 0) return 0;
  if (efficiency > 100) return 100; // Clamp impossible values
  return efficiency;
}

/**
 * Validate session data and fix common issues
 */
function validateSession(session: SleepSession): SleepSession {
  return {
    ...session,
    efficiency: validateEfficiency(session.efficiency),
    minHeartRate: session.minHeartRate ? Math.round(session.minHeartRate) : undefined,
    avgHeartRate: session.avgHeartRate ? Math.round(session.avgHeartRate) : undefined,
    avgHrv: session.avgHrv ? Math.round(session.avgHrv) : undefined,
  };
}

// ============================================================
// FILE DETECTION
// ============================================================

export interface FileDetectionResult {
  fileType: 'json' | 'csv' | 'zip' | 'xml' | 'unknown';
  suggestedVendor: VendorType;
  confidence: 'high' | 'medium' | 'low';
  matchedProfile?: ImporterProfile;
  fileManifest?: {
    entryCount?: number;
    sampleFields?: string[];
    rowCount?: number;
  };
}

export async function detectFileType(file: ImportFile): Promise<FileDetectionResult> {
  const content = typeof file.content === 'string'
    ? file.content
    : new TextDecoder().decode(file.content);

  // Check by content first, then by extension
  const trimmed = content.trim();

  // JSON detection
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(content);
      return detectJsonVendor(parsed, file.name);
    } catch {
      // Invalid JSON
    }
  }

  // CSV detection (has header row, comma/tab separated)
  if (looksLikeCsv(trimmed)) {
    return detectCsvVendor(trimmed, file.name);
  }

  // XML detection
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
    // Check for Apple Health export
    if (trimmed.includes('<!DOCTYPE HealthData') ||
        trimmed.includes('<HealthData') ||
        trimmed.includes('HKQuantityTypeIdentifier')) {
      return {
        fileType: 'xml',
        suggestedVendor: 'apple_health',
        confidence: 'high',
        fileManifest: {
          sampleFields: ['HealthData', 'Record', 'Workout'],
        },
      };
    }

    return {
      fileType: 'xml',
      suggestedVendor: file.name.toLowerCase().includes('apple') ? 'apple_health' : 'unknown',
      confidence: 'low',
    };
  }

  // ZIP detection (check magic bytes)
  if (file.content instanceof ArrayBuffer) {
    const bytes = new Uint8Array(file.content);
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
      return {
        fileType: 'zip',
        suggestedVendor: 'unknown',
        confidence: 'low',
      };
    }
  }

  return {
    fileType: 'unknown',
    suggestedVendor: 'unknown',
    confidence: 'low',
  };
}

function detectJsonVendor(data: unknown, _fileName: string): FileDetectionResult {
  const result: FileDetectionResult = {
    fileType: 'json',
    suggestedVendor: 'unknown',
    confidence: 'low',
    fileManifest: {},
  };

  // Eight Sleep detection
  if (isEightSleepExport(data)) {
    result.suggestedVendor = 'eight_sleep';
    result.confidence = 'high';
    const sessions = getEightSleepSessions(data);
    result.fileManifest = {
      entryCount: sessions.length,
      sampleFields: sessions[0] ? Object.keys(sessions[0]) : [],
    };
    return result;
  }

  // Oura detection
  if (isOuraExport(data)) {
    result.suggestedVendor = 'oura';
    result.confidence = 'high';
    return result;
  }

  // Dashboard data (our own format)
  if (isDashboardDataExport(data)) {
    result.suggestedVendor = 'eight_sleep'; // It's derived from Eight Sleep
    result.confidence = 'high';
    const d = data as { sessions?: unknown[] };
    result.fileManifest = {
      entryCount: d.sessions?.length || 0,
    };
    return result;
  }

  // Pre-parsed Apple Health JSON (from streaming importer)
  if (isAppleHealthPreParsed(data)) {
    const d = data as { sleepSessions: unknown[]; workoutSessions: unknown[] };
    result.suggestedVendor = 'apple_health';
    result.confidence = 'high';
    result.fileManifest = {
      entryCount: d.sleepSessions.length + d.workoutSessions.length,
      sampleFields: ['sleepSessions', 'workoutSessions', 'dailyMetrics'],
    };
    return result;
  }

  // Generic JSON array
  if (Array.isArray(data)) {
    result.fileManifest = {
      entryCount: data.length,
      sampleFields: data[0] && typeof data[0] === 'object' ? Object.keys(data[0]) : [],
    };
    result.suggestedVendor = 'generic_json';
    result.confidence = 'low';
  }

  return result;
}

function detectCsvVendor(content: string, fileName: string): FileDetectionResult {
  const lines = content.split('\n');
  const headers = lines[0]?.toLowerCase() || '';

  const result: FileDetectionResult = {
    fileType: 'csv',
    suggestedVendor: 'generic_csv',
    confidence: 'low',
    fileManifest: {
      rowCount: lines.length - 1, // Excluding header
      sampleFields: lines[0]?.split(',').map(h => h.trim().replace(/"/g, '')) || [],
    },
  };

  // Orangetheory detection
  if (
    headers.includes('splat') ||
    headers.includes('orangetheory') ||
    headers.includes('class type') ||
    fileName.toLowerCase().includes('orangetheory') ||
    fileName.toLowerCase().includes('otf')
  ) {
    result.suggestedVendor = 'orangetheory';
    result.confidence = 'medium';
  }

  // Oura CSV
  if (headers.includes('readiness') && headers.includes('hrv')) {
    result.suggestedVendor = 'oura';
    result.confidence = 'medium';
  }

  return result;
}

function looksLikeCsv(content: string): boolean {
  const lines = content.split('\n').slice(0, 5);
  if (lines.length < 2) return false;

  // Check if first line looks like headers
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  return commaCount >= 2 || tabCount >= 2;
}

// ============================================================
// VENDOR-SPECIFIC DETECTION HELPERS
// ============================================================

function isEightSleepExport(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  // Check for sessions array with stages
  const sessions = getEightSleepSessions(data);
  if (sessions.length === 0) return false;

  const first = sessions[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    'ts' in first &&
    'stages' in first &&
    Array.isArray((first as { stages: unknown }).stages)
  );
}

function getEightSleepSessions(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'sessions' in data) {
    const sessions = (data as { sessions: unknown }).sessions;
    if (Array.isArray(sessions)) return sessions;
  }
  return [];
}

function isOuraExport(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  // Oura exports typically have sleep, readiness, activity sections
  return (
    ('sleep' in data && Array.isArray((data as { sleep: unknown }).sleep)) ||
    ('daily_readiness' in data)
  );
}

function isDashboardDataExport(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  // Our dashboard_data.json format
  const d = data as Record<string, unknown>;
  return (
    'sessions' in d &&
    'baselines' in d &&
    'debtStats' in d &&
    Array.isArray(d.sessions)
  );
}

function isAppleHealthPreParsed(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  // Pre-parsed Apple Health JSON from our streaming importer
  const d = data as Record<string, unknown>;
  return (
    'sleepSessions' in d &&
    'workoutSessions' in d &&
    'sources' in d &&
    Array.isArray(d.sleepSessions) &&
    Array.isArray(d.workoutSessions)
  );
}

// ============================================================
// MAIN IMPORT FUNCTION
// ============================================================

export async function importFile(
  file: ImportFile,
  userId: string,
  profile: ImporterProfile | null,
  onProgress?: ProgressCallback
): Promise<ImportResult> {
  const warnings: ImportWarning[] = [];
  const errors: ImportError[] = [];

  const report = (stage: ImportProgress['stage'], percent: number, message: string) => {
    onProgress?.({ stage, percent, message });
  };

  try {
    // Step 1: Detect file type
    report('detecting', 5, 'Analyzing file...');
    const detection = await detectFileType(file);

    if (detection.fileType === 'unknown') {
      errors.push({
        type: 'invalid_format',
        message: 'Could not determine file format',
      });
      return createErrorResult(errors);
    }

    // Step 2: Get or select importer profile
    const importerProfile = profile || await getBuiltInProfile(detection.suggestedVendor);

    if (!importerProfile) {
      errors.push({
        type: 'unsupported_vendor',
        message: `No importer profile found for ${detection.suggestedVendor}`,
      });
      return createErrorResult(errors);
    }

    // Step 3: Parse content
    report('parsing', 20, 'Parsing file content...');
    const content = typeof file.content === 'string'
      ? file.content
      : new TextDecoder().decode(file.content);

    let parsedData: unknown;

    // Special handling for Apple Health XML
    if (detection.fileType === 'xml' && detection.suggestedVendor === 'apple_health') {
      report('parsing', 20, 'Parsing Apple Health export (this may take a while)...');

      const fileHash = await sha256(content);
      const sourceId = generateId();

      // Parse Apple Health data directly
      const appleResult = await parseAppleHealthXML(
        content,
        sourceId,
        userId,
        (percent, message) => {
          report('transforming', percent, message);
        }
      );

      // Create source record
      const source: Source = {
        id: sourceId,
        userId,
        vendor: 'apple_health',
        fileName: file.name,
        fileHash,
        fileSizeBytes: file.size,
        importedAt: new Date().toISOString(),
        importerProfileId: APPLE_HEALTH_PROFILE.id,
        recordCounts: {
          sleepSessions: appleResult.sleepSessions.length,
          workoutSessions: appleResult.workoutSessions.length,
          dailyMetrics: appleResult.dailyMetrics.length,
          timeSeries: 0,
        },
      };

      // Validate and deduplicate data
      report('validating', 85, 'Validating and deduplicating data...');
      const validatedSessions = appleResult.sleepSessions.map(validateSession);
      const dedupResult = await deduplicateSessions(validatedSessions, userId);

      // Update source record counts with deduplicated values
      source.recordCounts.sleepSessions = dedupResult.sessions.length;

      // Store data
      report('storing', 90, 'Saving to database...');
      await put('sources', source);

      if (dedupResult.sessions.length > 0) {
        await putMany('sleepSessions', dedupResult.sessions);
      }
      if (appleResult.workoutSessions.length > 0) {
        await putMany('workoutSessions', appleResult.workoutSessions);
      }
      if (appleResult.dailyMetrics.length > 0) {
        await putMany('dailyMetrics', appleResult.dailyMetrics);
      }

      report('complete', 100, 'Apple Health import complete!');

      const importWarnings: ImportWarning[] = [{
        type: 'duplicate' as const,
        message: `Found data from ${appleResult.sources.size} sources: ${[...appleResult.sources].join(', ')}`,
      }];

      if (dedupResult.mergedCount > 0) {
        importWarnings.push({
          type: 'duplicate' as const,
          message: `Merged ${dedupResult.mergedCount} sessions with existing data`,
        });
      }
      if (dedupResult.skippedCount > 0) {
        importWarnings.push({
          type: 'duplicate' as const,
          message: `Skipped ${dedupResult.skippedCount} duplicate sessions (existing data was more complete)`,
        });
      }

      return {
        success: true,
        sourceId,
        vendor: 'apple_health',
        recordCounts: {
          sleepSessions: source.recordCounts.sleepSessions ?? 0,
          workoutSessions: source.recordCounts.workoutSessions ?? 0,
          dailyMetrics: source.recordCounts.dailyMetrics ?? 0,
          timeSeries: source.recordCounts.timeSeries ?? 0,
        },
        warnings: importWarnings,
        errors: [],
        qualitySummary: {
          good: dedupResult.sessions.length,
          warning: dedupResult.mergedCount,
          bad: dedupResult.skippedCount,
        },
      };
    }

    if (detection.fileType === 'json') {
      try {
        parsedData = JSON.parse(content);
      } catch (e) {
        errors.push({
          type: 'parse_error',
          message: 'Invalid JSON format',
          details: e,
        });
        return createErrorResult(errors);
      }

      // Handle pre-parsed Apple Health JSON
      if (detection.suggestedVendor === 'apple_health' && isAppleHealthPreParsed(parsedData)) {
        report('transforming', 50, 'Importing pre-parsed Apple Health data...');

        const data = parsedData as {
          sleepSessions: SleepSession[];
          workoutSessions: WorkoutSession[];
          dailyMetrics?: DailyMetric[];
          sources: string[];
          sourceId?: string;
        };

        const fileHash = await sha256(content);
        const sourceId = data.sourceId || generateId();

        // Update sourceIds and userIds on imported records
        const sleepSessions = data.sleepSessions.map(s => ({
          ...s,
          sourceId,
          userId,
        }));
        const workoutSessions = data.workoutSessions.map(w => ({
          ...w,
          sourceId,
          userId,
        }));
        const dailyMetrics = (data.dailyMetrics || []).map(m => ({
          ...m,
          sourceId,
          userId,
        }));

        // Validate and deduplicate
        report('validating', 70, 'Validating and deduplicating data...');
        const validatedSessions = sleepSessions.map(validateSession);
        const dedupResult = await deduplicateSessions(validatedSessions, userId);

        // Create source record
        const source: Source = {
          id: sourceId,
          userId,
          vendor: 'apple_health',
          fileName: file.name,
          fileHash,
          fileSizeBytes: file.size,
          importedAt: new Date().toISOString(),
          importerProfileId: APPLE_HEALTH_PROFILE.id,
          recordCounts: {
            sleepSessions: dedupResult.sessions.length,
            workoutSessions: workoutSessions.length,
            dailyMetrics: dailyMetrics.length,
            timeSeries: 0,
          },
        };

        // Store data
        report('storing', 80, 'Saving to database...');
        await put('sources', source);

        if (dedupResult.sessions.length > 0) {
          await putMany('sleepSessions', dedupResult.sessions);
        }
        if (workoutSessions.length > 0) {
          await putMany('workoutSessions', workoutSessions);
        }
        if (dailyMetrics.length > 0) {
          await putMany('dailyMetrics', dailyMetrics);
        }

        report('complete', 100, 'Apple Health import complete!');

        const importWarnings: ImportWarning[] = [{
          type: 'duplicate' as const,
          message: `Imported data from ${data.sources.length} sources: ${data.sources.slice(0, 5).join(', ')}${data.sources.length > 5 ? '...' : ''}`,
        }];

        if (dedupResult.mergedCount > 0) {
          importWarnings.push({
            type: 'duplicate' as const,
            message: `Merged ${dedupResult.mergedCount} sessions with existing data`,
          });
        }
        if (dedupResult.skippedCount > 0) {
          importWarnings.push({
            type: 'duplicate' as const,
            message: `Skipped ${dedupResult.skippedCount} duplicate sessions`,
          });
        }

        return {
          success: true,
          sourceId,
          vendor: 'apple_health',
          recordCounts: {
            sleepSessions: source.recordCounts.sleepSessions ?? 0,
            workoutSessions: source.recordCounts.workoutSessions ?? 0,
            dailyMetrics: source.recordCounts.dailyMetrics ?? 0,
            timeSeries: source.recordCounts.timeSeries ?? 0,
          },
          warnings: importWarnings,
          errors: [],
          qualitySummary: {
            good: dedupResult.sessions.length,
            warning: dedupResult.mergedCount,
            bad: dedupResult.skippedCount,
          },
        };
      }
    } else if (detection.fileType === 'csv') {
      parsedData = parseCsv(content);
    } else {
      errors.push({
        type: 'unsupported_vendor',
        message: `File type ${detection.fileType} not yet supported`,
      });
      return createErrorResult(errors);
    }

    // Step 4: Create source record
    const fileHash = await sha256(content);

    // Check for duplicate import
    const existingSources = await getByIndex('sources', 'fileHash', fileHash);
    if (existingSources.length > 0) {
      warnings.push({
        type: 'duplicate',
        message: 'This file has already been imported',
      });
    }

    const sourceId = generateId();
    const source: Source = {
      id: sourceId,
      userId,
      vendor: detection.suggestedVendor,
      fileName: file.name,
      fileHash,
      fileSizeBytes: file.size,
      importedAt: new Date().toISOString(),
      importerProfileId: importerProfile.id,
      recordCounts: {
        sleepSessions: 0,
        workoutSessions: 0,
        dailyMetrics: 0,
        timeSeries: 0,
      },
    };

    // Step 5: Transform to canonical schema
    report('transforming', 40, 'Transforming data...');
    const transformResult = await transformData(
      parsedData,
      importerProfile,
      sourceId,
      userId,
      (processed, total) => {
        const percent = 40 + (processed / total) * 30;
        report('transforming', percent, `Processing record ${processed} of ${total}...`);
      }
    );

    warnings.push(...transformResult.warnings);

    // Step 6: Validate and add quality flags
    report('validating', 75, 'Validating data quality...');
    let goodCount = 0;
    let warningCount = 0;
    let badCount = 0;

    // Validate sessions
    const validatedSessions = transformResult.sleepSessions.map(validateSession);

    for (const session of validatedSessions) {
      const qualityReport = checkSleepSessionQuality(session);
      session.dataQuality = generateDataQualityFlags(qualityReport);

      if (qualityReport.overallQuality === 'good') goodCount++;
      else if (qualityReport.overallQuality === 'warning') warningCount++;
      else badCount++;

      if (qualityReport.hardLimitViolations.length > 0) {
        warnings.push({
          type: 'outlier',
          message: `Session ${session.date} has values outside expected ranges`,
          field: qualityReport.hardLimitViolations[0].field,
        });
      }
    }

    // Deduplicate against existing data
    report('validating', 85, 'Deduplicating data...');
    const dedupResult = await deduplicateSessions(validatedSessions, userId);

    if (dedupResult.mergedCount > 0) {
      warnings.push({
        type: 'duplicate',
        message: `Merged ${dedupResult.mergedCount} sessions with existing data`,
      });
    }
    if (dedupResult.skippedCount > 0) {
      warnings.push({
        type: 'duplicate',
        message: `Skipped ${dedupResult.skippedCount} duplicate sessions`,
      });
    }

    // Step 7: Store in database
    report('storing', 90, 'Saving to database...');

    source.recordCounts = {
      sleepSessions: dedupResult.sessions.length,
      workoutSessions: transformResult.workoutSessions.length,
      dailyMetrics: 0,
      timeSeries: transformResult.timeSeries.length,
    };

    await put('sources', source);

    if (dedupResult.sessions.length > 0) {
      await putMany('sleepSessions', dedupResult.sessions);
    }

    if (transformResult.workoutSessions.length > 0) {
      await putMany('workoutSessions', transformResult.workoutSessions);
    }

    if (transformResult.timeSeries.length > 0) {
      await putMany('timeSeries', transformResult.timeSeries);
    }

    report('complete', 100, 'Import complete!');

    return {
      success: true,
      sourceId,
      vendor: detection.suggestedVendor,
      recordCounts: {
        sleepSessions: source.recordCounts.sleepSessions ?? 0,
        workoutSessions: source.recordCounts.workoutSessions ?? 0,
        dailyMetrics: source.recordCounts.dailyMetrics ?? 0,
        timeSeries: source.recordCounts.timeSeries ?? 0,
      },
      warnings,
      errors,
      qualitySummary: {
        good: goodCount,
        warning: warningCount + dedupResult.mergedCount,
        bad: badCount + dedupResult.skippedCount,
      },
    };
  } catch (e) {
    errors.push({
      type: 'storage_error',
      message: e instanceof Error ? e.message : 'Unknown error during import',
      details: e,
    });
    return createErrorResult(errors);
  }
}

function createErrorResult(errors: ImportError[]): ImportResult {
  return {
    success: false,
    sourceId: '',
    vendor: 'unknown',
    recordCounts: {
      sleepSessions: 0,
      workoutSessions: 0,
      dailyMetrics: 0,
      timeSeries: 0,
    },
    warnings: [],
    errors,
    qualitySummary: { good: 0, warning: 0, bad: 0 },
  };
}

// ============================================================
// CSV PARSER
// ============================================================

interface CsvRow {
  [key: string]: string;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: CsvRow = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }

    rows.push(row);
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
      inQuotes = !inQuotes;
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
// DATA TRANSFORMATION
// ============================================================

interface TransformResult {
  sleepSessions: SleepSession[];
  workoutSessions: WorkoutSession[];
  timeSeries: TimeSeries[];
  warnings: ImportWarning[];
}

async function transformData(
  data: unknown,
  profile: ImporterProfile,
  sourceId: string,
  userId: string,
  onProgress?: (processed: number, total: number) => void
): Promise<TransformResult> {
  // Delegate to the appropriate transformer based on vendor
  switch (profile.vendor) {
    case 'eight_sleep':
      return transformEightSleep(data, sourceId, userId, onProgress);
    case 'orangetheory':
      return transformOrangetheory(data, sourceId, userId, onProgress);
    default:
      // Use generic mapping-based transform
      return transformGeneric(data, profile, sourceId, userId, onProgress);
  }
}

// ============================================================
// BUILT-IN PROFILES
// ============================================================

async function getBuiltInProfile(vendor: VendorType): Promise<ImporterProfile | null> {
  // Return built-in profiles for known vendors
  switch (vendor) {
    case 'eight_sleep':
      return EIGHT_SLEEP_PROFILE;
    case 'orangetheory':
      return ORANGETHEORY_PROFILE;
    case 'apple_health':
      return APPLE_HEALTH_PROFILE;
    default:
      return null;
  }
}

// Profiles are defined in separate importer files
import { EIGHT_SLEEP_PROFILE, transformEightSleep } from './eightSleep';
import { ORANGETHEORY_PROFILE, transformOrangetheory } from './orangetheory';
import { transformGeneric } from './generic';
import { APPLE_HEALTH_PROFILE, parseAppleHealthXML } from './appleHealth';
