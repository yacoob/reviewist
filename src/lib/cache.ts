import type { ActivityEvent, Project } from './types';

export interface CachedState {
  events: ActivityEvent[];
  projects: Record<string, Project>;
  fetchedAt: number;
}

const DB_NAME = 'reviewist';
const DB_VERSION = 2;
const STORE_NAME = 'cache';
const CACHE_KEY = 'state';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Drop v1 store if upgrading
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function computeHash(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

export async function loadCachedState(): Promise<CachedState | null> {
  try {
    const db = await openDB();
    const row = await new Promise<Record<string, unknown> | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });

    if (!row) return null;

    const events = row.events as ActivityEvent[];
    const projects = row.projects as Record<string, Project>;
    const fetchedAt = row.fetchedAt as number;

    // Structural check
    if (!Array.isArray(events) || events.length !== row.eventCount) {
      console.warn('[store] IndexedDB cache failed structural check, discarding');
      return null;
    }

    // Content hash check
    const expected = row.hash as string;
    if (expected) {
      const actual = await computeHash(JSON.stringify(events));
      if (actual !== expected) {
        console.warn('[store] IndexedDB cache failed hash check, discarding');
        return null;
      }
    }

    return { events, projects, fetchedAt };
  } catch (e) {
    console.error('[cache] load failed:', e);
    return null;
  }
}

export async function saveCachedState(events: ActivityEvent[], projects: Record<string, Project>): Promise<void> {
  try {
    const db = await openDB();
    const hash = await computeHash(JSON.stringify(events));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        key: CACHE_KEY,
        events,
        projects,
        fetchedAt: Date.now(),
        eventCount: events.length,
        hash,
      });
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[cache] save failed:', e);
  }
}

export async function clearCachedState(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Cache is best-effort
  }
}
