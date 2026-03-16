# Reviewist — Project Context

## Problem Statement

Todoist has no usable way to review completed tasks. The built-in Activity Log is a chronological audit trail, not a review tool. Completed recurring tasks don't appear in project completed lists at all — only in the Activity Log. The "completed tasks in Today view" feature is experimental/beta. There are no filters that can query completed tasks. The old "Review App for Todoist" integration is dead.

This is a personal tool for a single user (not multi-tenant). It's a client-side-only web app that hits the Todoist API directly from the browser. No backend needed — Todoist's API supports CORS (`Access-Control-Allow-Origin: *`).

## User Profile

- ~5 tasks/day, ~10 monthly "floating" tasks, ~50 unmoored backlog tasks
- Primary use case: weekly review showing all tasks completed in last 7 days
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

### Activity Log (primary data source)

`GET /api/v1/activities` with `object_event_types=["item:completed","item:uncompleted"]`. Returns all completions including recurring tasks. Cursor-based pagination (max 100 events/page). Todoist Pro provides unlimited history.

Activity event shape:

```json
{
  "event_date": "2026-02-27T01:39:52.853568Z",
  "event_type": "completed",
  "extra_data": { "content": "Task content here" },
  "id": 2.14240561981117e+36,
  "object_id": "6g5Mrp4hpm786fp5",
  "object_type": "item",
  "parent_project_id": "6g4hfMqPJ7p557mX",
  "source": "clickhouse"
}
```

Key fields: `extra_data.content` (task text), `event_date` (completion time), `parent_project_id` (may be null for deleted projects), `object_id` (task ID). The `id` field loses precision as a JSON float — use `object_id + event_date` as composite key instead. Note: `@labels` from the task content do NOT appear in the activity log `extra_data.content` field.

**Not available from the activity log:** section ID, due date, `is_recurring` flag, deadline, duration.

### Why not the v1 completed endpoints?

The v1 `/tasks/completed/by_completion_date` endpoint does not return recurring task completions. The `/tasks/completed/by_due_date` endpoint filters by due date, not completion date. The Todoist TypeScript SDK wraps `by_completion_date` and inherits the same gap. The activity log is the only endpoint that captures everything.

### Other endpoints used

- `GET /api/v1/projects` — project list (names, colors)
- `GET /api/v1/tasks/filter?query={filter}` — Todoist filter syntax, used for event tasks from the Aside project

### Rate Limits

- 1000 requests per 15 minutes per user
- Not a concern for this use case (single user, incremental fetches)

### Key Gotcha: Recurring Tasks

When a recurring task is completed, Todoist doesn't create a separate "completed" record in the project view. The task simply advances its due date. The completion IS logged in the Activity Log. Reviewist captures recurring completions correctly via the activity log.

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
│   ├── App.svelte          # Root: shared state, fetch orchestration, layout
│   ├── app.css             # Global: CSS vars, reset, typography, print, responsive
│   ├── lib/
│   │   ├── types.ts        # Interfaces for API responses + internal state
│   │   ├── api.ts          # Todoist fetch functions (projects, activity events)
│   │   ├── reconcile.ts    # Activity event reconciliation (complete/uncomplete pairing)
│   │   ├── colors.ts       # TODOIST_COLORS map
│   │   ├── cache.ts        # IndexedDB cache with integrity checks (SHA-256 + structural)
│   │   ├── dates.ts        # fmtDate, formatDayLabel
│   │   ├── tasks.ts        # Grouping, dedup, project sorting logic
│   │   ├── store.svelte.ts # Reactive store: fetch orchestration, incremental fetching
│   │   └── storage.ts      # localStorage helpers (token, excluded projects, refresh interval)
│   └── components/
│       ├── Header.svelte       # Title, date range, refresh indicator, settings toggle
│       ├── SetupPanel.svelte   # Token, refresh interval, fetch/forget buttons
│       ├── StatusMessage.svelte # Error/info/loading bar
│       ├── FilterChips.svelte  # Project filter toggles with Todoist colors
│       ├── TaskList.svelte     # Day grouping, dedup, renders TaskItems
│       ├── TaskItem.svelte     # Single task: check, content, project chip, time
│       └── DebugLog.svelte     # Collapsible debug log panel
└── tests/
    ├── api.test.ts
    ├── cache.test.ts          # Happy-path cache tests (fake-indexeddb)
    ├── cache-errors.test.ts   # IDB error callback tests (prototype patching)
    ├── cache-upgrade.test.ts  # DB version upgrade test (isolated)
    ├── dates.test.ts
    ├── events.test.ts
    ├── reconcile.test.ts
    ├── reconcile.bench.ts
    ├── storage.test.ts
    └── tasks.test.ts
