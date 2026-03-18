# CLI Template Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Nunjucks template support to the CLI export tool, with built-in templates embedded at compile time and `--format` flag for selecting output format.

**Architecture:** Add `nunjucks` as a runtime dependency. Create a template data model (`TemplateData`) that pre-groups actions by day with enriched fields (local time, project name, is_note). Build a `renderTemplate()` function that resolves format names: `json` is special-cased, otherwise look up built-in templates first, then filesystem. Ship a `markdown.njk` built-in template. Update `cli.ts` to accept `--format` and route through the renderer.

**Tech Stack:** Nunjucks (Jinja2-compatible), Bun (compile target embeds imported strings)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/template-data.ts` | `buildTemplateData()`: groups actions by day (oldest first), enriches with local time, project name, is_note |
| Create | `src/lib/render.ts` | `renderTemplate()`: resolves format name → template string, runs Nunjucks |
| Create | `src/templates/markdown.ts` | Built-in markdown template (exported as string for cross-runtime compatibility) |
| Create | `tests/template-data.test.ts` | Tests for `buildTemplateData()` |
| Create | `tests/render.test.ts` | Tests for `renderTemplate()` resolution and rendering |
| Modify | `src/cli.ts` | Add `--format` flag, route through render |

---

## Chunk 1: Template Data Model

### Task 1: Create `src/lib/template-data.ts`

This module transforms the raw CLI output (actions + projects) into a structure optimized for templates.

**Files:**
- Create: `src/lib/template-data.ts`
- Create: `tests/template-data.test.ts`

**Types:**

```typescript
// in src/lib/template-data.ts

export interface TemplateAction {
  content: string;
  time: string;          // local HH:MM
  project_name: string;  // resolved, or "Unknown" if missing
  project_color: string | null;
  is_note: boolean;
  count: number;         // 1 for normal, >1 for deduped recurring
}

export interface TemplateDay {
  date: string;          // YYYY-MM-DD (local)
  label: string;         // "Mar 17 · Monday"
  actions: TemplateAction[];
}

