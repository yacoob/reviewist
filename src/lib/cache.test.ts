import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
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

beforeEach(async () => {
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
});
