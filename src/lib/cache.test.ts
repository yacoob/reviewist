import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadCache, saveCache, clearCache } from './cache';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

const data = {
  tasks: [
    {
      content: 'Test',
      completed_at: '2026-02-20T10:00:00Z',
      project_id: 'p1',
      section_id: 's1',
      task_id: 't1',
      id: 'c1',
    },
  ],
  projects: { p1: { name: 'Work', color: 'blue' } },
  fetchedAt: Date.now(),
};

describe('cache', () => {
  it('round-trips save and load', () => {
    saveCache('2026-02-01', '2026-02-28', data);
    const loaded = loadCache('2026-02-01', '2026-02-28');
    expect(loaded).toEqual(data);
  });

  it('returns null for missing key', () => {
    expect(loadCache('2026-01-01', '2026-01-31')).toBeNull();
  });

  it('returns null and removes stale data (>7 days)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
    const staleData = { ...data, fetchedAt: Date.now() };
    saveCache('2026-01-01', '2026-01-31', staleData);

    vi.setSystemTime(new Date('2026-02-09T00:00:00Z'));
    expect(loadCache('2026-01-01', '2026-01-31')).toBeNull();
    expect(localStorage.getItem('reviewist_cache_2026-01-01|2026-01-31')).toBeNull();
  });

  it('clears only cache keys', () => {
    localStorage.setItem('reviewist_token', 'keep-me');
    saveCache('2026-02-01', '2026-02-28', data);
    clearCache();
    expect(localStorage.getItem('reviewist_token')).toBe('keep-me');
    expect(loadCache('2026-02-01', '2026-02-28')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem('reviewist_cache_2026-02-01|2026-02-28', '{bad json');
    expect(loadCache('2026-02-01', '2026-02-28')).toBeNull();
  });
});
