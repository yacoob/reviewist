# CLI: Remove --until, Add --outdir Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `--until` from the CLI, change default date range to "current + previous month", and add `--outdir` mode that writes monthly `YYYY/YYYY-MM.md` files.

**Architecture:** The CLI keeps two output paths: stdout (json/markdown for ad-hoc reports) and `--outdir` (monthly markdown files). Both share the same fetch → `eventsToActions` → `renderMarkdown` pipeline. A new `dates.ts` helper computes "start of previous month" for the default `--since`. The `--outdir` path splits actions by local-date month, creates directories, and writes files. When `--since` is provided with `--outdir`, it snaps backward to the 1st of that month (with a stderr warning).

**Tech Stack:** Bun, TypeScript, vitest

**Design notes:**
- `startOfPreviousMonth()` uses UTC (for the API's `date_from`). `monthKey()` uses local timezone (for display grouping). This matches the existing convention: `fmtDate` is UTC for API params, `fmtLocalDate` is local for display. An action completed near midnight UTC may land in a different month bucket than its API date — this is correct behavior (display matches the user's wall clock).
- Actions with empty `completed_at` are silently excluded from `--outdir` output — they'd land in an "Unknown" bucket which has no meaningful month.
- `monthRange` always returns the calendar month's last day, even for the current month. This is fine — the file gets overwritten on every sync, and the header range shows the full month.

---

## File Map

| File | Change | Responsibility |
|---|---|---|
| `src/lib/dates.ts` | Modify | Add `startOfPreviousMonth()`, `monthKey()`, `snapToMonthStart()`, `monthRange()` |
| `src/cli.ts` | Modify | Remove `--until`, change default `--since`, add `--outdir`, implement monthly file writing |
| `tests/dates.test.ts` | Modify | Add tests for new date helpers |

**Not changed:** `api.ts` (the `until?` parameter stays — CLI just stops passing it). `store.svelte.ts` and `events.ts` (web app path unchanged). `markdown.ts` (signature already works). `tests/markdown.test.ts` (existing fixture still valid).

---

### Task 1: Add date helpers to `dates.ts`

**Files:**
- Modify: `src/lib/dates.ts`
- Modify: `tests/dates.test.ts`

Four new functions:

- `startOfPreviousMonth()`: returns `YYYY-MM-DD` for the 1st of last month (UTC). E.g. if today is 2026-03-20, returns `"2026-02-01"`.
- `monthKey(iso: string)`: extracts `YYYY-MM` from the local date of an ISO timestamp. E.g. `monthKey("2026-03-15T12:00:00Z")` returns `"2026-03"`.
- `snapToMonthStart(dateStr: string)`: given `YYYY-MM-DD`, returns `YYYY-MM-01`. Pure string operation.
- `monthRange(ym: string)`: given `YYYY-MM`, returns `{ since: "YYYY-MM-01", until: "YYYY-MM-{last}" }`.

- [ ] **Step 1: Write tests for all four helpers**

Add to `tests/dates.test.ts` (import `vi` from vitest for fake timers):

```typescript
import { startOfPreviousMonth, monthKey, snapToMonthStart, monthRange } from '../src/lib/dates';

describe('startOfPreviousMonth', () => {
  it('returns first of previous month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'));
    expect(startOfPreviousMonth()).toBe('2026-02-01');
    vi.useRealTimers();
  });

  it('handles January (crosses year boundary)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    expect(startOfPreviousMonth()).toBe('2025-12-01');
    vi.useRealTimers();
  });
});

describe('monthKey', () => {
  it('extracts YYYY-MM from ISO timestamp using local date', () => {
    expect(monthKey('2026-03-15T12:00:00Z')).toBe('2026-03');
  });

  it('extracts from a different month', () => {
    expect(monthKey('2025-11-01T12:00:00Z')).toBe('2025-11');
  });
});

describe('snapToMonthStart', () => {
  it('snaps a mid-month date to the 1st', () => {
    expect(snapToMonthStart('2026-03-15')).toBe('2026-03-01');
  });

  it('is a no-op for the 1st', () => {
    expect(snapToMonthStart('2026-03-01')).toBe('2026-03-01');
  });
});

describe('monthRange', () => {
  it('returns full range for a 31-day month', () => {
    expect(monthRange('2026-03')).toEqual({ since: '2026-03-01', until: '2026-03-31' });
  });

  it('handles February in a non-leap year', () => {
    expect(monthRange('2025-02')).toEqual({ since: '2025-02-01', until: '2025-02-28' });
  });

  it('handles February in a leap year', () => {
    expect(monthRange('2028-02')).toEqual({ since: '2028-02-01', until: '2028-02-29' });
  });

  it('handles 30-day months', () => {
    expect(monthRange('2026-04')).toEqual({ since: '2026-04-01', until: '2026-04-30' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test tests/dates.test.ts`
