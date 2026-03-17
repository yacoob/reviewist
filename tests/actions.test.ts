import { describe, it, expect } from 'vitest';
import { groupActionsByDay, sortKey, compareProjects } from '../src/lib/actions';
import type { CompletedAction, Project } from '../src/lib/types';
import { TODOIST_COLORS } from '../src/lib/colors';
import { fmtLocalDate } from '../src/lib/dates';

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
  p2: { name: 'Home', color: 'green' },
};

describe('groupActionsByDay', () => {
  it('returns empty array for no actions', () => {
    expect(groupActionsByDay([], projects)).toEqual([]);
  });

  it('groups a single action into one day', () => {
    const result = groupActionsByDay([action()], projects);
    expect(result).toHaveLength(1);
    expect(result[0].day).toBe(fmtLocalDate(new Date('2026-02-20T10:00:00Z')));
    expect(result[0].actionCount).toBe(1);
  });

  it('sorts days newest-first', () => {
    const actions = [
      action({ completed_at: '2026-02-18T10:00:00Z' }),
      action({ completed_at: '2026-02-20T10:00:00Z' }),
      action({ completed_at: '2026-02-19T10:00:00Z' }),
    ];
    const result = groupActionsByDay(actions, projects);
    const expected = [
      fmtLocalDate(new Date('2026-02-20T10:00:00Z')),
      fmtLocalDate(new Date('2026-02-19T10:00:00Z')),
      fmtLocalDate(new Date('2026-02-18T10:00:00Z')),
    ];
    expect(result.map((d) => d.day)).toEqual(expected);
  });

  it('puts actions with no completed_at into Unknown bucket', () => {
    const result = groupActionsByDay([action({ completed_at: '' })], projects);
    expect(result[0].day).toBe('Unknown');
    expect(result[0].label).toBe('Unknown date');
  });

  it('deduplicates recurring actions by content+project_id', () => {
    const actions = [
      action({ id: 'c1', content: 'Wax the cactus', completed_at: '2026-02-20T08:00:00Z' }),
      action({ id: 'c2', content: 'Wax the cactus', completed_at: '2026-02-20T18:00:00Z' }),
    ];
    const result = groupActionsByDay(actions, projects);
    const deduped = result[0].projectGroups[0].actions;
    expect(deduped).toHaveLength(1);
    expect(deduped[0].count).toBe(2);
    expect(deduped[0].allTimes).toEqual(['2026-02-20T08:00:00Z', '2026-02-20T18:00:00Z']);
    expect(deduped[0].completed_at).toBe('2026-02-20T18:00:00Z');
  });

  it('dedup keeps latest completed_at regardless of input order', () => {
    const actions = [
      action({ id: 'c1', content: 'Repeater', completed_at: '2026-02-20T18:00:00Z' }),
      action({ id: 'c2', content: 'Repeater', completed_at: '2026-02-20T08:00:00Z' }),
    ];
    const result = groupActionsByDay(actions, projects);
    const deduped = result[0].projectGroups[0].actions;
    expect(deduped).toHaveLength(1);
    expect(deduped[0].completed_at).toBe('2026-02-20T18:00:00Z');
    expect(deduped[0].count).toBe(2);
  });

  it('dedup handles actions with identical timestamps', () => {
    const actions = [
      action({ id: 'c1', content: 'Same time', completed_at: '2026-02-20T10:00:00Z' }),
      action({ id: 'c2', content: 'Same time', completed_at: '2026-02-20T10:00:00Z' }),
    ];
    const result = groupActionsByDay(actions, projects);
    const deduped = result[0].projectGroups[0].actions;
    expect(deduped).toHaveLength(1);
    expect(deduped[0].count).toBe(2);
  });

  it('does not deduplicate actions in different projects', () => {
    const actions = [
      action({ content: 'Same name', project_id: 'p1' }),
      action({ content: 'Same name', project_id: 'p2' }),
    ];
    const result = groupActionsByDay(actions, projects);
    const allActions = result[0].projectGroups.flatMap((g) => g.actions);
    expect(allActions).toHaveLength(2);
  });

  it('groups actions by project, sorted alphabetically with unfiled last', () => {
    const actions = [
      action({ project_id: 'p2' }),
      action({ project_id: 'p1', content: 'Another' }),
      action({ project_id: 'unknown_proj', content: 'Orphan' }),
    ];
    const result = groupActionsByDay(actions, { ...projects });
    const groups = result[0].projectGroups;
    expect(groups[0].projectId).toBe('p2'); // Home
    expect(groups[1].projectId).toBe('p1'); // Work
    expect(groups[2].unfiled).toBe(true);
  });

  it('uses red hex for unfiled projects', () => {
    const result = groupActionsByDay([action({ project_id: 'missing' })], {});
    expect(result[0].projectGroups[0].hex).toBe(TODOIST_COLORS.red);
    expect(result[0].projectGroups[0].unfiled).toBe(true);
  });

  it('maps known project colors to hex', () => {
    const result = groupActionsByDay([action()], projects);
    expect(result[0].projectGroups[0].hex).toBe(TODOIST_COLORS.blue);
  });

  it('returns null hex for unrecognized color key', () => {
    const result = groupActionsByDay([action()], {
      p1: { name: 'Work', color: 'neon_pink' },
    });
    expect(result[0].projectGroups[0].hex).toBeNull();
  });

  it('returns null hex for project with null color', () => {
    const result = groupActionsByDay([action()], {
      p1: { name: 'Work', color: null },
    });
    expect(result[0].projectGroups[0].hex).toBeNull();
  });

  it('handles actions with empty project_id', () => {
    const result = groupActionsByDay([action({ project_id: '' })], projects);
    const group = result[0].projectGroups[0];
    expect(group.unfiled).toBe(true);
    expect(group.hex).toBe(TODOIST_COLORS.red);
  });

  it('handles actions with empty content for dedup key', () => {
    const actions = [
      action({ content: '', task_id: 't1', id: 'c1', completed_at: '2026-02-20T08:00:00Z' }),
      action({ content: '', task_id: 't2', id: 'c2', completed_at: '2026-02-20T09:00:00Z' }),
    ];
    const result = groupActionsByDay(actions, projects);
    const deduped = result[0].projectGroups[0].actions;
    expect(deduped).toHaveLength(1);
    expect(deduped[0].count).toBe(2);
  });

  it('sorts multiple unfiled groups by project_id', () => {
    const actions = [
      action({ project_id: 'unknown_b', content: 'Action B' }),
      action({ project_id: 'unknown_a', content: 'Action A' }),
    ];
    const result = groupActionsByDay(actions, {});
    const groups = result[0].projectGroups;
    expect(groups).toHaveLength(2);
    expect(groups.every(g => g.unfiled)).toBe(true);
  });

  it('sorts note projects before regular projects, both alphabetically', () => {
    const mixedProjects: Record<string, Project> = {
      ev1: { name: 'Within', color: 'grey' },
      ev2: { name: 'Aside', color: 'grey' },
      reg1: { name: 'Work', color: 'blue' },
      reg2: { name: 'Home', color: 'green' },
    };
    const actions = [
      action({ project_id: 'reg1', content: 'Work action', task_id: 't1', id: 'c1' }),
      action({ project_id: 'ev1', content: 'Within note', task_id: 't2', id: 'c2' }),
      action({ project_id: 'reg2', content: 'Home action', task_id: 't3', id: 'c3' }),
      action({ project_id: 'ev2', content: 'Aside note', task_id: 't4', id: 'c4' }),
    ];
    const result = groupActionsByDay(actions, mixedProjects, new Set(['ev1', 'ev2']));
    const order = result[0].projectGroups.map(g => g.projectId);
    expect(order).toEqual(['ev2', 'ev1', 'reg2', 'reg1']); // Aside, Within, Home, Work
  });

  it('sorts note project actions alphabetically by first letter, ignoring emoji', () => {
    const noteProjects: Record<string, Project> = {
      ev: { name: 'Notes', color: 'grey' },
    };
    const actions = [
      action({ content: 'Zebra note', project_id: 'ev', task_id: 't1', id: 'c1', completed_at: '2026-02-20T10:00:00Z' }),
      action({ content: '🎉 Alpha note', project_id: 'ev', task_id: 't2', id: 'c2', completed_at: '2026-02-20T11:00:00Z' }),
      action({ content: 'middle note', project_id: 'ev', task_id: 't3', id: 'c3', completed_at: '2026-02-20T09:00:00Z' }),
    ];
    const result = groupActionsByDay(actions, noteProjects, new Set(['ev']));
    const sorted = result[0].projectGroups[0].actions;
    expect(sorted.map(t => t.content)).toEqual([
      '🎉 Alpha note',
      'middle note',
      'Zebra note',
    ]);
  });
});

