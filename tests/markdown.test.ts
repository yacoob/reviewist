import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/lib/markdown';
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

describe('renderMarkdown', () => {
  it('renders range header', () => {
    const result = renderMarkdown([], projects, noteIds, range);
    expect(result).toContain('---\ncssclasses: [reviewist]\n---');
    expect(result).toContain('# Review: 2026-02-01 to 2026-02-28');
    // No day sections for empty input
    expect(result).not.toMatch(/^## /m);
  });

  it('renders a single action with day header', () => {
    const result = renderMarkdown([action()], projects, noteIds, range);
    expect(result).toContain('# Review: 2026-02-01 to 2026-02-28');
    expect(result).toMatch(/^## .+/m);
    expect(result).toMatch(/- \[x] \d{2}:\d{2} · Test action/);
  });

  it('groups actions by local date', () => {
    const actions = [
      action({ completed_at: '2026-02-20T10:00:00Z' }),
      action({ completed_at: '2026-02-21T10:00:00Z', task_id: 't2', id: 'c2' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    const headers = result.match(/^## .+/gm);
    expect(headers).toHaveLength(2);
  });

  it('inserts --- between weeks', () => {
    // Feb 20 (Fri) and Feb 23 (Mon) are in different ISO weeks
    const actions = [
      action({ completed_at: '2026-02-20T10:00:00Z' }),
      action({ completed_at: '2026-02-23T10:00:00Z', task_id: 't2', id: 'c2' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    expect(result).toContain('\n---\n');
  });

  it('does not insert --- within the same week', () => {
    // Feb 18 (Wed) and Feb 20 (Fri) are in the same ISO week
    const actions = [
      action({ completed_at: '2026-02-18T10:00:00Z' }),
      action({ completed_at: '2026-02-20T10:00:00Z', task_id: 't2', id: 'c2' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    // Strip frontmatter before checking for week separators
    const body = result.replace(/^---\n[\s\S]*?\n---\n/, '');
    expect(body).not.toContain('\n---\n');
  });

  it('sorts days oldest-first', () => {
    const actions = [
      action({ completed_at: '2026-02-22T10:00:00Z', task_id: 't3', id: 'c3' }),
      action({ completed_at: '2026-02-20T10:00:00Z' }),
      action({ completed_at: '2026-02-21T10:00:00Z', task_id: 't2', id: 'c2' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    const headers = result.match(/^## .+/gm)!;
    expect(headers[0]).toContain('20');
    expect(headers[1]).toContain('21');
    expect(headers[2]).toContain('22');
  });

  it('sorts actions within a day by completion time', () => {
    const actions = [
      action({ completed_at: '2026-02-20T18:00:00Z', content: 'Late', task_id: 't2', id: 'c2' }),
      action({ completed_at: '2026-02-20T08:00:00Z', content: 'Early' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    const earlyIdx = result.indexOf('Early');
    const lateIdx = result.indexOf('Late');
    expect(earlyIdx).toBeLessThan(lateIdx);
  });

  it('sorts actions across projects by completion time, not project name', () => {
    const multiProjects: Record<string, Project> = {
      p1: { name: 'Zebra', color: 'blue' },
      p2: { name: 'Aside', color: 'grey' },
      p3: { name: 'Alpha', color: 'green' },
    };
    const actions = [
      action({ completed_at: '2026-02-20T18:00:00Z', content: 'Late from Alpha', project_id: 'p3', task_id: 't3', id: 'c3' }),
      action({ completed_at: '2026-02-20T08:00:00Z', content: 'Early from Zebra', project_id: 'p1' }),
    ];
    const result = renderMarkdown(actions, multiProjects, new Set(['p2']), range);
    const earlyIdx = result.indexOf('Early from Zebra');
    const lateIdx = result.indexOf('Late from Alpha');
    expect(earlyIdx).toBeLessThan(lateIdx);
  });

  it('deduplicates recurring actions with count', () => {
    const actions = [
      action({ content: 'Recurring', completed_at: '2026-02-20T08:00:00Z', id: 'c1' }),
      action({ content: 'Recurring', completed_at: '2026-02-20T18:00:00Z', id: 'c2' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    expect(result).toContain('×2');
    expect(result.match(/Recurring/g)).toHaveLength(1);
  });

  it('does not show count for non-recurring actions', () => {
    const result = renderMarkdown([action()], projects, noteIds, range);
    expect(result).not.toContain('×');
  });

  it('renders notes as blockquotes, actions as checked list items', () => {
    const actions = [
      action({ content: '🗓️ Unicorn spotted', project_id: 'p2' }),
      action({ content: 'Feed the kraken', project_id: 'p1', task_id: 't2', id: 'c2' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    expect(result).toContain('> 🗓️ Unicorn spotted');
    expect(result).not.toContain('- [x] Unicorn');
    expect(result).toContain('- [x]');
    expect(result).toContain('Feed the kraken');
  });

  it('renders notes without timestamp', () => {
    const result = renderMarkdown(
      [action({ content: '🗓️ Unicorn spotted', project_id: 'p2' })],
      projects, noteIds, range,
    );
    expect(result).toContain('> 🗓️ Unicorn spotted');
    expect(result).not.toMatch(/\d{2}:\d{2} · Unicorn/);
  });

  it('renders pre-prepared note content', () => {
    const result = renderMarkdown(
      [action({ content: '🗓️ Goblin sighting confirmed', project_id: 'p2' })],
      projects, noteIds, range,
    );
    expect(result).toContain('> 🗓️ Goblin sighting confirmed');
  });

  it('does not strip "* " prefix from non-note content', () => {
    const result = renderMarkdown(
      [action({ content: '* starred item', project_id: 'p1' })],
      projects, noteIds, range,
    );
    expect(result).toContain('- [x]');
    expect(result).toContain('* starred item');
  });

  it('sorts notes alphabetically (ignoring leading emoji) before actions', () => {
    const actions = [
      action({ content: 'Feed the kraken', completed_at: '2026-02-20T08:00:00Z', project_id: 'p1' }),
      action({ content: '🗓️ Yeti footprints found', completed_at: '2026-02-20T10:00:00Z', project_id: 'p2', task_id: 't2', id: 'c2' }),
      action({ content: '🎉 Dragon eggs hatched', completed_at: '2026-02-20T12:00:00Z', project_id: 'p2', task_id: 't3', id: 'c3' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    const dragonIdx = result.indexOf('Dragon eggs hatched');
    const yetiIdx = result.indexOf('Yeti footprints found');
    const krakenIdx = result.indexOf('Feed the kraken');
    expect(dragonIdx).toBeLessThan(yetiIdx);
    expect(yetiIdx).toBeLessThan(krakenIdx);
  });

  it('handles missing projects without crashing', () => {
    const result = renderMarkdown(
      [action({ project_id: 'missing' })],
      projects, noteIds, range,
    );
    expect(result).toContain('Test action');
  });

  it('does not deduplicate across different projects', () => {
    const actions = [
      action({ content: 'Same name', project_id: 'p1' }),
      action({ content: 'Same name', project_id: 'p2', task_id: 't2', id: 'c2' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    expect(result.match(/Same name/g)).toHaveLength(2);
  });

  it('uses latest time for deduped recurring actions', () => {
    const actions = [
      action({ content: 'Recurring', completed_at: '2026-02-20T08:00:00Z', id: 'c1' }),
      action({ content: 'Recurring', completed_at: '2026-02-20T18:00:00Z', id: 'c2' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    const expectedTime = new Date('2026-02-20T18:00:00Z')
      .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    expect(result).toContain(`${expectedTime} · Recurring`);
  });

  it('puts actions with empty completed_at into Unknown date bucket', () => {
    const result = renderMarkdown(
      [action({ completed_at: '' })],
      projects, noteIds, range,
    );
    expect(result).toContain('## Unknown date');
  });

  it('uses custom title when provided', () => {
    const result = renderMarkdown([], projects, noteIds, range, 'March 2026');
    expect(result).toContain('# March 2026');
    expect(result).not.toContain('Review:');
  });

  it('ends with a trailing newline', () => {
    const result = renderMarkdown([action()], projects, noteIds, range);
    expect(result.endsWith('\n')).toBe(true);
  });
});
