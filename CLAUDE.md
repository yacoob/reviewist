# Reviewist — Project Context

## Problem Statement

Todoist has no usable way to review completed tasks. The built-in Activity Log is a chronological audit trail, not a review tool. Completed recurring tasks don't appear in project completed lists at all — only in the Activity Log. The "completed tasks in Today view" feature is experimental/beta. There are no filters that can query completed tasks. The old "Review App for Todoist" integration is dead.

This is a personal tool for a single user (not multi-tenant). It's a client-side-only web app that hits the Todoist API directly from the browser. No backend needed — Todoist's API supports CORS (`Access-Control-Allow-Origin: *`).

## User Profile

- ~5 tasks/day, ~10 monthly "floating" tasks, ~50 unmoored backlog tasks
- Primary use case: weekly review showing all tasks completed in last 7 days
- Secondary: ad-hoc review of any date range
- Uses Todoist Pro (required for unlimited activity history and deadline feature)
- Labels for grouping: `@feline`, `@cleaning`, etc.
- Has an "Aside" project for non-task entries (e.g. "Dawn returns from London") — these should be filterable/excludable
- Runs a homelab, comfortable self-hosting, prefers self-hosted solutions
- Android user

## Todoist Workflow Decisions

These are the workarounds adopted for Todoist's limitations:

| Need | Todoist Approach | Notes |
|---|---|---|
| Day tasks with times | Native due dates + times | Works perfectly |
| Recurring tasks (fixed) | `every Monday`, `every 1st` | Native support |
| Recurring tasks (from completion) | `every! 2 weeks` | The `!` syntax |
| Month floaters ("do sometime in March") | **Deadline** set to end of month | e.g. deadline March 31. Stays hidden until 7 days before. Filterable: `deadline: March 31` or `deadline before: April 1`. Cannot use deadlines on recurring tasks. |
| Unmoored "eventually" tasks | No date, live in a project | Invisible in time-based views until assigned a date |
| Notes/events (not tasks) | Separate "Aside" project | Kludge. Everything is a checkbox. Filter out of working views. |
| Tags/grouping | Labels | `@feline`, `@cleaning`, etc. |
| Weekly completed review | **This app** | The whole point |

## API Details

### Authentication

Personal API token from: Todoist Settings → Integrations → Developer.
Passed as `Authorization: Bearer <token>` header.

### Completed Tasks Endpoints

Todoist has gone through multiple API versions. The current state (Feb 2026):

1. **New unified API v1** (`api.todoist.com/api/v1/`) — REST v2 and Sync v9 are deprecated. The v1 docs list two relevant endpoints in the Tasks section:
   - `getTasks Completed By Completion Date` — ideal for "what did I finish this week"
   - `getTasks Completed By Due Date` — useful for "what was due this week"

   Confirmed endpoint: `GET /api/v1/tasks/completed?since={ISO}&until={ISO}&limit=200`. Parameters are `since`/`until` (ISO datetimes).

   Note: testing has shown that these endpoints don't show completed recurring tasks.

2. **Sync v9** (`api.todoist.com/sync/v9/completed/get_all`) — deprecated but still documented and appears to still work. Takes `since` (ISO datetime), `until` (ISO datetime), `limit` (int, max 200), `project_id` (optional filter). Returns:
   ```json
   {
     "items": [
       {
         "content": "Buy Milk",
         "completed_at": "2015-02-17T15:40:41.000000Z",
         "project_id": "2203306141",
         "section_id": "7025",
         "task_id": "2995104339",
         "id": "1899066186",
         "note_count": 0,
         "meta_data": null,
         "user_id": "2671355"
       }
     ],
     "projects": { "<id>": { "name": "...", "color": "...", ... } },
     "sections": { "<id>": { ... } }
   }
   ```
   The response helpfully resolves project and section names.

3. **Activity Log** (`api.todoist.com/api/v1/activity`) — last resort. Filterable by `event_type=completed`, `object_type=item`. Less structured.

