# Note Content Preparation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move note content processing (`* ` stripping + default emoji prefixing) to a shared utility called early after reconciliation, so both the web app and CLI consume already-cleaned content.

**Architecture:** A pipeline function `eventsToActions()` in `actions.ts` wraps the full sequence: blocklist filtering → reconciliation → note preparation (strip `* ` prefix, prepend default emoji). Both the store and CLI call this single function instead of doing the steps individually. A helper `prepareNotes()` handles the note-specific content transformation. Downstream rendering code (`ActionItem.svelte`, `markdown.ts`) drops its own `* ` stripping but still checks `noteProjectIds` for display decisions (blockquote vs checkbox).

**Tech Stack:** TypeScript, vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/constants.ts` | Add `NOTE_PROJECT_EMOJIS` map |
| Modify | `src/lib/actions.ts` | Add `prepareNotes()` and `eventsToActions()` |
| Modify | `tests/actions.test.ts` | Tests for `prepareNotes()` and `eventsToActions()` |
| Modify | `src/lib/store.svelte.ts` | Use `eventsToActions()`, compute and expose `noteProjectIds` |
| Modify | `src/App.svelte:17-23` | Use `store.noteProjectIds` instead of computing locally |
| Modify | `src/components/ActionItem.svelte:13` | Remove `* ` stripping (content arrives clean) |
| Modify | `src/lib/markdown.ts:53` | Remove `* ` stripping (content arrives clean) |
| Modify | `tests/markdown.test.ts` | Update tests: notes arrive pre-stripped, add emoji tests |
| Modify | `src/cli.ts` | Call `prepareNotes()` after reconcile |

## Key Design Decisions

**What `prepareNotes()` does to `content`:**
1. If action is in a note project: strip leading `* ` (the uncompletable task prefix)
2. If stripped content does NOT start with an emoji: prepend the project's default emoji + space
3. Return a new `CompletedAction[]` (immutable — no mutation)

**What stays downstream:**
- `noteProjectIds.has(a.project_id)` checks for rendering decisions (blockquote vs checkbox, hiding timestamp, etc.) remain in `markdown.ts` and `ActionItem.svelte`
- The `isNote` prop on `ActionItem.svelte` is still needed and still passed from `ActionList.svelte`

**Emoji detection:** Use `/^\p{Extended_Pictographic}/u` to test if content already starts with an emoji. This covers standard emoji including `✨`, `🗓️`, etc.

**Emoji map:** Keyed by project name (not ID), since project IDs change across Todoist accounts but names are stable for this single-user app:
- `"Aside"` → `"🗓️"`
- `"Within"` → `"💬"`

**`noteProjectIds` moves into the store:** The store already has `projects` and imports `constants`. Computing `noteProjectIds` there (instead of in `App.svelte`) lets us call `prepareNotes()` right after reconcile. `App.svelte` switches to `store.noteProjectIds`.

---

### Task 1: Add emoji map to constants and `prepareNotes()` to actions

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/actions.ts`
- Modify: `tests/actions.test.ts`

- [ ] **Step 1: Write tests for `prepareNotes()`**

Add to `tests/actions.test.ts`:

