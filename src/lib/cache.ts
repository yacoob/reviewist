// ABOUTME: IndexedDB cache for completed tasks and projects.
// ABOUTME: Enables instant render from cached data on page load.

import type { CompletedTask, Project } from './types';

export interface CachedData {
  tasks: CompletedTask[];
  projects: Record<string, Project>;
  fetchedAt: number;
}

const DB_NAME = 'reviewist';
const DB_VERSION = 1;
const STORE_NAME = 'cache';
const STALE_THRESHOLD = 7 * 86400000; // 7 days

function cacheKey(since: string, until: string): string {
  return `${since}|${until}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadCache(since: string, until: string): Promise<CachedData | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(cacheKey(since, until));
    req.onsuccess = () => {
      const data = req.result as CachedData | undefined;
      if (!data || Date.now() - data.fetchedAt > STALE_THRESHOLD) {
        resolve(null);
      } else {
        resolve(data);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveCache(since: string, until: string, data: CachedData): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, cacheKey(since, until));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearCache(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
