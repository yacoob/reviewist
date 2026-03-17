# CLI Export Tool Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bun-compiled CLI that exports reconciled Todoist actions as JSON, sharing core logic with the Reviewist web app. Migrate the project runtime from Node to Bun.

**Architecture:** Extract shared constants (note projects, blocklist) from Vite-specific mechanisms into plain TypeScript modules. Add `until` parameter to API fetch. Sort reconcile output. CLI entry point in `cli/main.ts` orchestrates fetch → reconcile → filter → serialize → stdout. Bun replaces Node as the project runtime.

**Tech Stack:** Bun (runtime + compile target), existing TypeScript modules from `src/lib/`

**Spec:** `ROADMAP.md` — CLI Export Tool section

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/constants.ts` | `NOTE_PROJECT_NAMES` array, `BLOCKLIST` set |
| Modify | `src/lib/storage.ts` | Remove blocklist import/export, import from constants |
| Modify | `src/lib/reconcile.ts` | Sort output by `completed_at` |
| Modify | `src/lib/api.ts` | Add optional `until` parameter |
| Modify | `src/App.svelte` | Import `NOTE_PROJECT_NAMES` from constants |
| Modify | `vite.config.ts` | Remove `__NOTE_PROJECTS__` define |
| Modify | `src/vite-env.d.ts` | Remove `__NOTE_PROJECTS__` declaration |
| Modify | `eslint.config.js` | Remove `__NOTE_PROJECTS__` global |
| Modify | `tests/reconcile.test.ts` | Update BLOCKLIST import, add sort test |
| Modify | `tests/storage.test.ts` | Move BLOCKLIST import to constants |
| Delete | `src/blocklist.txt` | Content moves to constants.ts |
| Modify | `mise.toml` | Replace node with bun |
| Create | `cli/main.ts` | CLI entry point |

---

## Chunk 1: Runtime Migration

### Task 1: Switch from Node to Bun

**Files:**
- Modify: `mise.toml:8-10`

- [x] **DONE** — Bun replaces both Node and pnpm. `mise.toml` has `bun = "latest"` only. All scripts via `bun run`.

---

## Chunk 2: Shared Code Refactoring

### Task 2: Create `src/lib/constants.ts` with blocklist and note project names

**Files:**
- Create: `src/lib/constants.ts`

- [ ] **Step 1: Create constants module**

```typescript
// src/lib/constants.ts
export const NOTE_PROJECT_NAMES: readonly string[] = ['Aside', 'Within'];

export const BLOCKLIST: ReadonlySet<string> = new Set([
  '69gqQwRw52w2V2Qg',
  '69gqQwWQr97Xhr4g',
  '6g4MPgHfQ9Wh7R68',
  '6g4rmhGQXphwg5XM',
  '6g4wjR642rxWJRCg',
  '6g58Hc24gqVFWpwM',
  '6g58HRXpX93cWHVM',
  '6g58j7VVr66hmW4M',
  '6g58r3CM6pqV642v',
  '6g58rGF4FCHhj26X',
  '6g58RHg9gvqQC8FM',
  '6g58rHVxgrvhWJcG',
  '6g58WxqCvpwXxXF8',
  '6g5Mrp4hpm786fp5',
]);
```

- [ ] **Step 2: Run validate**

Run: `bun run validate`
Expected: PASS (new file, no consumers yet)

- [ ] **Step 3: Commit**

```
jj commit -m "Add src/lib/constants.ts with NOTE_PROJECT_NAMES and BLOCKLIST"
```

---

### Task 3: Migrate BLOCKLIST consumers from storage.ts to constants.ts

**Files:**
- Modify: `src/lib/storage.ts` — remove lines 49-52 (blocklist import/export)
- Modify: `src/lib/store.svelte.ts:10` — change BLOCKLIST import from `./storage` to `./constants`
- Modify: `tests/storage.test.ts:12` — change BLOCKLIST import from `../src/lib/storage` to `../src/lib/constants`
- Modify: `tests/reconcile.test.ts:3` — change BLOCKLIST import from `../src/lib/storage` to `../src/lib/constants`
- Delete: `src/blocklist.txt`

- [ ] **Step 1: Update `storage.ts`** — remove lines 49-52:

```typescript
import blocklistRaw from '../blocklist.txt?raw';
export const BLOCKLIST: ReadonlySet<string> = new Set(
  blocklistRaw.split('\n').map(s => s.trim()).filter(Boolean),
);
```

The file should end after `saveDebugEnabled` at line 47.

- [ ] **Step 2: Update `store.svelte.ts`** — change line 10. Remove `BLOCKLIST` from the storage import destructure and add a new import:

```typescript
} from './storage';
import { BLOCKLIST } from './constants';
```

- [ ] **Step 3: Update `tests/storage.test.ts`** — change line 12. Remove `BLOCKLIST` from the storage import destructure and add:

```typescript
} from '../src/lib/storage';
import { BLOCKLIST } from '../src/lib/constants';
```

- [ ] **Step 4: Update `tests/reconcile.test.ts`** — change line 3 from:

```typescript
import { BLOCKLIST } from '../src/lib/storage';
```

to:

```typescript
import { BLOCKLIST } from '../src/lib/constants';
```

- [ ] **Step 5: Delete `src/blocklist.txt`**

- [ ] **Step 6: Run validate**

Run: `bun run validate`
Expected: PASS

- [ ] **Step 7: Commit**

```
jj commit -m "Migrate BLOCKLIST from storage.ts/blocklist.txt to constants.ts"
```

---

### Task 4: Migrate `__NOTE_PROJECTS__` to constants.ts import

**Files:**
- Modify: `src/App.svelte:18` — replace `__NOTE_PROJECTS__` with `NOTE_PROJECT_NAMES`
- Modify: `vite.config.ts:7-9` — remove `define` block
- Modify: `src/vite-env.d.ts:3` — remove declaration
- Modify: `eslint.config.js:15` — remove global

- [ ] **Step 1: Update `App.svelte`** — add import after line 4:

```typescript
  import { NOTE_PROJECT_NAMES } from './lib/constants';