```

### Architecture

#### Data flow

1. **Fetch**: Activity log events (`completed` + `uncompleted`) via paginated API calls
2. **Reconcile**: Sort events chronologically, pair uncompletes with their preceding completes, produce `CompletedTask[]`
3. **Display**: Group by day, dedup recurring tasks (×N badge), render with project colors

#### Timezone convention

The Todoist API returns `event_date` in UTC (ISO 8601 with `Z` suffix). The app uses two date functions:

- **`fmtDate`** (UTC) — for API parameters (`date_from`) and cache logic. Uses `toISOString()`.
- **`fmtLocalDate`** / **`fmtLocalTime`** (local timezone) — for all user-facing display: day grouping keys, "Today"/"Yesterday" labels, task completion times.

This matters because a task completed at `2026-02-20T23:30:00Z` should appear under Feb 21 for a CET user, not Feb 20. Never use `split('T')[0]` to extract dates for display — always convert to a `Date` object first and use `fmtLocalDate`.

#### Incremental fetching

Raw `ActivityEvent[]` are cached in IndexedDB alongside projects. On page load:
- **Cache empty/corrupt**: full fetch (last 6 weeks)
- **Cache valid**: render immediately from cached events, then incremental fetch from `max(event_date) - 1 hour` to now

The 1-hour overlap accounts for Clickhouse eventual consistency (activity events are sourced from Clickhouse). New events are merged with cached events, deduped by `object_id|event_date`, and events older than 6 weeks are evicted.

Auto-refresh (configurable: off / 1m / 5m / 15m) uses the same incremental path.

#### Cache integrity

IndexedDB cache stores raw events + projects + metadata. On load, two checks run:
1. **Structural**: stored event count matches actual array length
2. **Content hash**: SHA-256 of serialized events matches stored hash

If either fails, the cache is discarded and a full fetch is triggered.

#### Reconciliation

Each `uncompleted` event cancels the most recent preceding `completed` event for the same `object_id`. Recurring tasks produce multiple `completed` events sharing one `object_id` — each is treated as a separate completion.

#### Blocklist

A build-time blocklist (`src/blocklist.txt`, one task ID per line) filters out known-bad task IDs before reconciliation. Embedded via Vite's `?raw` import — edit the file and rebuild.

### Features

- Token input with localStorage persistence, collapsible settings panel (⚙ toggle, `Ctrl+,` shortcut)
- Fixed 6-week review window, displayed in header
- IndexedDB cache: renders instantly from cached events, then incremental refresh
- Configurable auto-refresh interval (off / 1m / 5m / 15m), persisted in localStorage
- Activity log as data source (captures recurring task completions)
- Groups completed tasks by day (newest day first), sorted by completion time within each day
- Deduplicates repeated completions (recurring tasks): shows ×N badge, latest timestamp, tooltip with all timestamps
- Project filter chips as multi-select toggles, colored with Todoist project colors
- Project tags on tasks link to `https://app.todoist.com/app/project/{id}`
- Event tasks (uncompletable `* ` tasks from Aside project) shown with colored bullet instead of checkmark
- Print-friendly CSS
- Dark theme, JetBrains Mono + DM Sans typography

### Dev Workflow

- `pnpm dev` — Vite dev server with hot reload
- `pnpm build` — produces `dist/index.html` (single file, works from `file://`)
- `pnpm check` — svelte-check type diagnostics
- `pnpm test` — vitest unit tests
- `pnpm lint` — ESLint with Svelte + TypeScript rules
- `pnpm validate` — runs tests, type checks, and lint in sequence. **Use this to verify changes.**

### Testing

Tests live in `tests/` (project root), using vitest with jsdom environment. Non-trivial `src/lib/` logic should have test coverage. When modifying existing code, verify existing tests still pass. When adding new logic, add tests if the code is non-trivial and feasible to test (pure functions, state logic — not Svelte components or fetch wrappers).

- `pnpm validate` runs vitest, svelte-check, and eslint in sequence.
- `tests/reconcile.test.ts` covers reconciliation: uncomplete cancellation, recurring task handling, out-of-order events.
- Cache tests are split across three files: `cache.test.ts` (round-trips, integrity checks, throw-based errors via fake-indexeddb), `cache-errors.test.ts` (IDB `onerror` callbacks via prototype patching), `cache-upgrade.test.ts` (DB version upgrade, isolated to avoid connection conflicts).
- Coverage thresholds are enforced at 95% for statements, branches, functions, and lines.
- When creating test tasks in Todoist for API experimentation, always delete them while uncompleted. Completing a test task and then deleting it leaves orphaned `completed` events in the activity log that will show up in Reviewist forever.

### SDK note

The Todoist SDK (`@doist/todoist-api-typescript`) might be installed as a dev dependency and exposed on `window.todoist` for console experimentation in dev mode **only**. **Do not use the SDK in production code** — it bundles `undici` (a Node.js HTTP client), adding ~600 KB to the build. The app uses direct `fetch()` calls instead.

## Todoist Feature Notes

- **Uncompletable tasks**: Prefix task name with `* ` (asterisk + space). No checkbox, but still gets dates, times, labels, comments, assignees. Caveat: completing a parent task silently marks uncompletable subtasks as done too.
- **Todoist color palette** (20 colors): berry_red, red, orange, yellow, olive_green, lime_green, green, mint_green, teal, sky_blue, light_blue, blue, grape, violet, lavender, magenta, salmon, charcoal, grey, taupe. Hex values in source code.

## Reference Links

- Todoist API v1 docs: https://developer.todoist.com/api/v1/
- Todoist color guide: https://developer.todoist.com/api/v1#tag/Colors
- Uncompletable tasks: https://www.todoist.com/help/articles/create-an-uncompletable-task-in-todoist-QxQosZuF
