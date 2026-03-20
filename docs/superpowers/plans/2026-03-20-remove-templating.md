# Remove Templating, Direct Markdown Output

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Nunjucks template engine with direct markdown string generation, merging `template-data.ts` and `render.ts` into a single `markdown.ts` module.

**Architecture:** `template-data.ts` (data transformation) and `render.ts` (Nunjucks rendering) merge into `markdown.ts`. It takes raw inputs (actions, projects, noteProjectIds, range) and returns a markdown string. The intermediate `TemplateData`/`TemplateAction`/`TemplateDay` types are removed — internal structuring stays but doesn't need to be exported. JSON output in `cli.ts` is unchanged.

**Tech Stack:** TypeScript, vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/markdown.ts` | Grouping, dedup, sorting, markdown string generation |
| Create | `tests/markdown.test.ts` | Merged tests from `template-data.test.ts` + `render.test.ts` |
| Modify | `src/cli.ts` | Switch from `buildTemplateData` + `renderTemplate` to `renderMarkdown` |
| Modify | `vite.config.ts:6-15` | Remove `rawNjk()` plugin |
| Modify | `package.json` | Remove `nunjucks` + `@types/nunjucks` |
| Modify | `src/vite-env.d.ts:3-6` | Remove `declare module '*.njk'` block |
| Delete | `src/lib/template-data.ts` | Merged into `markdown.ts` |
| Delete | `src/lib/render.ts` | Merged into `markdown.ts` |
| Delete | `src/templates/markdown.njk` | No longer needed |
| Delete | `tests/template-data.test.ts` | Merged into `markdown.test.ts` |
| Delete | `tests/render.test.ts` | Merged into `markdown.test.ts` |

## Target Markdown Format

The output format is unchanged from the current Nunjucks template. For reference:

```markdown
# Review: 2026-02-01 to 2026-02-28

## Feb 20 · Friday
- Unicorn spotted near the pond
- 08:00 · Feed the cats
- 11:00 · Buy milk
- 18:00 · Water plants ×3

## Feb 21 · Saturday
- 09:00 · Morning run
```

Rules:
- Header: `# Review: {since} to {until}`
- Days sorted oldest-first, each gets `## {label}` (label from `formatDayLabel`)
- Within each day: notes first (alphabetical, ignoring leading emoji), then actions (by completion time)
- Notes: `- {content}` (no time, `* ` prefix stripped)
- Actions: `- {time} · {content}` with optional ` ×{count}` for recurring (count > 1)
- Trailing newline

---

### Task 1: Create `markdown.ts` with tests

**Files:**
- Create: `src/lib/markdown.ts`
- Create: `tests/markdown.test.ts`

This task writes the new module and its full test suite. The logic is ported from `template-data.ts` (grouping, dedup, sorting, note detection) plus the string formatting that was in the Nunjucks template. The function signature:

```typescript
export function renderMarkdown(
  actions: CompletedAction[],
  projects: Record<string, Project>,
  noteProjectIds: Set<string>,
  range: { since: string; until: string },
): string
```

- [ ] **Step 1: Write the test file**

Create `tests/markdown.test.ts` with all test cases. These cover the same behaviors as the existing `template-data.test.ts` and `render.test.ts`, but assert against the final markdown string.

