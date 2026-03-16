import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadCachedState, saveCachedState, clearCachedState } from '../src/lib/cache';
import type { ActivityEvent, Project } from '../src/lib/types';

function event(objectId: string, type: 'completed' | 'uncompleted' = 'completed'): ActivityEvent {
  return {
    id: 12345,
    event_date: '2026-02-20T10:00:00.000000Z',
    event_type: type,
    object_id: objectId,
    object_type: 'item',
    parent_project_id: 'proj1',
    parent_item_id: null,
    initiator_id: 'user1',
    extra_data: { content: `Task ${objectId}` },
  };
}

const projects: Record<string, Project> = {
  proj1: { name: 'Work', color: 'blue' },
};

/** Directly mutate the cached record in IndexedDB for tampering tests. */
async function tamperCache(mutate: (row: Record<string, unknown>) => void): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('reviewist', 3);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const row = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const tx = db.transaction('cache', 'readonly');
    const req = tx.objectStore('cache').get('state');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  mutate(row);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('cache', 'readwrite');
    const req = tx.objectStore('cache').put(row);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });
}

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await clearCachedState();
});

describe('cache', () => {
  it('returns null when nothing is cached', async () => {
    expect(await loadCachedState()).toBeNull();
  });

  it('round-trips events and projects', async () => {
    const events = [event('a'), event('b')];
    await saveCachedState(events, projects);
    const cached = await loadCachedState();
    expect(cached).not.toBeNull();
    expect(cached!.events).toEqual(events);
    expect(cached!.projects).toEqual(projects);
    expect(cached!.fetchedAt).toBeGreaterThan(0);
  });

  it('overwrites previous cache on save', async () => {
    await saveCachedState([event('old')], projects);
    await saveCachedState([event('new')], projects);
    const cached = await loadCachedState();
    expect(cached!.events).toHaveLength(1);
    expect(cached!.events[0].object_id).toBe('new');
  });

  it('clear removes cached data', async () => {
    await saveCachedState([event('a')], projects);
    await clearCachedState();
    expect(await loadCachedState()).toBeNull();
  });

  it('returns null when eventCount is tampered', async () => {
    await saveCachedState([event('a'), event('b')], projects);
    await tamperCache(row => { row.eventCount = 99; });
    expect(await loadCachedState()).toBeNull();
  });

  it('returns null when hash is tampered', async () => {
    await saveCachedState([event('a')], projects);
    await tamperCache(row => { row.hash = 'deadbeef'; });
    expect(await loadCachedState()).toBeNull();
  });
});
