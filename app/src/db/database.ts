/**
 * VaultHealth IndexedDB Database Layer
 * =====================================
 * All data is stored locally in IndexedDB.
 * This module provides typed access to all tables.
 */

import type {
  User,
  Source,
  SleepSession,
  WorkoutSession,
  DailyMetric,
  TimeSeries,
  Annotation,
  ComputedInsight,
  ImporterProfile,
  MorningRating,
} from '../types/schema';

// ============================================================
// DATABASE CONFIGURATION
// ============================================================

const DB_NAME = 'vaulthealth';
const DB_VERSION = 2; // Bumped for morningRatings store

interface VaultHealthDB {
  users: User;
  sources: Source;
  sleepSessions: SleepSession;
  workoutSessions: WorkoutSession;
  dailyMetrics: DailyMetric;
  timeSeries: TimeSeries;
  annotations: Annotation;
  computedInsights: ComputedInsight;
  importerProfiles: ImporterProfile;
  morningRatings: MorningRating;
  rawFiles: { id: string; data: ArrayBuffer; mimeType: string };
}

type StoreName = keyof VaultHealthDB;

// ============================================================
// DATABASE INITIALIZATION
// ============================================================

let dbInstance: IDBDatabase | null = null;

export async function initDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Users
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }

      // Sources (imported files)
      if (!db.objectStoreNames.contains('sources')) {
        const store = db.createObjectStore('sources', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('vendor', 'vendor', { unique: false });
        store.createIndex('fileHash', 'fileHash', { unique: false });
      }

      // Sleep Sessions
      if (!db.objectStoreNames.contains('sleepSessions')) {
        const store = db.createObjectStore('sleepSessions', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('sourceId', 'sourceId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('userId_date', ['userId', 'date'], { unique: false });
      }

      // Workout Sessions
      if (!db.objectStoreNames.contains('workoutSessions')) {
        const store = db.createObjectStore('workoutSessions', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('sourceId', 'sourceId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('userId_date', ['userId', 'date'], { unique: false });
      }

      // Daily Metrics
      if (!db.objectStoreNames.contains('dailyMetrics')) {
        const store = db.createObjectStore('dailyMetrics', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('sourceId', 'sourceId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('userId_date_type', ['userId', 'date', 'metricType'], { unique: false });
      }

      // Time Series
      if (!db.objectStoreNames.contains('timeSeries')) {
        const store = db.createObjectStore('timeSeries', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('sourceId', 'sourceId', { unique: false });
        store.createIndex('sessionId', 'sessionId', { unique: false });
      }

      // Annotations
      if (!db.objectStoreNames.contains('annotations')) {
        const store = db.createObjectStore('annotations', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('userId_date', ['userId', 'date'], { unique: true });
      }

      // Morning Ratings
      if (!db.objectStoreNames.contains('morningRatings')) {
        const store = db.createObjectStore('morningRatings', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('userId_date', ['userId', 'date'], { unique: true });
        store.createIndex('sleepSessionId', 'sleepSessionId', { unique: false });
      }

      // Computed Insights
      if (!db.objectStoreNames.contains('computedInsights')) {
        const store = db.createObjectStore('computedInsights', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('insightType', 'insightType', { unique: false });
        store.createIndex('userId_type', ['userId', 'insightType'], { unique: false });
      }

      // Importer Profiles
      if (!db.objectStoreNames.contains('importerProfiles')) {
        const store = db.createObjectStore('importerProfiles', { keyPath: 'id' });
        store.createIndex('vendor', 'vendor', { unique: false });
      }

      // Raw Files (for re-processing)
      if (!db.objectStoreNames.contains('rawFiles')) {
        db.createObjectStore('rawFiles', { keyPath: 'id' });
      }
    };
  });
}

// ============================================================
// GENERIC CRUD OPERATIONS
// ============================================================

export async function put<T extends StoreName>(
  storeName: T,
  record: VaultHealthDB[T]
): Promise<void> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(record);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function putMany<T extends StoreName>(
  storeName: T,
  records: VaultHealthDB[T][]
): Promise<void> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();

    for (const record of records) {
      store.put(record);
    }
  });
}

export async function get<T extends StoreName>(
  storeName: T,
  id: string
): Promise<VaultHealthDB[T] | undefined> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAll<T extends StoreName>(
  storeName: T
): Promise<VaultHealthDB[T][]> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getByIndex<T extends StoreName>(
  storeName: T,
  indexName: string,
  value: IDBValidKey | IDBKeyRange
): Promise<VaultHealthDB[T][]> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function remove<T extends StoreName>(
  storeName: T,
  id: string
): Promise<void> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clear<T extends StoreName>(storeName: T): Promise<void> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function count<T extends StoreName>(storeName: T): Promise<number> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.count();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// ============================================================
// SPECIALIZED QUERIES
// ============================================================

export async function getSleepSessionsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<SleepSession[]> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sleepSessions', 'readonly');
    const store = tx.objectStore('sleepSessions');
    const index = store.index('userId_date');

    const range = IDBKeyRange.bound([userId, startDate], [userId, endDate]);
    const request = index.getAll(range);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getWorkoutSessionsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<WorkoutSession[]> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workoutSessions', 'readonly');
    const store = tx.objectStore('workoutSessions');
    const index = store.index('userId_date');

    const range = IDBKeyRange.bound([userId, startDate], [userId, endDate]);
    const request = index.getAll(range);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAnnotationsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Annotation[]> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('annotations', 'readonly');
    const store = tx.objectStore('annotations');
    const index = store.index('userId_date');

    const range = IDBKeyRange.bound([userId, startDate], [userId, endDate]);
    const request = index.getAll(range);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getMorningRatingsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<MorningRating[]> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('morningRatings', 'readonly');
    const store = tx.objectStore('morningRatings');
    const index = store.index('userId_date');

    const range = IDBKeyRange.bound([userId, startDate], [userId, endDate]);
    const request = index.getAll(range);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getMorningRatingByDate(
  userId: string,
  date: string
): Promise<MorningRating | undefined> {
  const db = await initDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('morningRatings', 'readonly');
    const store = tx.objectStore('morningRatings');
    const index = store.index('userId_date');

    const request = index.get([userId, date]);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// ============================================================
// DATABASE MANAGEMENT
// ============================================================

export async function deleteDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function exportAllData(): Promise<Record<string, unknown[]>> {
  const stores: StoreName[] = [
    'users',
    'sources',
    'sleepSessions',
    'workoutSessions',
    'dailyMetrics',
    'annotations',
    'morningRatings',
    'computedInsights',
    'importerProfiles',
  ];

  const data: Record<string, unknown[]> = {};

  for (const store of stores) {
    data[store] = await getAll(store);
  }

  return data;
}

export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
}> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentUsed: estimate.quota
        ? ((estimate.usage || 0) / estimate.quota) * 100
        : 0,
    };
  }
  return { usage: 0, quota: 0, percentUsed: 0 };
}