```typescript
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
    expect(result).toBe('# Review: 2026-02-01 to 2026-02-28\n');
  });

  it('renders a single action with day header', () => {
    const result = renderMarkdown([action()], projects, noteIds, range);
    expect(result).toContain('# Review: 2026-02-01 to 2026-02-28');
    expect(result).toMatch(/^## .+/m); // day header
    expect(result).toMatch(/- \d{2}:\d{2} · Test action/);
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

  it('sorts days oldest-first', () => {
    const actions = [
      action({ completed_at: '2026-02-22T10:00:00Z', task_id: 't3', id: 'c3' }),
      action({ completed_at: '2026-02-20T10:00:00Z' }),
      action({ completed_at: '2026-02-21T10:00:00Z', task_id: 't2', id: 'c2' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    const headers = result.match(/^## .+/gm)!;
    // Feb 20 before Feb 21 before Feb 22
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

  it('deduplicates recurring actions with count', () => {
    const actions = [
      action({ content: 'Recurring', completed_at: '2026-02-20T08:00:00Z', id: 'c1' }),
      action({ content: 'Recurring', completed_at: '2026-02-20T18:00:00Z', id: 'c2' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    expect(result).toContain('×2');
    // Only one line for this action
    expect(result.match(/Recurring/g)).toHaveLength(1);
  });

  it('does not show count for non-recurring actions', () => {
    const result = renderMarkdown([action()], projects, noteIds, range);
    expect(result).not.toContain('×');
  });

  it('renders notes without timestamp', () => {
    const result = renderMarkdown(
      [action({ content: '* Unicorn spotted', project_id: 'p2' })],
      projects, noteIds, range,
    );
    expect(result).toContain('- Unicorn spotted');
    expect(result).not.toMatch(/\d{2}:\d{2} · Unicorn/);
  });

  it('strips "* " prefix from note content', () => {
    const result = renderMarkdown(
      [action({ content: '* Goblin sighting confirmed', project_id: 'p2' })],
      projects, noteIds, range,
    );
    expect(result).toContain('- Goblin sighting confirmed');
    expect(result).not.toContain('* Goblin');
  });

  it('does not strip "* " prefix from non-note content', () => {
    const result = renderMarkdown(
      [action({ content: '* starred item', project_id: 'p1' })],
      projects, noteIds, range,
    );
    expect(result).toContain('* starred item');
  });

  it('sorts notes alphabetically (ignoring leading emoji) before actions', () => {
    const actions = [
      action({ content: 'Feed the kraken', completed_at: '2026-02-20T08:00:00Z', project_id: 'p1' }),
      action({ content: '* Yeti footprints found', completed_at: '2026-02-20T10:00:00Z', project_id: 'p2', task_id: 't2', id: 'c2' }),
      action({ content: '* 🎉 Dragon eggs hatched', completed_at: '2026-02-20T12:00:00Z', project_id: 'p2', task_id: 't3', id: 'c3' }),
    ];
    const result = renderMarkdown(actions, projects, noteIds, range);
    const dragonIdx = result.indexOf('Dragon eggs hatched');
    const yetiIdx = result.indexOf('Yeti footprints found');
    const krakenIdx = result.indexOf('Feed the kraken');
    // Notes before actions, notes alphabetical
    expect(dragonIdx).toBeLessThan(yetiIdx);
    expect(yetiIdx).toBeLessThan(krakenIdx);
  });

  it('uses "Unknown" for missing projects', () => {
    // Just verify it doesn't crash — project name isn't in the markdown output
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

  it('ends with a trailing newline', () => {
    const result = renderMarkdown([action()], projects, noteIds, range);
    expect(result.endsWith('\n')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- tests/markdown.test.ts`
Expected: FAIL — `src/lib/markdown.ts` doesn't exist yet.

- [ ] **Step 3: Write `src/lib/markdown.ts`**

Port the logic from `template-data.ts` and convert the Nunjucks template into direct string building. The internal types (`Accumulator`, the dedup tracking) stay as implementation details — nothing is exported except `renderMarkdown`.

```typescript
import type { CompletedAction, Project } from './types';
import { fmtLocalDate, fmtLocalTime, formatDayLabel } from './dates';
import { sortKey } from './actions';

interface DedupEntry {
  content: string;
  time: string;
  is_note: boolean;
  count: number;
  completed_at: string;
}

export function renderMarkdown(
  actions: CompletedAction[],
  projects: Record<string, Project>,
  noteProjectIds: Set<string>,
  range: { since: string; until: string },
): string {
  const lines: string[] = [`# Review: ${range.since} to ${range.until}`];

  // Group by local date
  const byDay: Record<string, CompletedAction[]> = {};
  for (const a of actions) {
    const date = a.completed_at ? fmtLocalDate(new Date(a.completed_at)) : 'Unknown';
    (byDay[date] ??= []).push(a);
  }

  const sortedDates = Object.keys(byDay).sort();

  for (const date of sortedDates) {
    const dayActions = byDay[date];
    const sorted = [...dayActions].sort((a, b) =>
      a.completed_at.localeCompare(b.completed_at),
    );

    // Dedup recurring actions
    const seen: Record<string, DedupEntry> = {};
    const deduped: DedupEntry[] = [];
    for (const a of sorted) {
      const key = a.content + '||' + a.project_id;
      if (seen[key]) {
        seen[key].count++;
        seen[key].time = fmtLocalTime(a.completed_at);
        seen[key].completed_at = a.completed_at;
      } else {
        const isNote = noteProjectIds.has(a.project_id);
        const content = isNote ? a.content.replace(/^\*\s+/, '') : a.content;
        const entry: DedupEntry = {
          content,
          time: fmtLocalTime(a.completed_at),
          is_note: isNote,
          count: 1,
          completed_at: a.completed_at,
        };
        seen[key] = entry;
        deduped.push(entry);
      }
    }

    // Notes first (alphabetical), then actions (by time)
    const notes = deduped.filter(d => d.is_note);
    const tasks = deduped.filter(d => !d.is_note);
    notes.sort((a, b) => sortKey(a.content).localeCompare(sortKey(b.content)));
    tasks.sort((a, b) => a.completed_at.localeCompare(b.completed_at));

    const label = date === 'Unknown' ? 'Unknown date' : formatDayLabel(date);
    lines.push('', `## ${label}`);

    for (const note of notes) {
      lines.push(`- ${note.content}`);
    }
    for (const task of tasks) {
      const count = task.count > 1 ? ` ×${task.count}` : '';
      lines.push(`- ${task.time} · ${task.content}${count}`);
    }
  }

  return lines.join('\n') + '\n';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- tests/markdown.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
