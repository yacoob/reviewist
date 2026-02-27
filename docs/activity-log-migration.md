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

### SDK bugs

Two bugs found in the SDK (v6.8.0):

1. **Date filtering is broken** — `getActivityLogs` accepts `since`/`until` but the
   API expects `date_from`/`date_to`. The keys are never renamed, so date parameters
   are silently ignored. Filed as
   [doist/todoist-api-typescript#468](https://github.com/Doist/todoist-api-typescript/issues/468).
   Workaround: pass `date_from`/`date_to` directly with a type cast.

2. **`object_event_types` not exposed** — the API supports an `object_event_types`
   array param (e.g. `item:completed,item:uncompleted`) for combined filtering, but
   the SDK doesn't expose it.

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

## Design: Local Event Store

The solution is to cache activity log events locally and derive task state from the
full event stream.

### Architecture

Two layers:

1. **Raw event store** (IndexedDB) — append-only log of activity events. Source of
   truth. Only ever added to, never rewritten.

2. **Derived task state** (computed from raw events) — "task X was completed at time
   Y in project Z with content W." This is what the UI reads.

### Fetch strategy

- On first load: fetch all interesting events from the configured start date to now.
  Page through with cursor-based pagination (max 100 events/page).
- On subsequent loads: fetch only events newer than the latest stored event.
- If the date range is extended backwards: fetch missing historical events.
- "Clear and re-bootstrap" as an escape hatch for suspected corruption.

### Event processing

For each task (`object_id`), replay events chronologically and determine final state:

1. Fetch events filtered to: `completed`, `uncompleted`, `deleted`
2. Group by `object_id`
3. For each task, check the **latest** event:
   - `completed` → task is completed, show it (use `event_date` as completion time)
   - `uncompleted` → task was undone, don't show it
   - `deleted` → task was deleted, don't show it

This can be done incrementally: when new events arrive, update only affected tasks
rather than re-crunching everything.

### Performance estimates

- ~15 events/day at typical usage (completions + some uncomplete/delete noise)
- 6 weeks of history: ~630 events, ~7 API pages, ~126KB of data
- 1 year: ~5,500 events, trivial to store and crunch in JS (single-digit ms)
- IndexedDB storage: negligible (few MB even after years)

### Open questions

- **Should we store all event types or just the three we need?** Storing all is more
  future-proof (supports section grouping, move tracking, etc.) but means more data
  and client-side filtering.
- **Extend existing IndexedDB cache or create a separate store?** The current cache
  (`src/lib/cache.ts`) stores rendered task data. The event store is a different
  data model.
- **Progressive rendering during bootstrap** — fetch a page, process it, render what
  we have, fetch the next page.

## Current State

- The bare `/tasks/completed` endpoint is still working and is the primary data
  source.
- The Todoist SDK is installed and exposed on `window.todoist` for console
  experimentation.
- The SDK is usable for non-completed-task APIs (projects, sections, labels, etc.).
- The activity log migration is designed but not implemented.