### Filter Endpoint

- `GET /api/v1/tasks/filter?query={filter}` — accepts Todoist filter syntax (e.g. `#Aside & due after: 2026-01-13 & due before: 2026-02-25`). Returns `{ results: [...], next_cursor: ... }`. Used to fetch event tasks from the Aside project within a date range. Note: `due after`/`due before` are exclusive boundaries.

### Projects Endpoint

- v1: `GET /api/v1/projects` — returns array of project objects
- REST v2 (deprecated): `GET /rest/v2/projects`

### Rate Limits

- 1000 requests per 15 minutes per user
- Sync API: 1000 partial syncs, 100 full syncs per 15 minutes
- Not a concern for this use case (single user, manual fetches)

### Key Gotcha: Recurring Tasks

When a recurring task is completed, Todoist doesn't create a separate "completed" record in the project view. The task simply advances its due date. The completion IS logged in the Activity Log and IS returned by the `completed/get_all` endpoint. So this app should capture recurring completions correctly — verify this.

## Current State

Vite + Svelte 5 + TypeScript app. Build produces a single self-contained HTML file via `vite-plugin-singlefile`. Dev environment managed by mise (Node 22 LTS).

### Project Structure

```
reviewist/
├── index.html              # Vite entry (minimal shell with font links)
├── package.json
├── vite.config.ts
├── tsconfig.json
├── svelte.config.js
├── eslint.config.js
├── mise.toml               # mise dev environment (Node 22)
├── src/
│   ├── main.ts             # Mount App
│   ├── App.svelte           # Root: shared state, fetch orchestration, layout
│   ├── app.css             # Global: CSS vars, reset, typography, print, responsive
│   ├── lib/
│   │   ├── types.ts        # Interfaces for API responses + internal state
│   │   ├── api.ts          # Todoist fetch functions (projects, completed tasks, event tasks)
│   │   ├── colors.ts       # TODOIST_COLORS map
│   │   ├── cache.ts        # localStorage cache for instant render from stale data
│   │   ├── dates.ts        # fmtDate, formatDayLabel
│   │   ├── tasks.ts        # Grouping, dedup, project sorting logic
│   │   └── storage.ts      # localStorage helpers (token, excluded projects, refresh interval)
│   └── components/
│       ├── Header.svelte       # Title, refresh indicator, settings toggle
│       ├── SetupPanel.svelte   # Token, date range, refresh interval, fetch/forget buttons
│       ├── StatusMessage.svelte # Error/info/loading bar
│       ├── FilterChips.svelte  # Project filter toggles with Todoist colors
│       ├── TaskList.svelte     # Day grouping, dedup, renders TaskItems
│       └── TaskItem.svelte     # Single task: check, content, label chips, project chip, time
```

### Features

- Token input with localStorage persistence, collapsible settings panel (⚙ toggle)
- IndexedDB cache: renders stale data instantly on load, then refreshes in background
- Configurable auto-refresh interval (off / 1m / 5m / 15m), persisted in localStorage
- Date range picker (defaults to 6 weeks back)
- Todoist API v1 only (old sync v9 / activity log fallbacks removed)
- Groups completed tasks by day (newest day first), sorted by completion time within each day
- Deduplicates repeated completions (recurring tasks): shows ×N badge, latest timestamp, tooltip with all timestamps
- Project filter chips as multi-select toggles, colored with Todoist project colors (active = colored, inactive = muted with colored hover)
- Project tags on tasks link to `https://app.todoist.com/app/project/{id}`
- Project tags colored to match Todoist's 20-color palette
- Inline `@label` parsing from task content, shown as clickable chips
- Print-friendly CSS
- Event tasks (uncompletable `* ` tasks from Aside project) shown in review with colored bullet instead of checkmark, grouped by due date
- Dark theme, JetBrains Mono + DM Sans typography

### Dev Workflow