```typescript
import { prepareNotes } from '../src/lib/actions';

// ... existing imports and helpers ...

const noteProjects: Record<string, Project> = {
  aside: { name: 'Aside', color: 'grey' },
  within: { name: 'Within', color: 'grey' },
  work: { name: 'Work', color: 'blue' },
};
const noteIdSet = new Set(['aside', 'within']);

describe('prepareNotes', () => {
  it('strips "* " prefix from note content', () => {
    const result = prepareNotes(
      [action({ content: '* Some event', project_id: 'aside' })],
      noteIdSet, noteProjects,
    );
    expect(result[0].content).toBe('🗓️ Some event');
  });

  it('does not strip "* " from non-note actions', () => {
    const result = prepareNotes(
      [action({ content: '* starred item', project_id: 'work' })],
      noteIdSet, noteProjects,
    );
    expect(result[0].content).toBe('* starred item');
  });

  it('prepends default emoji when note has no leading emoji', () => {
    const result = prepareNotes(
      [action({ content: '* plain note', project_id: 'aside' })],
      noteIdSet, noteProjects,
    );
    expect(result[0].content).toBe('🗓️ plain note');
  });

  it('does not prepend emoji when note already starts with one', () => {
    const result = prepareNotes(
      [action({ content: '* ✨ sparkly note', project_id: 'aside' })],
      noteIdSet, noteProjects,
    );
    expect(result[0].content).toBe('✨ sparkly note');
  });

  it('uses project-specific emoji (Within)', () => {
    const result = prepareNotes(
      [action({ content: '* chat message', project_id: 'within' })],
      noteIdSet, noteProjects,
    );
    expect(result[0].content).toBe('💬 chat message');
  });

  it('leaves non-note actions unchanged', () => {
    const result = prepareNotes(
      [action({ content: 'Buy milk', project_id: 'work' })],
      noteIdSet, noteProjects,
    );
    expect(result[0].content).toBe('Buy milk');
  });

  it('returns new array without mutating input', () => {
    const input = [action({ content: '* event', project_id: 'aside' })];
    const result = prepareNotes(input, noteIdSet, noteProjects);
    expect(result).not.toBe(input);
    expect(input[0].content).toBe('* event');
  });

  it('handles note project with no emoji mapping (no prefix added)', () => {
    const customNoteIds = new Set(['unmapped']);
    const customProjects: Record<string, Project> = {
      unmapped: { name: 'Journal', color: 'grey' },
    };
    const result = prepareNotes(
      [action({ content: '* entry', project_id: 'unmapped' })],
      customNoteIds, customProjects,
    );
    expect(result[0].content).toBe('entry');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- tests/actions.test.ts`
Expected: FAIL — `prepareNotes` not exported.

- [ ] **Step 3: Add `NOTE_PROJECT_EMOJIS` to `src/lib/constants.ts`**

```typescript
export const NOTE_PROJECT_EMOJIS: Readonly<Record<string, string>> = {
  'Aside': '🗓️',
  'Within': '💬',
};
```

- [ ] **Step 4: Add `prepareNotes()` to `src/lib/actions.ts`**

```typescript
import { NOTE_PROJECT_EMOJIS } from './constants';

const LEADING_EMOJI_RE = /^\p{Extended_Pictographic}/u;

export function prepareNotes(
  actions: CompletedAction[],
  noteProjectIds: Set<string>,
  projects: Record<string, Project>,
): CompletedAction[] {
  return actions.map(a => {
    if (!noteProjectIds.has(a.project_id)) return a;
    let content = a.content.replace(/^\*\s+/, '');
    if (!LEADING_EMOJI_RE.test(content)) {
      const projectName = projects[a.project_id]?.name;
      const emoji = projectName ? NOTE_PROJECT_EMOJIS[projectName] : undefined;
      if (emoji) {
        content = `${emoji} ${content}`;
      }
    }
    return { ...a, content };
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- tests/actions.test.ts`
Expected: All PASS.

- [ ] **Step 6: Commit**

```
jj commit -m "Add prepareNotes: strip note prefix and prepend default project emoji"
```

---

### Task 2: Add `eventsToActions` pipeline, wire into store and CLI, remove downstream stripping

The key insight: both the store (two code paths: cache-load and API-fetch) and the CLI do the same sequence: filter blocklist → reconcile → prepare notes. Wrapping this in `eventsToActions()` gives one call site for the whole pipeline.

