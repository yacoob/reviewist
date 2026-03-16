import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB } from '../src/lib/cache';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('cache upgrade', () => {
  it('drops and recreates store on version upgrade', async () => {
    // Seed a v2 DB so the v3 upgrade has an existing store to drop
    const dbV2 = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('reviewist', 2);
      req.onupgradeneeded = () => req.result.createObjectStore('cache', { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbV2.close();

    // openDB() opens at v3, triggering onupgradeneeded which drops and recreates the store
    const db = await openDB();
    expect(db.objectStoreNames.contains('cache')).toBe(true);
    db.close();
  });
});