jj commit -m "Add markdown.ts: merge template-data and render into direct markdown output"
```

---

### Task 2: Wire up CLI and remove old modules

**Files:**
- Modify: `src/cli.ts:7-8,84-87`
- Modify: `vite.config.ts:6-15,19`
- Modify: `package.json:25,43`
- Delete: `src/lib/template-data.ts`
- Delete: `src/lib/render.ts`
- Delete: `src/templates/markdown.njk`
- Delete: `tests/template-data.test.ts`
- Delete: `tests/render.test.ts`

- [ ] **Step 1: Update `src/cli.ts`**

Replace the `buildTemplateData` + `renderTemplate` imports and usage with `renderMarkdown`. The `--format` flag stays but now only accepts `json` or `markdown`. Remove the filesystem template path support.

Changes to `cli.ts`:
- Remove: `import { buildTemplateData } from './lib/template-data';`
- Remove: `import { renderTemplate } from './lib/render';`
- Add: `import { renderMarkdown } from './lib/markdown';`
- Replace lines 84-87 (the else branch) with:

```typescript
} else if (format === 'markdown') {
  process.stdout.write(renderMarkdown(actions, projects, noteProjectIds, { since, until: until ?? fmtDate(new Date()) }));
} else {
  die(`Unknown format "${format}". Available: json, markdown`);
}
```

- [ ] **Step 2: Remove old files**

Delete these files:
- `src/lib/template-data.ts`
- `src/lib/render.ts`
- `src/templates/markdown.njk`
- `tests/template-data.test.ts`
- `tests/render.test.ts`

After deletion, check if `src/templates/` directory is empty and remove it if so.

- [ ] **Step 3: Remove `rawNjk()` plugin from `vite.config.ts`**

Delete the `rawNjk()` function (lines 6-15) and remove `rawNjk()` from the plugins array (line 19).

- [ ] **Step 3.5: Remove `*.njk` type declaration from `src/vite-env.d.ts`**

Delete lines 3-6 (the `declare module '*.njk'` block). Keep the rest of the file intact.

- [ ] **Step 4: Remove nunjucks dependencies**

Run: `bun remove nunjucks && bun remove -d @types/nunjucks`

This removes both packages from `package.json` and updates the lockfile. After this, `package.json` should have no `dependencies` section at all (nunjucks was the only production dep).

- [ ] **Step 5: Run full validation**

Run: `bun run validate`
Expected: All tests pass, type check clean, lint clean.

- [ ] **Step 6: Commit**

```bash
jj commit -m "Remove Nunjucks templating: wire CLI to renderMarkdown, delete old modules"
```

---

### Task 3: Update CLAUDE.md project structure

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the project structure section**

In CLAUDE.md, update the file tree to reflect:
- `src/lib/markdown.ts` replaces `template-data.ts` and `render.ts`
- `src/templates/` directory is gone
- `tests/markdown.test.ts` replaces `template-data.test.ts` and `render.test.ts`

Update the description lines:
- `markdown.ts`: "Grouping, dedup, sorting, and markdown rendering for CLI export"
- Remove lines for `template-data.ts`, `render.ts`, `templates/markdown.ts`

Also update any prose that mentions Nunjucks, templates, or `--format ./custom.njk`. The CLI usage lines should read:
- `bun run src/cli.ts --format markdown` — CLI export with markdown output

Remove the `--format ./custom.njk` line.

- [ ] **Step 2: Commit**

```bash
jj commit -m "Update CLAUDE.md: reflect template removal and new markdown module"
```