export interface TemplateData {
  days: TemplateDay[];
  range: { since: string; until: string };
}
```

**`buildTemplateData` logic:**
1. Takes `actions: CompletedAction[]`, `projects: Record<string, Project>`, `noteProjectIds: Set<string>`, `range: { since, until }`.
2. Groups actions by local date (using `fmtLocalDate`).
3. Within each day, deduplicates by `content + project_id` (same logic as existing `dedup` in `actions.ts`).
4. Enriches each action with `time` (via `fmtLocalTime`), `project_name`, `project_color`, `is_note`.
5. Sorts days oldest-first. Actions within each day sorted by `completed_at` (which gives time ordering).
6. Returns `TemplateData`.

Note: the existing `dedup()` in `actions.ts` is private. Rather than exporting it and coupling to the web app's `DedupedAction` type (which includes `allTimes`, `task_id`, `id` — irrelevant for templates), implement a focused dedup in `template-data.ts` that produces `TemplateAction[]` directly.

- [ ] **Step 1: Write tests for `buildTemplateData`**

```typescript
// tests/template-data.test.ts
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
    // fmtLocalTime returns HH:MM — just check it's a non-empty string
    expect(result.days[0].actions[0].time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('uses latest time for deduped actions', () => {
    const actions = [
      action({ content: 'Recurring', completed_at: '2026-02-20T08:00:00Z', id: 'c1' }),
      action({ content: 'Recurring', completed_at: '2026-02-20T18:00:00Z', id: 'c2' }),
    ];
    const result = buildTemplateData(actions, projects, noteIds, range);
    const a = result.days[0].actions[0];
    // Should use the latest completion time
    expect(a.time).toBe(
      new Date('2026-02-20T18:00:00Z').toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- tests/template-data.test.ts`
Expected: FAIL — module doesn't exist yet

- [ ] **Step 3: Implement `src/lib/template-data.ts`**

```typescript
import type { CompletedAction, Project } from './types';
import { fmtLocalDate, fmtLocalTime, formatDayLabel } from './dates';

export interface TemplateAction {
  content: string;
  time: string;
  project_name: string;
  project_color: string | null;
  is_note: boolean;
  count: number;
}

export interface TemplateDay {
  date: string;
  label: string;
  actions: TemplateAction[];
}

export interface TemplateData {
  days: TemplateDay[];
  range: { since: string; until: string };
}

interface Accumulator {
  action: TemplateAction;
  completed_at: string; // track latest for sorting
}

export function buildTemplateData(
  actions: CompletedAction[],
  projects: Record<string, Project>,
  noteProjectIds: Set<string>,
  range: { since: string; until: string },
): TemplateData {
  // Group by local date
  const byDay: Record<string, CompletedAction[]> = {};
  for (const a of actions) {
    const date = a.completed_at ? fmtLocalDate(new Date(a.completed_at)) : 'Unknown';
    (byDay[date] ??= []).push(a);
  }

  const days: TemplateDay[] = Object.keys(byDay)
    .sort() // oldest first
    .map(date => {
      const dayActions = byDay[date];
      // Sort by completed_at, then dedup
      const sorted = [...dayActions].sort((a, b) =>
        a.completed_at.localeCompare(b.completed_at),
      );

      const seen: Record<string, Accumulator> = {};
      const deduped: Accumulator[] = [];
      for (const a of sorted) {
        const key = a.content + '||' + a.project_id;
        const proj = projects[a.project_id];
        if (seen[key]) {
          seen[key].action.count++;
          seen[key].action.time = fmtLocalTime(a.completed_at);
          seen[key].completed_at = a.completed_at;
        } else {
          const acc: Accumulator = {
            action: {
              content: a.content,
              time: fmtLocalTime(a.completed_at),
              project_name: proj?.name ?? 'Unknown',
              project_color: proj?.color ?? null,
              is_note: noteProjectIds.has(a.project_id),
              count: 1,
            },
            completed_at: a.completed_at,
          };
          seen[key] = acc;
          deduped.push(acc);
        }
      }

      // Sort deduped by latest completed_at
      deduped.sort((a, b) => a.completed_at.localeCompare(b.completed_at));

      const label = date === 'Unknown' ? 'Unknown date' : formatDayLabel(date);
      return { date, label, actions: deduped.map(d => d.action) };
    });

  return { days, range };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- tests/template-data.test.ts`
Expected: PASS

- [ ] **Step 5: Run full validate**

Run: `bun run validate`
Expected: PASS

- [ ] **Step 6: Commit**

```
jj commit -m "Add buildTemplateData for CLI template rendering"
```

---

## Chunk 2: Template Rendering

### Task 2: Install nunjucks

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install nunjucks and types**

Run: `bun add nunjucks && bun add -d @types/nunjucks`

- [ ] **Step 2: Commit**

```
jj commit -m "Add nunjucks dependency"
```

---

### Task 3: Create `src/lib/render.ts`

Template resolution: `--format json` is special-cased (no template). Otherwise, look up `<name>.njk` in built-in templates, then try the format value as a filesystem path. Render with Nunjucks and return the string.

Built-in templates are imported as strings at the top of the module — Bun embeds these in the compiled binary.

**Files:**
- Create: `src/lib/render.ts`
- Create: `tests/render.test.ts`

- [ ] **Step 1: Write tests for `renderTemplate`**

```typescript
// tests/render.test.ts
import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { renderTemplate, BUILTIN_FORMATS } from '../src/lib/render';
import type { TemplateData } from '../src/lib/template-data';

const data: TemplateData = {
  days: [
    {
      date: '2026-02-20',
      label: 'Feb 20 · Friday',
      actions: [
        {
          content: 'Buy milk',
          time: '11:00',
          project_name: 'Home',
          project_color: 'green',
          is_note: false,
          count: 1,
        },
      ],
    },
  ],
  range: { since: '2026-02-01', until: '2026-02-28' },
};

describe('renderTemplate', () => {
  it('renders a built-in template by name', () => {
    const result = renderTemplate('markdown', data);
    expect(result).toContain('Buy milk');
    expect(result).toContain('Feb 20');
  });

  it('throws for unknown format with no matching file', () => {
    expect(() => renderTemplate('nonexistent', data)).toThrow();
  });

  it('lists markdown in BUILTIN_FORMATS', () => {
    expect(BUILTIN_FORMATS).toContain('markdown');
  });

  it('renders from a filesystem path', () => {
    const tmpPath = '/tmp/test-reviewist-template.njk';
    writeFileSync(tmpPath, '{{ range.since }} to {{ range.until }}');
    try {
      const result = renderTemplate(tmpPath, data);
      expect(result).toBe('2026-02-01 to 2026-02-28');
    } finally {
      unlinkSync(tmpPath);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- tests/render.test.ts`
Expected: FAIL — module doesn't exist yet

- [ ] **Step 3: Implement `src/lib/render.ts`**

```typescript
import nunjucks from 'nunjucks';
import { readFileSync, existsSync } from 'node:fs';

// Built-in templates — exported as strings from .ts files so they work
// in both vitest (Vite transform) and bun build --compile.
import markdownTemplate from '../templates/markdown';

const builtins: Record<string, string> = {
  markdown: markdownTemplate,
};

export const BUILTIN_FORMATS = Object.keys(builtins);

const env = new nunjucks.Environment(null, { autoescape: false, trimBlocks: true, lstripBlocks: true });

export function renderTemplate(format: string, data: unknown): string {
  if (builtins[format]) {
    return env.renderString(builtins[format], data);
  }

  if (existsSync(format)) {
    const template = readFileSync(format, 'utf-8');
    return env.renderString(template, data);
  }

  const available = BUILTIN_FORMATS.join(', ');
  throw new Error(
    `Unknown format "${format}". Built-in formats: ${available}. Or provide a path to a .njk template file.`,
  );
}
```

- [ ] **Step 4: Create placeholder `src/templates/markdown.ts`**

Create a minimal template so tests pass. The real template comes in Task 4. Templates are exported as string default exports from `.ts` files — this works in both vitest and `bun build --compile` (unlike Vite's `?raw` import suffix, which only works in Vite).

```typescript
export default `{# Reviewist: completed actions report #}
# {{ range.since }} to {{ range.until }}
{% for day in days %}

## {{ day.label }}
{% for action in day.actions %}
- {{ action.time }} {{ action.content }} ({{ action.project_name }}){% if action.count > 1 %} ×{{ action.count }}{% endif %}
{% endfor %}
{% endfor %}
`;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- tests/render.test.ts`
Expected: PASS

- [ ] **Step 6: Run full validate**

Run: `bun run validate`
Expected: PASS

- [ ] **Step 7: Commit**

```
jj commit -m "Add template renderer with built-in format resolution"
```

---

### Task 4: Write the markdown template

**Files:**
- Modify: `src/templates/markdown.ts`

The template should produce clean, readable markdown suitable for pasting into notes, journals, or rendering with any markdown viewer. With `trimBlocks: true` and `lstripBlocks: true` in the Nunjucks config, tag lines are consumed — so `{% if %}` / `{% else %}` / `{% endif %}` on their own lines won't produce blank lines. The list item itself must be on the same line or adjacent to a tag.

- [ ] **Step 1: Write the full template**

```typescript
export default `# Review: {{ range.since }} to {{ range.until }}
{% for day in days %}

## {{ day.label }}
{% for action in day.actions %}
{% if action.is_note %}
- {{ action.time }} · **{{ action.content }}** · _{{ action.project_name }}_
{% else %}
- {{ action.time }} · {{ action.content }} · _{{ action.project_name }}_{% if action.count > 1 %} ×{{ action.count }}{% endif %}

{% endif %}
{% endfor %}
{% endfor %}
`;
```

- [ ] **Step 2: Test manually** (eyeball the output)

Run: `bun -e "import {renderTemplate} from './src/lib/render'; const data = {days:[{date:'2026-02-20',label:'Feb 20 · Friday',actions:[{content:'Buy milk',time:'11:00',project_name:'Home',project_color:'green',is_note:false,count:1},{content:'Dawn returns',time:'14:00',project_name:'Aside',project_color:'grey',is_note:true,count:1},{content:'Water plants',time:'09:00',project_name:'Home',project_color:'green',is_note:false,count:3}]}],range:{since:'2026-02-01',until:'2026-02-28'}}; process.stdout.write(renderTemplate('markdown', data))"`

Expected: Readable markdown output with day header, action lines with times, project names, note styling, and ×N for recurring. No double blank lines between items.

- [ ] **Step 3: Update render test to verify note styling**

Add to `tests/render.test.ts`:

```typescript
  it('renders notes with bold content', () => {
    const noteData: TemplateData = {
      days: [{
        date: '2026-02-20',
        label: 'Feb 20 · Friday',
        actions: [{
          content: 'Dawn returns',
          time: '14:00',
          project_name: 'Aside',
          project_color: 'grey',
          is_note: true,
          count: 1,
        }],
      }],
      range: { since: '2026-02-01', until: '2026-02-28' },
    };
    const result = renderTemplate('markdown', noteData);
    expect(result).toContain('**Dawn returns**');
  });

  it('renders recurring action count', () => {
    const recurringData: TemplateData = {
      days: [{
        date: '2026-02-20',
        label: 'Feb 20 · Friday',
        actions: [{
          content: 'Water plants',
          time: '09:00',
          project_name: 'Home',
          project_color: 'green',
          is_note: false,
          count: 3,
        }],
      }],
      range: { since: '2026-02-01', until: '2026-02-28' },
    };
    const result = renderTemplate('markdown', recurringData);
    expect(result).toContain('×3');
  });
```

- [ ] **Step 4: Run full validate**

Run: `bun run validate`
Expected: PASS

- [ ] **Step 5: Commit**

```
jj commit -m "Add markdown built-in template"
```

---

## Chunk 3: CLI Integration

### Task 5: Wire `--format` into `cli.ts`

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Update `cli.ts`**

Changes:
1. Add `format: { type: 'string', default: 'json' }` to `parseArgs` options.
2. Import `buildTemplateData` and `renderTemplate`.
3. After building the current output object, branch on format:
   - `json`: current behavior (`JSON.stringify`)
   - anything else: build `TemplateData`, call `renderTemplate(format, data)`, write to stdout

```typescript
// Add to imports:
import { buildTemplateData } from './lib/template-data';
import { renderTemplate } from './lib/render';

// Add to parseArgs options:
    format: { type: 'string', default: 'json' },

// Replace the final output section (lines 72-80) with:
const format = args.format ?? 'json';

if (format === 'json') {
  // Existing JSON output
  const referencedProjects: Record<string, Project> = {};
  for (const a of actions) {
    if (a.project_id && projects[a.project_id]) {
      referencedProjects[a.project_id] = projects[a.project_id];
    }
  }
  const output = {
    projects: referencedProjects,
    actions: actions.map(a => ({
      ...a,
      is_note: noteProjectIds.has(a.project_id),
    })),
  };
  console.log(JSON.stringify(output, null, 2));
} else {
  const data = buildTemplateData(actions, projects, noteProjectIds, { since, until });
  process.stdout.write(renderTemplate(format, data));
}
```

- [ ] **Step 2: Run full validate**

Run: `bun run validate`
Expected: PASS

- [ ] **Step 3: Commit**

```
jj commit -m "Add --format flag to CLI with template rendering"
```

---

## Chunk 4: Documentation

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update project structure** — add `src/templates/markdown.ts`, `src/lib/template-data.ts`, `src/lib/render.ts` to the tree.

- [ ] **Step 2: Update dev workflow** — update CLI usage examples:

```
- `bun run src/cli.ts` — CLI export tool (requires `TODOIST_TOKEN` env var)
- `bun run src/cli.ts --format markdown` — render using built-in markdown template
- `bun run src/cli.ts --format ./my-template.njk` — render using custom Nunjucks template
```

- [ ] **Step 3: Run full validate**

Run: `bun run validate`
Expected: PASS

- [ ] **Step 4: Commit**

```
jj commit -m "Update CLAUDE.md with template rendering docs"
```

- [ ] **Step 5: Remove this plan file**

```
rm plan-cli-templates.md
jj commit -m "Remove completed template plan"
```