- `npm run dev` — Vite dev server with hot reload
- `npm run build` — produces `dist/index.html` (single file, works from `file://`)
- `npm run check` — svelte-check type diagnostics
- `npm test` — vitest unit tests
- `npm run lint` — ESLint with Svelte + TypeScript rules
- `npm run validate` — runs tests, type checks, and lint in sequence. **Use this to verify changes.**

### Testing

Tests live alongside source files (`src/lib/*.test.ts`), using vitest with jsdom environment. Non-trivial `src/lib/` logic should have test coverage. When modifying existing code, verify existing tests still pass. When adding new logic, add tests if the code is non-trivial and feasible to test (pure functions, state logic — not Svelte components or fetch wrappers).

## Improvement Roadmap

### High Priority
- migrating to using activity log endpoint for the completed tasks; other endpoints for "completed" are deprecated and will stop working at some point

### Medium Priority

- **Section grouping** — Todoist sections are meaningful, currently lost in the flat list
- **Pagination** — 200-item limit will bite on 6-week ranges with heavy use. Need cursor-based fetch loop
- **Keyboard shortcuts** — `[`/`]` to shift the date window back/forward by one week
- **Date range presets** — quick buttons for "this week", "last week", "this month", "last 30d" instead of always picking dates
- **Upcoming deadlines panel** — month-floaters with deadline fields. A weekly review needs "what's coming due" alongside "what got done". Single API call to active tasks filtered by deadline range

### Low Priority / Speculative

- **Project exclusion by name** — persist by project name not ID, survives delete+recreate
- **Recurring vs one-off annotation** — visually distinguish "fed the cats" (daily recurring) from "filed tax return" (one-off). API response may include `is_recurring` or cross-reference with active tasks
- **Markdown export** — copy button that dumps current view as markdown, for pasting into a journal or Obsidian
- **Webhook-driven mode** — Todoist POSTs completion events to an endpoint. Tiny receiver (n8n webhook node) builds local SQLite DB of completions. Eliminates pagination, enables historical analytics, survives API changes
- **Offline/PWA** — service worker for offline access to last-fetched data
- **Completion date correction** — CLI script to backdate a task's completion timestamp. Todoist's REST `/close` endpoint doesn't accept a date, and `item_complete` via Sync API is a no-op on already-completed tasks. The workaround is to batch `item_uncomplete` + `item_complete` (with `date_completed`) in a single Sync API request. Useful for tasks completed just after midnight that should belong to the previous day

## Todoist Feature Notes

- **Uncompletable tasks**: Prefix task name with `* ` (asterisk + space). No checkbox, but still gets dates, times, labels, comments, assignees. Better solution for notes/events than a separate project. Works on Free plan. Caveat: completing a parent task silently marks uncompletable subtasks as done too.
- **Todoist color palette** (20 colors): berry_red, red, orange, yellow, olive_green, lime_green, green, mint_green, teal, sky_blue, light_blue, blue, grape, violet, lavender, magenta, salmon, charcoal, grey, taupe. Hex values in source code.

## Testing Notes

- `npm run validate` runs vitest, svelte-check, and eslint in sequence.
- `src/lib/reconcile.test.ts` covers the reconciliation logic: uncomplete
  cancellation, recurring task handling, out-of-order events, and blocklist
  filtering.
- When creating test tasks in Todoist for API experimentation, always delete them
  while uncompleted. Completing a test task and then deleting it leaves orphaned
  `completed` events in the activity log that will show up in Reviewist forever.

## Migrating from `/tasks/completed` to the Activity Log API

### Problem

Reviewist fetches completed tasks from `GET /api/v1/tasks/completed` — a migration
shim for the deprecated Sync v9 `completed/get_all` endpoint. This endpoint works
today but will eventually be removed. The two official v1 replacements have critical
limitations:

- **`/tasks/completed/by_completion_date`** — does not return recurring task
  completions at all. Only one-off tasks appear. This makes it useless for a weekly
  review tool.