**Files:**
- Modify: `src/lib/actions.ts` — add `eventsToActions()`
- Modify: `tests/actions.test.ts` — tests for `eventsToActions()`
- Modify: `src/lib/store.svelte.ts` — use `eventsToActions()`, expose `noteProjectIds`
- Modify: `src/App.svelte:17-23` — use `store.noteProjectIds`
- Modify: `src/components/ActionItem.svelte:13` — remove `* ` stripping
- Modify: `src/lib/markdown.ts:53` — remove `* ` stripping
- Modify: `src/cli.ts` — use `eventsToActions()`
- Modify: `tests/markdown.test.ts` — update test data for pre-prepared content

- [ ] **Step 1: Write tests for `eventsToActions()`**

Add to `tests/actions.test.ts`. This function combines blocklist filtering, reconciliation, and note preparation in one pipeline. The individual pieces (`prepareNotes`, `reconcile`) are already tested — `eventsToActions` tests focus on integration: that the pipeline produces ready-to-display actions.

```typescript
import { eventsToActions } from '../src/lib/actions';
import type { ActivityEvent } from '../src/lib/types';

function completedEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 1,
    event_date: '2026-02-20T10:00:00Z',
    event_type: 'completed',
    object_id: 't1',
    object_type: 'item',
    parent_project_id: 'p1',
    parent_item_id: null,
    initiator_id: 'u1',
    extra_data: { content: 'Test action' },
    ...overrides,
  };
}

const pipelineProjects: Record<string, Project> = {
  p1: { name: 'Work', color: 'blue' },
  aside: { name: 'Aside', color: 'grey' },
};

describe('eventsToActions', () => {
  it('filters blocklisted events, reconciles, and prepares notes', () => {
    const events = [
      completedEvent({ object_id: 't1', extra_data: { content: 'Good task' } }),
      completedEvent({ object_id: 'blocked', extra_data: { content: 'Bad task' } }),
      completedEvent({ object_id: 't2', parent_project_id: 'aside', extra_data: { content: '* Some event' } }),
    ];
    const blocklist = new Set(['blocked']);
    const noteIds = new Set(['aside']);
    const result = eventsToActions(events, pipelineProjects, blocklist, noteIds);
    expect(result).toHaveLength(2);
    expect(result.find(a => a.task_id === 'blocked')).toBeUndefined();
    expect(result.find(a => a.task_id === 't2')!.content).toBe('🗓️ Some event');
  });

  it('returns empty array for empty events', () => {
    const result = eventsToActions([], pipelineProjects, new Set(), new Set());
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- tests/actions.test.ts`
Expected: FAIL — `eventsToActions` not exported.

- [ ] **Step 3: Add `eventsToActions()` to `src/lib/actions.ts`**

```typescript
import { reconcile } from './reconcile';
import type { ActivityEvent } from './types';

export function eventsToActions(
  events: ActivityEvent[],
  projects: Record<string, Project>,
  blocklist: ReadonlySet<string>,
  noteProjectIds: Set<string>,
): CompletedAction[] {
  const filtered = events.filter(e => !blocklist.has(e.object_id));
  return prepareNotes(reconcile(filtered), noteProjectIds, projects);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- tests/actions.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```
jj commit -m "Add eventsToActions: pipeline from raw events to display-ready actions"
```

- [ ] **Step 6: Wire `eventsToActions()` into the store**

In `src/lib/store.svelte.ts`:

Add imports:
```typescript
import { NOTE_PROJECT_NAMES } from './constants';
import { eventsToActions } from './actions';
```

Add a helper and reactive state for `noteProjectIds`:
```typescript
let noteProjectIds: Set<string> = $state(new Set());