Expected: FAIL — functions don't exist yet.

- [ ] **Step 3: Implement the four helpers in `dates.ts`**

Add to `src/lib/dates.ts`:

```typescript
/** First day of previous month as YYYY-MM-DD (UTC). Used for API date_from default. */
export function startOfPreviousMonth(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return fmtDate(d);
}

/** Extract YYYY-MM from an ISO timestamp, using local timezone (for display grouping). */
export function monthKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Snap a YYYY-MM-DD date string to the 1st of its month. */
export function snapToMonthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + '-01';
}

/** Given YYYY-MM, return { since: first day, until: last day }. */
export function monthRange(ym: string): { since: string; until: string } {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    since: `${ym}-01`,
    until: `${ym}-${String(lastDay).padStart(2, '0')}`,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test tests/dates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
jj commit -m "Add date helpers: startOfPreviousMonth, monthKey, snapToMonthStart, monthRange"
```

---

### Task 2: Remove `--until` from CLI, change default `--since`

**Files:**
- Modify: `src/cli.ts`

Remove the `--until` option. Change the default `--since` from "6 weeks ago" to `startOfPreviousMonth()`. The `fetchActivityEvents` call stops passing `until` (fetches up to now). The `renderMarkdown` call for stdout mode uses today as `until` in the header.

- [ ] **Step 1: Update `cli.ts`**

Changes (all in `src/cli.ts`):

1. Replace import line:
   ```typescript
   // BEFORE:
   import { SIX_WEEKS_MS } from './lib/events';
   import { fmtDate } from './lib/dates';
   // AFTER:
   import { fmtDate, startOfPreviousMonth } from './lib/dates';
   ```
   (Remove the `events` import entirely.)

2. Remove `until` from `parseArgs` options:
   ```typescript
   options: {
       since: { type: 'string' },
       'note-projects': { type: 'string' },
       blocklist: { type: 'string' },
       format: { type: 'string', default: 'json' },
       help: { type: 'boolean', default: false },
   },
   ```

3. Update help text — remove `--until` line, update `--since` default description:
   ```
   Options:
     --format <json|markdown>   Output format (default: json)
     --since <YYYY-MM-DD>       Start date (default: 1st of previous month)
     --note-projects <a,b,...>  Comma-separated note project names
     --blocklist <file>         File with task IDs to exclude (one per line)
     --help                     Show this help
   ```

4. Update date range computation:
   ```typescript
   const since = args.since ?? startOfPreviousMonth();
   ```
   (Remove `const until = args.until;`.)

5. Update fetch call — drop `until` argument:
   ```typescript
   const [projects, events] = await Promise.all([
     fetchProjects(token),
     fetchActivityEvents(token, since),
   ]);
   ```

6. Update markdown render call:
   ```typescript
   process.stdout.write(renderMarkdown(actions, projects, noteProjectIds, { since, until: fmtDate(new Date()) }));
   ```

- [ ] **Step 2: Run validate**

Run: `bun run validate`
Expected: PASS

- [ ] **Step 3: Commit**

```
jj commit -m "Remove --until from CLI, default --since to start of previous month"
```

---

### Task 3: Add `--outdir` mode

**Files:**
- Modify: `src/cli.ts`