- **`/tasks/completed/by_due_date`** — filters by due date, not completion date.
  Wrong semantics for "what did I finish this week."

The Todoist TypeScript SDK (`@doist/todoist-api-typescript`) wraps
`by_completion_date`, so it inherits the same gap.

### Discoveries

#### Recurring tasks are missing from the v1 completed endpoints

Tested with real data (Feb 2026). The bare `/tasks/completed` endpoint returned 15
tasks. The SDK's `getCompletedTasksByCompletionDate` returned only 5 — all one-off
tasks. The 10 missing tasks were all recurring task completions (e.g. "Ubik medicine",
"Replace cat fountain filter").

#### The Activity Log captures everything

`GET /api/v1/activities` with `event_type=completed&object_type=item` returns all
completions including recurring tasks. It's a proper v1 endpoint, not deprecated, and
Todoist Pro provides unlimited history.

#### Activity Log data shape

A completed event looks like:

```json
{
  "event_date": "2026-02-27T01:39:52.853568Z",
  "event_type": "completed",
  "extra_data": {
    "client": "Mozilla/5.0; Todoist/9907",
    "content": "Task content here",
    "note_count": 0
  },
  "id": 2.14240561981117e+36,
  "initiator_id": "46612098",
  "object_id": "6g5Mrp4hpm786fp5",
  "object_type": "item",
  "parent_item_id": null,
  "parent_project_id": "6g4hfMqPJ7p557mX",
  "source": "clickhouse"
}
```

**Available fields:**

| Data needed         | Activity log field       | Notes                                    |
|---------------------|--------------------------|------------------------------------------|
| Task content        | `extra_data.content`     | Includes inline `@labels`                |
| Completion time     | `event_date`             | ISO timestamp                            |
| Project ID          | `parent_project_id`      | Need separate project fetch for names    |
| Task ID (for dedup) | `object_id`              | New alphanumeric v1 IDs                  |
| Section ID          | not available             | Gap — not needed for current features    |
| Labels              | parsed from content      | Same as current approach                 |

**Not available:** section ID, due date, `is_recurring` flag, deadline, duration.

#### Event ID precision issue

The `id` field is a very large number that loses precision when parsed as a JSON
float (e.g. `2.14240561981117e+36`). Should not be relied on as a unique key. Use
`object_id` + `event_date` instead.

### The Complete/Uncomplete/Delete Problem

The activity log is an event stream, not a state snapshot. If a user:

1. Completes a task
2. Uncompletes it
3. Completes it again
4. Deletes it

...the log contains 4 events: completed, uncompleted, completed, deleted. Simply
filtering for `completed` events would show the task twice, and wouldn't account for
the deletion.

Additionally, a task completed within a date range but uncompleted *after* that range
would appear as completed in a bounded query, even though it's actually active.

### Design: Two-Stage Migration

#### Stage 1: Stateless fetch-and-reconcile

No new storage layer. Fetch activity log events, reconcile in memory, map to the
existing `CompletedTask` type, and use the existing localStorage cache (same as
today).

##### Fetch

Fetch 3 event types from the activity log: `completed`, `uncompleted`, `deleted`.
Page through with cursor-based pagination (max 100 events/page).

The `uncompleted` and `deleted` fetch window extends to "now" regardless of the
configured date range. A task completed within the range but uncompleted *after* it
must still be filtered out. This typically costs 1-2 extra API pages (uncomplete and
delete events are rare).

##### Reconciliation

Each `completed` event represents one individual completion to display. Recurring
tasks produce multiple `completed` events sharing the same `object_id` — each is a
separate completion.

Processing steps (after sorting all events by `event_date` ascending):

1. **Start with all `completed` events** in the date range. Each is a candidate for
   display.
2. **Apply `uncompleted` events**: for each `uncompleted` event, find the most recent
   *unmatched* `completed` event with the same `object_id` that precedes it
   chronologically, and remove it. (Uncomplete undoes the latest completion, not all
   of them.)