```

Replace `__NOTE_PROJECTS__` on line 18 with `NOTE_PROJECT_NAMES`.

- [ ] **Step 2: Remove Vite define** — in `vite.config.ts`, remove:

```typescript
  define: {
    __NOTE_PROJECTS__: JSON.stringify(['Aside', 'Within']),
  },
```

- [ ] **Step 3: Update `src/vite-env.d.ts`** — remove line 3 (`declare const __NOTE_PROJECTS__: string[];`), leaving only:

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 4: Update `eslint.config.js`** — remove `__NOTE_PROJECTS__: 'readonly',` from line 15. The globals block becomes:

```typescript
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
```

- [ ] **Step 5: Run validate**

Run: `bun run validate`
Expected: PASS

- [ ] **Step 6: Commit**

```
jj commit -m "Replace __NOTE_PROJECTS__ Vite define with constants.ts import"
```

---

### Task 5: Sort reconcile() output by completed_at

**Files:**
- Modify: `src/lib/reconcile.ts:41-42` — add sort before return
- Modify: `tests/reconcile.test.ts` — add sort-order test

- [ ] **Step 1: Write the failing test** — add to `tests/reconcile.test.ts` inside the `describe('reconcile')` block:

```typescript
  it('returns actions sorted by completed_at ascending', () => {
    const result = reconcile([
      ev({ object_id: 'a', event_date: '2026-02-22T10:00:00Z' }),
      ev({ object_id: 'b', event_date: '2026-02-20T10:00:00Z' }),
      ev({ object_id: 'c', event_date: '2026-02-21T10:00:00Z' }),
    ]);
    expect(result.map(a => a.completed_at)).toEqual([
      '2026-02-20T10:00:00Z',
      '2026-02-21T10:00:00Z',
      '2026-02-22T10:00:00Z',
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/reconcile.test.ts`
Expected: FAIL — actions are in Map iteration order (a, b, c), not sorted by date

- [ ] **Step 3: Add sort to reconcile()** — in `src/lib/reconcile.ts`, replace `return tasks;` (line 42) with:

```typescript
  tasks.sort((a, b) => a.completed_at < b.completed_at ? -1 : a.completed_at > b.completed_at ? 1 : 0);
  return tasks;
```

- [ ] **Step 4: Run validate**

Run: `bun run validate`
Expected: PASS — new test passes, existing tests still pass (they already expected chronological order)

- [ ] **Step 5: Commit**

```
jj commit -m "Sort reconcile() output by completed_at ascending"
```

---

### Task 6: Add optional `until` parameter to fetchActivityEvents

**Files:**
- Modify: `src/lib/api.ts:34-37,47` — add `until` parameter, set `date_to`

- [ ] **Step 1: Update `fetchActivityEvents` signature** — add `until?: string` after `since`:

```typescript
export async function fetchActivityEvents(
  token: string,
  since: string,
  until?: string,
): Promise<ActivityEvent[]> {
```

- [ ] **Step 2: Add `date_to` to params** — after line 47 (`if (cursor) params.set('cursor', cursor);`), add:

```typescript
    if (until) params.set('date_to', until);
```

- [ ] **Step 3: Run validate**

Run: `bun run validate`
Expected: PASS — existing callers don't pass `until`, behavior unchanged

- [ ] **Step 4: Commit**

```
jj commit -m "Add optional until parameter to fetchActivityEvents"
```

---

## Chunk 3: CLI Implementation

### Task 7: Implement CLI entry point

**Files:**
- Create: `cli/main.ts`

- [ ] **Step 1: Create `cli/main.ts`**

```typescript
import { parseArgs } from 'util';
import { fetchProjects, fetchActivityEvents } from '../src/lib/api';
import { reconcile } from '../src/lib/reconcile';
import { BLOCKLIST, NOTE_PROJECT_NAMES } from '../src/lib/constants';
import { SIX_WEEKS_MS } from '../src/lib/events';
import { fmtDate } from '../src/lib/dates';
import type { CompletedAction, Project } from '../src/lib/types';

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseBlocklistFile(text: string): Set<string> {
  return new Set(text.split('\n').map(s => s.trim()).filter(Boolean));
}

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    since: { type: 'string' },
    until: { type: 'string' },
    'note-projects': { type: 'string' },
    blocklist: { type: 'string' },
  },
});

// Token
const token = process.env.TODOIST_TOKEN;
if (!token) die('TODOIST_TOKEN environment variable is required');

// Date range
const since = args.since ?? fmtDate(new Date(Date.now() - SIX_WEEKS_MS));
const until = args.until ?? fmtDate(new Date());

// Note projects
const noteProjectNames: readonly string[] = args['note-projects']
  ? args['note-projects'].split(',').map(s => s.trim())
  : NOTE_PROJECT_NAMES;

// Blocklist: built-in + optional file
let blocklist: ReadonlySet<string> = BLOCKLIST;
if (args.blocklist) {
  const extra = parseBlocklistFile(await Bun.file(args.blocklist).text());
  blocklist = new Set([...BLOCKLIST, ...extra]);
}

// Fetch
const [projects, events] = await Promise.all([
  fetchProjects(token),
  fetchActivityEvents(token, since, until),
]);

// Reconcile and filter
const actions = reconcile(events).filter(a => !blocklist.has(a.task_id));

// Determine note project IDs
const noteProjectIds = new Set(
  noteProjectNames
    .map(name => Object.entries(projects).find(([, p]) => p.name === name)?.[0])
    .filter((id): id is string => id != null),
);

// Build output: only include referenced projects
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
```

Note: Uses `util.parseArgs` (Node/Bun built-in) instead of a Deno-specific library. Uses `Bun.file()` for the optional blocklist file read — this is the only Bun-specific API in the file. For everything else it uses standard Node APIs (`process.env`, `process.argv`, `process.exit`).

- [ ] **Step 2: Test manually** (requires `TODOIST_TOKEN` env var)

Run: `TODOIST_TOKEN=<token> bun run cli/main.ts | head -20`
Expected: JSON output with `projects` and `actions` keys

- [ ] **Step 3: Test error case**

Run: `bun run cli/main.ts 2>&1; echo "exit: $?"`
Expected: `error: TODOIST_TOKEN environment variable is required` on stderr, exit code 1

- [ ] **Step 4: Commit**

```
jj commit -m "Add CLI export tool entry point"
```

---

### Task 8: Compile and verify binary

- [ ] **Step 1: Compile**

Run: `bun build --compile cli/main.ts --outfile reviewist-export`
Expected: Produces `reviewist-export` binary

- [ ] **Step 2: Test the binary**

Run: `TODOIST_TOKEN=<token> ./reviewist-export | head -20`
Expected: Same JSON output as the `bun run` test

- [ ] **Step 3: Test with flags**

Run: `TODOIST_TOKEN=<token> ./reviewist-export --since 2026-03-01 --until 2026-03-17 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"actions\"])} actions, {len(d[\"projects\"])} projects')"`
Expected: Prints count of actions and projects for the date range

- [ ] **Step 4: Add `reviewist-export` to `.gitignore`**

- [ ] **Step 5: Commit**

```
jj commit -m "Verify bun compile and add binary to .gitignore"
```

---

## Chunk 4: Documentation Updates

### Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Changes:
- Project structure: remove `src/blocklist.txt`, add `src/lib/constants.ts` with description, add `cli/main.ts`
- Update `storage.ts` description: remove blocklist mention
- Blocklist section: update to reference `constants.ts`
- Dev Workflow section: note Bun as runtime, mention `bun build --compile` for CLI
- Note that `mise.toml` now manages Bun instead of Node

- [ ] **Step 2: Run validate**

Run: `bun run validate`
Expected: PASS

- [ ] **Step 3: Commit**

```
jj commit -m "Update CLAUDE.md for Bun runtime and CLI export tool"
```
