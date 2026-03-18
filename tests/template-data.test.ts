import { describe, it, expect } from 'vitest';
import { buildTemplateData } from '../src/lib/template-data';
import type { CompletedAction, Project } from '../src/lib/types';

function action(overrides: Partial<CompletedAction> = {}): CompletedAction {
  return {
    content: 'Test action',
    completed_at: '2026-02-20T10:00:00Z',
    project_id: 'p1',
    task_id: 't1',
    id: 'c1',
    ...overrides,
  };
}

const projects: Record<string, Project> = {
  p1: { name: 'Work', color: 'blue' },
  p2: { name: 'Aside', color: 'grey' },
};
const noteIds = new Set(['p2']);
const range = { since: '2026-02-01', until: '2026-02-28' };

describe('buildTemplateData', () => {
  it('returns empty days for no actions', () => {
    const result = buildTemplateData([], projects, noteIds, range);
    expect(result.days).toEqual([]);
    expect(result.range).toEqual(range);
  });

  it('groups actions by local date', () => {
    const actions = [
      action({ completed_at: '2026-02-20T10:00:00Z' }),
      action({ completed_at: '2026-02-21T10:00:00Z', task_id: 't2', id: 'c2' }),
    ];
    const result = buildTemplateData(actions, projects, noteIds, range);
    expect(result.days).toHaveLength(2);
  });

  it('sorts days oldest-first', () => {
    const actions = [
      action({ completed_at: '2026-02-22T10:00:00Z', task_id: 't3', id: 'c3' }),
      action({ completed_at: '2026-02-20T10:00:00Z' }),
      action({ completed_at: '2026-02-21T10:00:00Z', task_id: 't2', id: 'c2' }),
    ];
    const result = buildTemplateData(actions, projects, noteIds, range);
    const dates = result.days.map(d => d.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('sorts actions within a day by time', () => {
    const actions = [
      action({ completed_at: '2026-02-20T18:00:00Z', content: 'Late', task_id: 't2', id: 'c2' }),
      action({ completed_at: '2026-02-20T08:00:00Z', content: 'Early' }),
    ];
    const result = buildTemplateData(actions, projects, noteIds, range);
    expect(result.days[0].actions.map(a => a.content)).toEqual(['Early', 'Late']);
  });

  it('deduplicates recurring actions', () => {
    const actions = [
      action({ content: 'Recurring', completed_at: '2026-02-20T08:00:00Z', id: 'c1' }),
      action({ content: 'Recurring', completed_at: '2026-02-20T18:00:00Z', id: 'c2' }),
    ];
    const result = buildTemplateData(actions, projects, noteIds, range);
    expect(result.days[0].actions).toHaveLength(1);
    expect(result.days[0].actions[0].count).toBe(2);
  });

  it('enriches actions with project name and color', () => {
    const result = buildTemplateData([action()], projects, noteIds, range);
    const a = result.days[0].actions[0];
    expect(a.project_name).toBe('Work');
    expect(a.project_color).toBe('blue');
  });

  it('marks note project actions', () => {
    const result = buildTemplateData(
      [action({ project_id: 'p2' })],
      projects, noteIds, range,
    );
    expect(result.days[0].actions[0].is_note).toBe(true);
  });

  it('uses "Unknown" and null color for missing projects', () => {
    const result = buildTemplateData(
      [action({ project_id: 'missing' })],
      projects, noteIds, range,
    );
    expect(result.days[0].actions[0].project_name).toBe('Unknown');
    expect(result.days[0].actions[0].project_color).toBeNull();
  });

  it('includes local time string', () => {
    const result = buildTemplateData([action()], projects, noteIds, range);
    expect(result.days[0].actions[0].time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('uses latest time for deduped actions', () => {
    const actions = [
      action({ content: 'Recurring', completed_at: '2026-02-20T08:00:00Z', id: 'c1' }),
      action({ content: 'Recurring', completed_at: '2026-02-20T18:00:00Z', id: 'c2' }),
    ];
    const result = buildTemplateData(actions, projects, noteIds, range);
    const a = result.days[0].actions[0];
    expect(a.time).toBe(
      new Date('2026-02-20T18:00:00Z').toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    );
  });
});