3. **Apply `deleted` events**: for each `deleted` event, remove ALL completions for
   that `object_id`. Deleting a task removes its entire history from the review.

Dedup key for display: `object_id + '|' + event_date` (unique per completion,
including multiple completions of recurring tasks).

##### Mapping to CompletedTask

| `CompletedTask` field | Source                        | Notes                                   |
|-----------------------|-------------------------------|-----------------------------------------|
| `id`                  | `object_id + '\|' + event_date` | Unique per completion                 |
| `content`             | `extra_data.content`          | Includes inline `@labels`               |
| `completed_at`        | `event_date`                  | ISO timestamp                           |
| `project_id`          | `parent_project_id`           | May be null (deleted project)           |
| `task_id`             | `object_id`                   | Alphanumeric v1 ID                      |
| `section_id`          | `""`                          | Not available in activity log           |

##### Performance estimates

- ~15 events/day at typical usage (completions + some uncomplete/delete noise)
- 6 weeks of history: ~630 events, ~7 API pages, ~126KB of data
- 1 year: ~5,500 events, ~55 API pages — still fast enough for stateless fetch

#### Stage 2: Local event cache (contingent)

Implement only if Stage 1 has performance or UX problems (e.g. extended ranges
causing multi-second load times, or hitting rate limits with frequent refreshes).

##### Architecture

Two layers:

1. **Raw event store** (IndexedDB) — append-only log of activity events. Source of
   truth. Only ever added to, never rewritten.

2. **Derived task state** (computed from raw events) — "task X was completed at time
   Y in project Z with content W." This is what the UI reads.

##### Fetch strategy

- On first load: fetch all interesting events from the configured start date to now.
- On subsequent loads: fetch only events newer than the latest stored event
  (watermark).
- If the date range is extended backwards: fetch missing historical events.
- "Clear and re-bootstrap" as an escape hatch for suspected corruption.

Reconciliation logic is identical to Stage 1 but runs over stored events instead of
freshly-fetched ones.

##### Open questions (Stage 2 only)

- **Should we store all event types or just the three we need?** Storing all is more
  future-proof (supports section grouping, move tracking, etc.) but means more data
  and client-side filtering.
- **Extend existing IndexedDB cache or create a separate store?** The current cache
  (`src/lib/cache.ts`) stores rendered task data. The event store is a different
  data model.
- **Progressive rendering during bootstrap** — fetch a page, process it, render what
  we have, fetch the next page.

### Failure Modes and Edge Cases

#### Stage 1 failures

##### API / data shape

- **Pagination required** (max 100/page). Must page through all results. Partial
  fetch on network error → show error + fall back to stale cache.
- **`extra_data.content` could be missing/empty**. Need defensive access.
- **`parent_project_id` could be null** (deleted project). Existing "unfiled"
  fallback handles it.
- **Event `id` loses precision** as JSON float. Use `object_id + event_date` as
  composite key.
- **Event ordering**: API returns newest-first. Reconciliation needs to be
  order-independent (sort by `event_date` before processing).

##### Reconciliation edge cases

- **Recurring task `object_id` sharing**: all completions of a recurring task share
  one `object_id`. Each `completed` event must be treated individually — grouping by
  `object_id` and taking the latest event would collapse N completions to 1.
- **Uncomplete outside query window**: task completed Mon, uncompleted the following
  Monday (outside the date range). We don't see the uncomplete event. Fix: extend
  `uncompleted`/`deleted` fetch window to "now" (costs 1-2 extra API pages, usually
  empty).
- **Multiple complete/uncomplete cycles**: complete → uncomplete → complete produces
  3 events. The uncomplete cancels the first completion; the second completion
  stands. Pair uncompletes with completions chronologically.
- **Deleted recurring task**: `deleted` event removes ALL completions for that
  `object_id` from the view.