describe('sortKey', () => {
  it('returns first letter lowercased', () => {
    expect(sortKey('Hello')).toBe('h');
  });

  it('skips leading emoji', () => {
    expect(sortKey('🎉 Party')).toBe('p');
  });

  it('skips multiple leading emoji', () => {
    expect(sortKey('🐱🐶 Animals')).toBe('a');
  });

  it('handles non-ASCII letters', () => {
    expect(sortKey('Übermensch')).toBe('ü');
  });

  it('falls back to full string when no letters', () => {
    expect(sortKey('123')).toBe('123');
  });
});

describe('compareProjects', () => {
  const testProjects: Record<string, Project> = {
    ev1: { name: 'Aside', color: 'grey' },
    ev2: { name: 'Within', color: 'grey' },
    reg1: { name: 'Home', color: 'green' },
    reg2: { name: 'Work', color: 'blue' },
  };
  const noteIds = new Set(['ev1', 'ev2']);

  it('sorts note projects before regular projects', () => {
    expect(compareProjects('ev1', 'reg1', testProjects, noteIds)).toBeLessThan(0);
    expect(compareProjects('reg1', 'ev2', testProjects, noteIds)).toBeGreaterThan(0);
  });

  it('sorts note projects alphabetically among themselves', () => {
    expect(compareProjects('ev1', 'ev2', testProjects, noteIds)).toBeLessThan(0); // Aside < Within
  });

  it('sorts regular projects alphabetically among themselves', () => {
    expect(compareProjects('reg1', 'reg2', testProjects, noteIds)).toBeLessThan(0); // Home < Work
  });

  it('sorts unfiled projects last', () => {
    expect(compareProjects('missing', 'reg1', testProjects, noteIds)).toBeGreaterThan(0);
    expect(compareProjects('missing', 'ev1', testProjects, noteIds)).toBeGreaterThan(0);
  });
});
