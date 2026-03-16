import { describe, it, expect } from 'vitest';
import { groupTasksByDay, sortKey } from '../src/lib/tasks';
import type { CompletedTask, Project } from '../src/lib/types';
import { TODOIST_COLORS } from '../src/lib/colors';

function task(overrides: Partial<CompletedTask> = {}): CompletedTask {
  return {
    content: 'Test task',
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

describe('groupTasksByDay', () => {
  it('returns empty array for no tasks', () => {
    expect(groupTasksByDay([], projects)).toEqual([]);
  });

  it('groups a single task into one day', () => {
    const result = groupTasksByDay([task()], projects);
    expect(result).toHaveLength(1);
    expect(result[0].day).toBe('2026-02-20');
    expect(result[0].taskCount).toBe(1);
  });

  it('sorts days newest-first', () => {
    const tasks = [
      task({ completed_at: '2026-02-18T10:00:00Z' }),
      task({ completed_at: '2026-02-20T10:00:00Z' }),
      task({ completed_at: '2026-02-19T10:00:00Z' }),
    ];
    const result = groupTasksByDay(tasks, projects);
    expect(result.map((d) => d.day)).toEqual(['2026-02-20', '2026-02-19', '2026-02-18']);
  });

  it('puts tasks with no completed_at into Unknown bucket', () => {
    const result = groupTasksByDay([task({ completed_at: '' })], projects);
    expect(result[0].day).toBe('Unknown');
    expect(result[0].label).toBe('Unknown date');
  });

  it('deduplicates recurring tasks by content+project_id', () => {
    const tasks = [
      task({ id: 'c1', content: 'Wax the cactus', completed_at: '2026-02-20T08:00:00Z' }),
      task({ id: 'c2', content: 'Wax the cactus', completed_at: '2026-02-20T18:00:00Z' }),
    ];
    const result = groupTasksByDay(tasks, projects);
    const deduped = result[0].projectGroups[0].tasks;
    expect(deduped).toHaveLength(1);
    expect(deduped[0].count).toBe(2);
    expect(deduped[0].allTimes).toEqual(['2026-02-20T08:00:00Z', '2026-02-20T18:00:00Z']);
    expect(deduped[0].completed_at).toBe('2026-02-20T18:00:00Z');
  });

  it('dedup keeps latest completed_at regardless of input order', () => {
    const tasks = [
      task({ id: 'c1', content: 'Repeater', completed_at: '2026-02-20T18:00:00Z' }),
      task({ id: 'c2', content: 'Repeater', completed_at: '2026-02-20T08:00:00Z' }),
    ];
    const result = groupTasksByDay(tasks, projects);
    const deduped = result[0].projectGroups[0].tasks;
    expect(deduped).toHaveLength(1);
    expect(deduped[0].completed_at).toBe('2026-02-20T18:00:00Z');
    expect(deduped[0].count).toBe(2);
  });

  it('dedup handles tasks with identical timestamps', () => {
    const tasks = [
      task({ id: 'c1', content: 'Same time', completed_at: '2026-02-20T10:00:00Z' }),
      task({ id: 'c2', content: 'Same time', completed_at: '2026-02-20T10:00:00Z' }),
    ];
    const result = groupTasksByDay(tasks, projects);
    const deduped = result[0].projectGroups[0].tasks;
    expect(deduped).toHaveLength(1);
    expect(deduped[0].count).toBe(2);
  });

  it('does not deduplicate tasks in different projects', () => {
    const tasks = [
      task({ content: 'Same name', project_id: 'p1' }),
      task({ content: 'Same name', project_id: 'p2' }),
    ];
    const result = groupTasksByDay(tasks, projects);
    const allTasks = result[0].projectGroups.flatMap((g) => g.tasks);
    expect(allTasks).toHaveLength(2);
  });

  it('groups tasks by project, sorted alphabetically with unfiled last', () => {
    const tasks = [
      task({ project_id: 'p2' }),
      task({ project_id: 'p1', content: 'Another' }),
      task({ project_id: 'unknown_proj', content: 'Orphan' }),
    ];
    const result = groupTasksByDay(tasks, { ...projects });
    const groups = result[0].projectGroups;
    expect(groups[0].projectId).toBe('p2'); // Home
    expect(groups[1].projectId).toBe('p1'); // Work
    expect(groups[2].unfiled).toBe(true);
  });

  it('uses red hex for unfiled projects', () => {
    const result = groupTasksByDay([task({ project_id: 'missing' })], {});
    expect(result[0].projectGroups[0].hex).toBe(TODOIST_COLORS.red);
    expect(result[0].projectGroups[0].unfiled).toBe(true);
  });

  it('maps known project colors to hex', () => {
    const result = groupTasksByDay([task()], projects);
    expect(result[0].projectGroups[0].hex).toBe(TODOIST_COLORS.blue);
  });

  it('returns null hex for unrecognized color key', () => {
    const result = groupTasksByDay([task()], {
      p1: { name: 'Work', color: 'neon_pink' },
    });
    expect(result[0].projectGroups[0].hex).toBeNull();
  });

  it('returns null hex for project with null color', () => {
    const result = groupTasksByDay([task()], {
      p1: { name: 'Work', color: null },
    });
    expect(result[0].projectGroups[0].hex).toBeNull();
  });

  it('handles tasks with empty project_id', () => {
    const result = groupTasksByDay([task({ project_id: '' })], projects);
    const group = result[0].projectGroups[0];
    expect(group.unfiled).toBe(true);
    expect(group.hex).toBe(TODOIST_COLORS.red);
  });

  it('handles tasks with empty content for dedup key', () => {
    const tasks = [
      task({ content: '', task_id: 't1', id: 'c1', completed_at: '2026-02-20T08:00:00Z' }),
      task({ content: '', task_id: 't2', id: 'c2', completed_at: '2026-02-20T09:00:00Z' }),
    ];
    const result = groupTasksByDay(tasks, projects);
    const deduped = result[0].projectGroups[0].tasks;
    expect(deduped).toHaveLength(1);
    expect(deduped[0].count).toBe(2);
  });

  it('sorts multiple unfiled groups by project_id', () => {
    const tasks = [
      task({ project_id: 'unknown_b', content: 'Task B' }),
      task({ project_id: 'unknown_a', content: 'Task A' }),
    ];
    const result = groupTasksByDay(tasks, {});
    const groups = result[0].projectGroups;
    expect(groups).toHaveLength(2);
    expect(groups.every(g => g.unfiled)).toBe(true);
  });

  it('sorts event project tasks alphabetically by first letter, ignoring emoji', () => {
    const eventProjects: Record<string, Project> = {
      ev: { name: 'Events', color: 'grey' },
    };
    const tasks = [
      task({ content: 'Zebra event', project_id: 'ev', task_id: 't1', id: 'c1', completed_at: '2026-02-20T10:00:00Z' }),
      task({ content: '🎉 Alpha event', project_id: 'ev', task_id: 't2', id: 'c2', completed_at: '2026-02-20T11:00:00Z' }),
      task({ content: 'middle event', project_id: 'ev', task_id: 't3', id: 'c3', completed_at: '2026-02-20T09:00:00Z' }),
    ];
    const result = groupTasksByDay(tasks, eventProjects, 'ev');
    const sorted = result[0].projectGroups[0].tasks;
    expect(sorted.map(t => t.content)).toEqual([
      '🎉 Alpha event',
      'middle event',
      'Zebra event',
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
