import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadCachedState, saveCachedState, clearCachedState } from './cache';
import type { CompletedTask, Project } from './types';

function task(id: string): CompletedTask {
  return {
    id,
    content: `Task ${id}`,
    completed_at: '2026-02-20T10:00:00Z',
    project_id: 'proj1',
    task_id: id,
  };
}

const projects: Record<string, Project> = {
  proj1: { name: 'Work', color: 'blue' },
};

/** Directly mutate the cached record in IndexedDB for tampering tests. */
async function tamperCache(mutate: (row: Record<string, unknown>) => void): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('reviewist', 1);
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

  it('round-trips tasks and projects', async () => {
    const tasks = [task('a'), task('b')];
    await saveCachedState(tasks, projects);
    const cached = await loadCachedState();
    expect(cached).not.toBeNull();
    expect(cached!.tasks).toEqual(tasks);
    expect(cached!.projects).toEqual(projects);
    expect(cached!.fetchedAt).toBeGreaterThan(0);
  });

  it('overwrites previous cache on save', async () => {
    await saveCachedState([task('old')], projects);
    await saveCachedState([task('new')], projects);
    const cached = await loadCachedState();
    expect(cached!.tasks).toHaveLength(1);
    expect(cached!.tasks[0].id).toBe('new');
  });

  it('clear removes cached data', async () => {
    await saveCachedState([task('a')], projects);
    await clearCachedState();
    expect(await loadCachedState()).toBeNull();
  });

  it('returns null when taskCount is tampered', async () => {
    await saveCachedState([task('a'), task('b')], projects);
    await tamperCache(row => { row.taskCount = 99; });
    expect(await loadCachedState()).toBeNull();
  });

  it('returns null when hash is tampered', async () => {
    await saveCachedState([task('a')], projects);
    await tamperCache(row => { row.hash = 'deadbeef'; });
    expect(await loadCachedState()).toBeNull();
  });
});
