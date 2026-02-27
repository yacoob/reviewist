# Migrating from `/tasks/completed` to the Activity Log API

## Problem

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

## Discoveries

### Recurring tasks are missing from the v1 completed endpoints

Tested with real data (Feb 2026). The bare `/tasks/completed` endpoint returned 15
tasks. The SDK's `getCompletedTasksByCompletionDate` returned only 5 — all one-off
tasks. The 10 missing tasks were all recurring task completions (e.g. "Ubik medicine",
"Replace cat fountain filter").

### The Activity Log captures everything

`GET /api/v1/activities` with `event_type=completed&object_type=item` returns all
completions including recurring tasks. It's a proper v1 endpoint, not deprecated, and
Todoist Pro provides unlimited history.

### Activity Log data shape

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

### Event ID precision issue

The `id` field is a very large number that loses precision when parsed as a JSON
float (e.g. `2.14240561981117e+36`). Should not be relied on as a unique key. Use
`object_id` + `event_date` instead.

## The Complete/Uncomplete/Delete Problem

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

## Design: Two-Stage Migration

### Stage 1: Stateless fetch-and-reconcile

No new storage layer. Fetch activity log events, reconcile in memory, map to the
existing `CompletedTask` type, and use the existing localStorage cache (same as
today).

#### Fetch

Fetch 3 event types from the activity log: `completed`, `uncompleted`, `deleted`.
Page through with cursor-based pagination (max 100 events/page).

The `uncompleted` and `deleted` fetch window extends to "now" regardless of the
configured date range. A task completed within the range but uncompleted *after* it
must still be filtered out. This typically costs 1-2 extra API pages (uncomplete and
delete events are rare).

#### Reconciliation

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

#### Mapping to CompletedTask

| `CompletedTask` field | Source                        | Notes                                   |
|-----------------------|-------------------------------|-----------------------------------------|
| `id`                  | `object_id + '\|' + event_date` | Unique per completion                 |
| `content`             | `extra_data.content`          | Includes inline `@labels`               |
| `completed_at`        | `event_date`                  | ISO timestamp                           |
| `project_id`          | `parent_project_id`           | May be null (deleted project)           |
| `task_id`             | `object_id`                   | Alphanumeric v1 ID                      |
| `section_id`          | `""`                          | Not available in activity log           |

#### Performance estimates

- ~15 events/day at typical usage (completions + some uncomplete/delete noise)
- 6 weeks of history: ~630 events, ~7 API pages, ~126KB of data
- 1 year: ~5,500 events, ~55 API pages — still fast enough for stateless fetch

### Stage 2: Local event cache (contingent)

Implement only if Stage 1 has performance or UX problems (e.g. extended ranges
causing multi-second load times, or hitting rate limits with frequent refreshes).

#### Architecture

Two layers:

1. **Raw event store** (IndexedDB) — append-only log of activity events. Source of
   truth. Only ever added to, never rewritten.

2. **Derived task state** (computed from raw events) — "task X was completed at time
   Y in project Z with content W." This is what the UI reads.

#### Fetch strategy

- On first load: fetch all interesting events from the configured start date to now.
- On subsequent loads: fetch only events newer than the latest stored event
  (watermark).
- If the date range is extended backwards: fetch missing historical events.
- "Clear and re-bootstrap" as an escape hatch for suspected corruption.

Reconciliation logic is identical to Stage 1 but runs over stored events instead of
freshly-fetched ones.

#### Open questions (Stage 2 only)

- **Should we store all event types or just the three we need?** Storing all is more
  future-proof (supports section grouping, move tracking, etc.) but means more data
  and client-side filtering.
- **Extend existing IndexedDB cache or create a separate store?** The current cache
  (`src/lib/cache.ts`) stores rendered task data. The event store is a different
  data model.
- **Progressive rendering during bootstrap** — fetch a page, process it, render what
  we have, fetch the next page.

## Failure Modes and Edge Cases

### Stage 1 failures

#### API / data shape

- **Pagination required** (max 100/page). Must page through all results. Partial
  fetch on network error → show error + fall back to stale cache.
- **`extra_data.content` could be missing/empty**. Need defensive access.
- **`parent_project_id` could be null** (deleted project). Existing "unfiled"
  fallback handles it.
- **Event `id` loses precision** as JSON float. Use `object_id + event_date` as
  composite key.
- **Event ordering**: API returns newest-first. Reconciliation needs to be
  order-independent (sort by `event_date` before processing).

#### Reconciliation edge cases

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

#### Integration with existing code

- **`CompletedTask.section_id`**: activity log doesn't provide it. Pass empty string.
- **`CompletedTask.labels`**: activity log doesn't provide a `labels` array. Labels
  are parsed from content (`@label` syntax) client-side — this still works with
  `extra_data.content`.
- **`CompletedTask.id` must be unique per completion**. Use
  `object_id + '|' + event_date`.
- **Cache key format**: switching data source may need cache key versioning to avoid
  serving stale data from the old endpoint.

#### Browser / network

- **Extended ranges** (1 year) = ~55 API pages. Must not block the UI thread. Use
  async iteration, not `Promise.all` on all pages.
- **Network failure mid-pagination**: error out, show stale cache if available.

### Stage 2 additional failures (if implemented)

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

## Current State

- The bare `/tasks/completed` endpoint is still working and is the primary data
  source.
- The Todoist SDK is installed and exposed on `window.todoist` for console
  experimentation.
- The SDK is usable for non-completed-task APIs (projects, sections, labels, etc.).
- Implementation will proceed in two stages: first stateless fetch-and-reconcile (no
  new storage), then optional local event cache if performance warrants it.