function computeNoteProjectIds(projs: Record<string, Project>): Set<string> {
  return new Set(
    NOTE_PROJECT_NAMES
      .map(name => Object.entries(projs).find(([, p]) => p.name === name)?.[0])
      .filter((id): id is string => id != null),
  );
}
```

In the cache-load path (around line 64-65), replace:
```typescript
const filtered = cachedEvents.filter(e => !BLOCKLIST.has(e.object_id));
allActions = reconcile(filtered);
```
with:
```typescript
noteProjectIds = computeNoteProjectIds(projects);
allActions = eventsToActions(cachedEvents, projects, BLOCKLIST, noteProjectIds);
```

In the API-fetch path (around lines 101-102), replace:
```typescript
const filtered = merged.filter(e => !BLOCKLIST.has(e.object_id));
const newActions = reconcile(filtered);
```
with:
```typescript
noteProjectIds = computeNoteProjectIds(projMap);
const newActions = eventsToActions(merged, projMap, BLOCKLIST, noteProjectIds);
```

The rest of the comparison and assignment logic stays the same.

Expose `noteProjectIds` in the store export object:
```typescript
get noteProjectIds() { return noteProjectIds; },
```

- [ ] **Step 7: Update `src/App.svelte` to use `store.noteProjectIds`**

Remove the local `noteProjectIds` derived (lines 17-23) and the `NOTE_PROJECT_NAMES` import.

Replace the 2 references to `noteProjectIds`: the `{noteProjectIds}` shorthand prop on `FilterChips` (line 163) and `ActionList` (line 167) both become `noteProjectIds={store.noteProjectIds}`.

- [ ] **Step 8: Remove `* ` stripping from `ActionItem.svelte`**

Line 13: delete the `strippedContent` derived entirely. Replace all uses of `strippedContent` (lines 20, 21, 25) with `rawContent`.

- [ ] **Step 9: Remove `* ` stripping from `markdown.ts`**

Change line 53 from:
```typescript
const content = isNote ? a.content.replace(/^\*\s+/, '') : a.content;
```
to:
```typescript
const content = a.content;
```

- [ ] **Step 10: Update `src/cli.ts` to use `eventsToActions()`**

Add import:
```typescript
import { eventsToActions } from './lib/actions';
```

Move `noteProjectIds` computation before the reconcile line. Replace the reconcile+filter block with:

```typescript
// Determine note project IDs
const noteProjectIds = new Set(
  noteProjectNames
    .map(name => Object.entries(projects).find(([, p]) => p.name === name)?.[0])
    .filter((id): id is string => id != null),
);

// Events → display-ready actions
const actions = eventsToActions(events, projects, blocklist, noteProjectIds);
```

Remove the old `reconcile` import (now called inside `eventsToActions`). Keep the `BLOCKLIST` import (still used for building the combined blocklist).

- [ ] **Step 11: Update `tests/markdown.test.ts`**

Notes now arrive with `* ` already stripped and emoji prepended. Update test data to reflect this — test inputs should have pre-prepared content (as if `prepareNotes()` already ran).

Tests to update:

- **"renders notes as plain list items, actions as checked"**: change `content: '* Unicorn spotted'` to `content: '🗓️ Unicorn spotted'` (pre-prepared), update assertion to `'> 🗓️ Unicorn spotted'`
- **"renders notes without timestamp"**: change `content: '* Unicorn spotted'` to `content: '🗓️ Unicorn spotted'`, update assertion to `'> 🗓️ Unicorn spotted'`
- **"strips '* ' prefix from note content"**: rename to "renders pre-prepared note content", change input to `content: '🗓️ Goblin sighting confirmed'`, update assertion to `'> 🗓️ Goblin sighting confirmed'`
- **"does not strip '* ' prefix from non-note content"**: keep as-is (non-note with `* ` prefix passes through unchanged)
- **"sorts notes alphabetically (ignoring leading emoji) before actions"**: change `content: '* Yeti footprints found'` to `content: '🗓️ Yeti footprints found'`, change `content: '* 🎉 Dragon eggs hatched'` to `content: '🎉 Dragon eggs hatched'`

- [ ] **Step 12: Run full validation**

Run: `bun run validate`
Expected: All tests pass, type check clean, lint clean.

- [ ] **Step 13: Commit**

```
jj commit -m "Wire eventsToActions into store and CLI, remove downstream note stripping"
```
