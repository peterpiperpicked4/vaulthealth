/**
 * Apple Health Direct Import Script
 * ==================================
 * Imports Apple Health export.xml directly, bypassing the browser UI.
 * Useful for large files (500MB+).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseAppleHealthXML, APPLE_HEALTH_PROFILE } from '../src/importers/appleHealth';
import { generateId, sha256 } from '../src/utils/crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APPLE_HEALTH_EXPORT = path.resolve(__dirname, '../../Peter_Private_Data_Apple/export.xml');
const OUTPUT_JSON = path.resolve(__dirname, '../../apple_health_import.json');

async function main() {
  console.log('='.repeat(60));
  console.log('Apple Health Import');
  console.log('='.repeat(60));
  console.log(`\nReading: ${APPLE_HEALTH_EXPORT}`);

  const stats = fs.statSync(APPLE_HEALTH_EXPORT);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(1)} MB\n`);

  console.log('Loading file into memory...');
  const startRead = Date.now();
  const content = fs.readFileSync(APPLE_HEALTH_EXPORT, 'utf-8');
  console.log(`Loaded in ${((Date.now() - startRead) / 1000).toFixed(1)}s\n`);

  const userId = 'local-user';
  const sourceId = generateId();

  console.log('Parsing Apple Health data...');
  const startParse = Date.now();

  const result = await parseAppleHealthXML(
    content,
    sourceId,
    userId,
    (percent, message) => {
      process.stdout.write(`\r[${percent.toFixed(0).padStart(3)}%] ${message.padEnd(60)}`);
    }
  );

  console.log(`\n\nParsing complete in ${((Date.now() - startParse) / 1000).toFixed(1)}s\n`);

  console.log('='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nData Sources Found: ${result.sources.size}`);
  for (const source of result.sources) {
    console.log(`  - ${source}`);
  }

  console.log('\nRecord Counts:');
  console.log(`  Sleep Records:     ${result.recordCounts.sleep.toLocaleString()}`);
  console.log(`  Heart Rate:        ${result.recordCounts.heartRate.toLocaleString()}`);
  console.log(`  HRV:               ${result.recordCounts.hrv.toLocaleString()}`);
  console.log(`  Workouts:          ${result.recordCounts.workouts.toLocaleString()}`);
  console.log(`  Weight:            ${result.recordCounts.weight.toLocaleString()}`);
  console.log(`  Steps:             ${result.recordCounts.steps.toLocaleString()}`);
  console.log(`  Other:             ${result.recordCounts.other.toLocaleString()}`);

  console.log('\nTransformed Data:');
  console.log(`  Sleep Sessions:    ${result.sleepSessions.length}`);
  console.log(`  Workout Sessions:  ${result.workoutSessions.length}`);
  console.log(`  Daily Metrics:     ${result.dailyMetrics.length}`);

  // Show sample data
  if (result.sleepSessions.length > 0) {
    const sample = result.sleepSessions[0];
    console.log('\nSample Sleep Session:');
    console.log(`  Date: ${sample.date}`);
    console.log(`  Duration: ${(sample.durationSeconds / 3600).toFixed(1)}h`);
    console.log(`  Deep: ${sample.deepSeconds ? (sample.deepSeconds / 60).toFixed(0) : 'N/A'}min`);
    console.log(`  REM: ${sample.remSeconds ? (sample.remSeconds / 60).toFixed(0) : 'N/A'}min`);
    console.log(`  Efficiency: ${sample.efficiency?.toFixed(0) || 'N/A'}%`);
  }

  if (result.workoutSessions.length > 0) {
    console.log('\nWorkout Types Found:');
    const workoutTypes = new Map<string, number>();
    for (const w of result.workoutSessions) {
      const type = w.workoutSubtype || w.workoutType;
      workoutTypes.set(type, (workoutTypes.get(type) || 0) + 1);
    }
    const sorted = [...workoutTypes.entries()].sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sorted.slice(0, 10)) {
      console.log(`  ${type}: ${count}`);
    }
  }

  // Save as JSON for later import into the app
  console.log(`\nSaving results to: ${OUTPUT_JSON}`);

  const output = {
    sourceId,
    userId,
    importedAt: new Date().toISOString(),
    sources: [...result.sources],
    recordCounts: result.recordCounts,
    sleepSessions: result.sleepSessions,
    workoutSessions: result.workoutSessions,
    dailyMetrics: result.dailyMetrics,
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
  console.log('Done!\n');

  console.log('='.repeat(60));
  console.log('NEXT STEPS');
  console.log('='.repeat(60));
  console.log('\nThe parsed data has been saved to apple_health_import.json');
  console.log('To load it into the app, you can import this file from the Import page.');
}

main().catch(console.error);