When `--outdir <path>` is provided:
1. Error if `--format json` is also passed.
2. If `--since` doesn't land on the 1st, snap backward and warn on stderr.
3. Split actions by `monthKey(action.completed_at)`.
4. For each month: render markdown with `monthRange` as the header range, create `YYYY/` dir, write `YYYY-MM.md`.

- [ ] **Step 1: Add imports**

Add to the dates import in `cli.ts`:
```typescript
import { fmtDate, startOfPreviousMonth, monthKey, monthRange, snapToMonthStart } from './lib/dates';
```

Add `mkdirSync` for directory creation, and `CompletedAction` type:
```typescript
import { mkdirSync } from 'fs';
import type { CompletedAction, Project } from './lib/types';
```
(Update the existing `Project`-only type import to include `CompletedAction`.)

- [ ] **Step 2: Add `outdir` to parseArgs and help text**

Add to options:
```typescript
outdir: { type: 'string' },
```

Add to help text:
```
  --outdir <path>            Write monthly YYYY/YYYY-MM.md files to directory
```

- [ ] **Step 3: Add `--outdir` + `--format json` validation**

After the `args.help` block, before the token check:
```typescript
if (args.outdir && args.format === 'json') {
  die('--outdir produces markdown files; --format json is not compatible');
}
```

- [ ] **Step 4: Add `--since` snapping for `--outdir`**

Change `const since` to `let since` and add snapping after it:
```typescript
let since = args.since ?? startOfPreviousMonth();

if (args.outdir && args.since) {
  const snapped = snapToMonthStart(args.since);
  if (snapped !== args.since) {
    console.error(`warning: --since snapped from ${args.since} to ${snapped} (--outdir requires full months)`);
    since = snapped;
  }
}
```

- [ ] **Step 5: Add the `--outdir` output branch**

Insert before the existing `if (format === 'json')` block:

```typescript
if (args.outdir) {
  const byMonth: Record<string, CompletedAction[]> = {};
  for (const a of actions) {
    if (!a.completed_at) continue;
    const mk = monthKey(a.completed_at);
    (byMonth[mk] ??= []).push(a);
  }

  const months = Object.keys(byMonth).sort();
  for (const mk of months) {
    const range = monthRange(mk);
    const md = renderMarkdown(byMonth[mk], projects, noteProjectIds, range);
    const [year] = mk.split('-');
    const dir = `${args.outdir}/${year}`;
    mkdirSync(dir, { recursive: true });
    await Bun.write(`${dir}/${mk}.md`, md);
    console.error(`wrote ${dir}/${mk}.md (${byMonth[mk].length} actions)`);
  }
} else if (format === 'json') {
```

The rest of the branching (`json`, `markdown`, error) stays the same.

- [ ] **Step 6: Run validate**

Run: `bun run validate`
Expected: PASS

- [ ] **Step 7: Manual smoke test**

```bash
TODOIST_TOKEN=... bun run src/cli.ts --outdir /tmp/reviewist-test
ls -R /tmp/reviewist-test
cat /tmp/reviewist-test/2026/2026-03.md | head -20
```

Expected: `2026/` directory with `2026-02.md` and `2026-03.md` files, each with frontmatter and day sections.

```bash
# Verify snapping warning:
TODOIST_TOKEN=... bun run src/cli.ts --outdir /tmp/reviewist-test --since 2026-02-15
# Should print: warning: --since snapped from 2026-02-15 to 2026-02-01 (--outdir requires full months)
```

- [ ] **Step 8: Commit**

```
jj commit -m "Add --outdir mode: write monthly YYYY/YYYY-MM.md files"
```

---

### Task 4: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLI docs**

In the Dev Workflow section:
- Change `--since` default description to "1st of previous month"
- Remove `--until` mention
- Add: `bun run src/cli.ts --outdir ~/vault/reviews` — write monthly markdown files to directory

In the help text line:
- Update to reflect current flags

- [ ] **Step 2: Commit**

```
jj commit -m "Update CLAUDE.md: CLI --outdir mode, remove --until, new default date range"
```
