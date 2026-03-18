import { describe, it, expect } from 'vitest';
import { reconcile } from '../src/lib/reconcile';
import { BLOCKLIST } from '../src/lib/constants';
import type { ActivityEvent } from '../src/lib/types';

function ev(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 1,
    event_date: '2026-02-20T10:00:00Z',
    event_type: 'completed',
    object_id: 'task1',
    object_type: 'item',
    parent_project_id: 'proj1',
    parent_item_id: null,
    initiator_id: 'user1',
    extra_data: { content: 'Test task' },
    ...overrides,
  };
}

describe('reconcile', () => {
  it('returns empty array for no events', () => {
    expect(reconcile([])).toEqual([]);
  });

  it('maps a single completed event to a CompletedAction', () => {
    const result = reconcile([ev()]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'task1|2026-02-20T10:00:00Z',
      content: 'Test task',
      completed_at: '2026-02-20T10:00:00Z',
      project_id: 'proj1',
      task_id: 'task1',
    });
  });

  it('keeps multiple completions of the same object_id (recurring tasks)', () => {
    const result = reconcile([
      ev({ event_date: '2026-02-20T10:00:00Z' }),
      ev({ event_date: '2026-02-21T10:00:00Z' }),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].completed_at).toBe('2026-02-20T10:00:00Z');
    expect(result[1].completed_at).toBe('2026-02-21T10:00:00Z');
  });

  it('uncompleted cancels the most recent preceding completed', () => {
    const result = reconcile([
      ev({ event_date: '2026-02-20T10:00:00Z' }),
      ev({ event_type: 'uncompleted', event_date: '2026-02-20T11:00:00Z' }),
    ]);
    expect(result).toHaveLength(0);
  });

  it('uncompleted cancels only one completion', () => {
    const result = reconcile([
      ev({ event_date: '2026-02-20T08:00:00Z' }),
      ev({ event_date: '2026-02-20T10:00:00Z' }),
      ev({ event_type: 'uncompleted', event_date: '2026-02-20T11:00:00Z' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].completed_at).toBe('2026-02-20T08:00:00Z');
  });

  it('complete-uncomplete-complete leaves one completion', () => {
    const result = reconcile([
      ev({ event_date: '2026-02-20T08:00:00Z' }),
      ev({ event_type: 'uncompleted', event_date: '2026-02-20T09:00:00Z' }),
      ev({ event_date: '2026-02-20T10:00:00Z' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].completed_at).toBe('2026-02-20T10:00:00Z');
  });

  it('handles events arriving out of chronological order', () => {
    const result = reconcile([
      ev({ event_type: 'uncompleted', event_date: '2026-02-20T11:00:00Z' }),
      ev({ event_date: '2026-02-20T10:00:00Z' }),
    ]);
    expect(result).toHaveLength(0);
  });

  it('groups events by object_id independently', () => {
    const result = reconcile([
      ev({ object_id: 'a', event_date: '2026-02-20T10:00:00Z' }),
      ev({ object_id: 'b', event_date: '2026-02-20T10:00:00Z' }),
      ev({ object_id: 'a', event_type: 'uncompleted', event_date: '2026-02-20T11:00:00Z' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].task_id).toBe('b');
  });

  it('defaults content to empty string when extra_data.content is missing', () => {
    const result = reconcile([ev({ extra_data: {} })]);
    expect(result[0].content).toBe('');
  });

  it('defaults project_id to empty string when parent_project_id is null', () => {
    const result = reconcile([ev({ parent_project_id: null })]);
    expect(result[0].project_id).toBe('');
  });

  it('uncompleted with no preceding completed is a no-op', () => {
    const result = reconcile([
      ev({ event_type: 'uncompleted', event_date: '2026-02-20T10:00:00Z' }),
    ]);
    expect(result).toEqual([]);
  });

  it('handles events with identical timestamps', () => {
    const result = reconcile([
      ev({ object_id: 'a', event_date: '2026-02-20T10:00:00Z' }),
      ev({ object_id: 'b', event_date: '2026-02-20T10:00:00Z' }),
    ]);
    expect(result).toHaveLength(2);
  });
});

describe('blocklist filtering', () => {
  it('blocklisted task IDs produce no completed tasks', () => {
    const blocklistedId = [...BLOCKLIST][0];
    const events = [
      ev({ object_id: blocklistedId }),
      ev({ object_id: 'allowed_task' }),
    ];
    const filtered = events.filter(e => !BLOCKLIST.has(e.object_id));
    const result = reconcile(filtered);
    expect(result).toHaveLength(1);
    expect(result[0].task_id).toBe('allowed_task');
  });

  it('filters all completions of a blocklisted recurring task', () => {
    const blocklistedId = [...BLOCKLIST][0];
    const events = [
      ev({ object_id: blocklistedId, event_date: '2026-02-20T10:00:00Z' }),
      ev({ object_id: blocklistedId, event_date: '2026-02-21T10:00:00Z' }),
      ev({ object_id: blocklistedId, event_date: '2026-02-22T10:00:00Z' }),
    ];
    const filtered = events.filter(e => !BLOCKLIST.has(e.object_id));
    const result = reconcile(filtered);
    expect(result).toHaveLength(0);
  });

  it('does not filter tasks that are not in the blocklist', () => {
    const events = [
      ev({ object_id: 'safe_task_1' }),
      ev({ object_id: 'safe_task_2' }),
    ];
    const filtered = events.filter(e => !BLOCKLIST.has(e.object_id));
    const result = reconcile(filtered);
    expect(result).toHaveLength(2);
  });
});
