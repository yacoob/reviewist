import { describe, it, expect, vi, afterEach } from 'vitest';
import { newestEventDate, mergeEvents } from '../src/lib/events';
import type { ActivityEvent } from '../src/lib/types';

function event(objectId: string, date: string, type: 'completed' | 'uncompleted' = 'completed'): ActivityEvent {
  return {
    id: 12345,
    event_date: date,
    event_type: type,
    object_id: objectId,
    object_type: 'item',
    parent_project_id: 'proj1',
    parent_item_id: null,
    initiator_id: 'user1',
    extra_data: { content: `Task ${objectId}` },
  };
}

describe('newestEventDate', () => {
  it('returns null for empty array', () => {
    expect(newestEventDate([])).toBeNull();
  });

  it('returns event_date of last element', () => {
    const events = [
      event('a', '2026-02-20T10:00:00Z'),
      event('b', '2026-02-21T10:00:00Z'),
    ];
    expect(newestEventDate(events)).toBe('2026-02-21T10:00:00Z');
  });

  it('returns the only element for single-element array', () => {
    const events = [event('a', '2026-02-20T10:00:00Z')];
    expect(newestEventDate(events)).toBe('2026-02-20T10:00:00Z');
  });
});

describe('mergeEvents', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('merges two disjoint event arrays', () => {
    vi.useFakeTimers({ now: new Date('2026-03-01T00:00:00Z') });
    const a = [event('a', '2026-02-20T10:00:00Z')];
    const b = [event('b', '2026-02-21T10:00:00Z')];
    const merged = mergeEvents(a, b);
    expect(merged).toHaveLength(2);
    expect(merged[0].object_id).toBe('a');
    expect(merged[1].object_id).toBe('b');
  });

  it('deduplicates events with same object_id and event_date', () => {
    vi.useFakeTimers({ now: new Date('2026-03-01T00:00:00Z') });
    const a = [event('a', '2026-02-20T10:00:00Z')];
    const b = [event('a', '2026-02-20T10:00:00Z')];
    const merged = mergeEvents(a, b);
    expect(merged).toHaveLength(1);
  });

  it('keeps events with same object_id but different dates', () => {
    vi.useFakeTimers({ now: new Date('2026-03-01T00:00:00Z') });
    const a = [event('a', '2026-02-20T10:00:00Z')];
    const b = [event('a', '2026-02-21T10:00:00Z')];
    const merged = mergeEvents(a, b);
    expect(merged).toHaveLength(2);
  });

  it('sorts merged events by event_date ascending', () => {
    vi.useFakeTimers({ now: new Date('2026-03-01T00:00:00Z') });
    const a = [event('c', '2026-02-22T10:00:00Z')];
    const b = [event('a', '2026-02-20T10:00:00Z'), event('b', '2026-02-21T10:00:00Z')];
    const merged = mergeEvents(a, b);
    expect(merged.map(e => e.object_id)).toEqual(['a', 'b', 'c']);
  });

  it('evicts events older than 6 weeks', () => {
    vi.useFakeTimers({ now: new Date('2026-03-05T00:00:00Z') });
    const old = event('old', '2026-01-01T10:00:00Z'); // well beyond 6 weeks
    const recent = event('recent', '2026-03-04T10:00:00Z');
    const merged = mergeEvents([old], [recent]);
    expect(merged).toHaveLength(1);
    expect(merged[0].object_id).toBe('recent');
  });

  it('returns empty array when all events are too old', () => {
    vi.useFakeTimers({ now: new Date('2026-03-05T00:00:00Z') });
    const old = [event('a', '2026-01-01T10:00:00Z'), event('b', '2026-01-02T10:00:00Z')];
    const merged = mergeEvents(old, []);
    expect(merged).toHaveLength(0);
  });

  it('handles empty inputs', () => {
    const merged = mergeEvents([], []);
    expect(merged).toHaveLength(0);
  });
});