- **Task content changed between completions**: activity log records content at
  completion time (`extra_data.content`). Different completions of the same recurring
  task could show different text. This is correct behavior — show what it said when
  completed.
- **Timezone**: `event_date` is UTC. Day extraction via `.split('T')[0]` gives UTC
  date. A task completed at 11pm local shows as the next day in UTC. Pre-existing
  issue, not new.

##### Integration with existing code

- **`CompletedTask.section_id`**: activity log doesn't provide it. Pass empty string.
- **`CompletedTask.labels`**: activity log doesn't provide a `labels` array. Labels
  are parsed from content (`@label` syntax) client-side — this still works with
  `extra_data.content`.
- **`CompletedTask.id` must be unique per completion**. Use
  `object_id + '|' + event_date`.
- **Cache key format**: switching data source may need cache key versioning to avoid
  serving stale data from the old endpoint.

##### Browser / network

- **Extended ranges** (1 year) = ~55 API pages. Must not block the UI thread. Use
  async iteration, not `Promise.all` on all pages.
- **Network failure mid-pagination**: error out, show stale cache if available.

#### Stage 2 additional failures (if implemented)

- **`file://` compatibility**: IndexedDB may not work when opened via `file://`. The
  app distributes as a single HTML file. Must verify or gracefully fall back to
  Stage 1.
- **Safari private browsing**: aggressive IndexedDB quota limits.
- **Schema migration**: changing stored event shape breaks existing caches. Need
  version field or wipe-and-refetch.
- **Watermark drift**: "fetch only newer events" relies on stored watermark accuracy.
  Out-of-order events on server side → missed events. Escape hatch: manual
  re-bootstrap.
- **Concurrent tabs**: two tabs writing to IndexedDB. Transactions handle writes,
  but watermark logic could cause duplicate fetches.
- **Cache vs. reality drift**: Todoist retroactively changes event data → cached data
  is wrong. Only escape hatch fixes this.

### Current State

**Stage 1 (stateless fetch-and-reconcile) is implemented.**

- The activity log (`/api/v1/activities`) is the primary data source. The old
  `/tasks/completed` endpoint is no longer used.
- Fetches `completed` and `uncompleted` events, pages through all results, then
  reconciles them in memory to produce `CompletedTask` objects for display.
- A build-time **blocklist** (`src/blocklist.txt`, one task ID per line) filters
  out known-bad task IDs before reconciliation. All events for blocklisted
  `object_id`s are dropped. The blocklist is embedded via Vite's `?raw` import —
  no runtime management UI, edit the file and rebuild.
- The old localStorage cache (`cache.ts`) has been removed. No caching layer
  exists currently — every page load fetches fresh from the API.
- The Todoist SDK (`@doist/todoist-api-typescript`) is installed as a dev
  dependency and exposed on `window.todoist` for console experimentation in dev
  mode only. **Do not use the SDK in production code** — it bundles `undici` (a
  Node.js HTTP client), adding ~600 KB to the build. The app uses direct
  `fetch()` calls instead.
- `CompletedTask` no longer carries `section_id` (activity log doesn't provide
  it) or `labels` (parsed from content at render time).

## Reference Links

- Todoist API v1 docs: https://developer.todoist.com/api/v1/
- Todoist color guide (referenced from API docs): https://developer.todoist.com/api/v1#tag/Colors
- Todoist Python SDK: https://doist.github.io/todoist-api-python/
- Todoist TypeScript SDK: https://doist.github.io/todoist-api-typescript/
- Terminalist (Rust TUI for Todoist): https://github.com/romaintb/terminalist
- Official Todoist CLI: https://github.com/Doist/todoist-cli
- n8n weekly email workflow (needs updating for v1): https://n8n.io/workflows/2805-todoist-weekly-email-of-completed-tasks/
- Uncompletable tasks: https://www.todoist.com/help/articles/create-an-uncompletable-task-in-todoist-QxQosZuF
