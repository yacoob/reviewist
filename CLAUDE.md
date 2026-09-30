# Reviewist — Project Context

<!-- markdownlint-disable MD013 -->

## Problem Statement

Todoist has no usable way to review completed tasks. The built-in Activity Log is a chronological audit trail, not a review tool. Completed recurring tasks don't appear in project completed lists at all — only in the Activity Log. The "completed tasks in Today view" feature is experimental/beta. There are no filters that can query completed tasks. The old "Review App for Todoist" integration is dead.

This is a personal tool for a single user (not multi-tenant). It's a client-side-only web app that hits the Todoist API directly from the browser. No backend needed — Todoist's API supports CORS (`Access-Control-Allow-Origin: *`).

## Terminology

Reviewist uses bujo-inspired vocabulary, distinct from Todoist's:

| Reviewist term | Todoist equivalent              | Meaning                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Action**     | Task                            | Something you do — has a checkmark, completion time                                                                                                                                                                                                                                                                                                 |
| **Note**       | Uncompletable task (`*` prefix) | Something you record — rendered with an emoji in the gutter, no checkmark. The `*` prefix is stripped during processing; notes without a leading emoji get a default one per project (configured via `NOTE_PROJECT_EMOJIS` in `src/lib/constants.ts`). Lives in a **note project** (configured via `NOTE_PROJECT_NAMES` in `src/lib/constants.ts`). |

The Todoist API types (`task_id`, `ActivityEvent`, etc.) keep Todoist's naming. Reviewist's own types use the new vocabulary: `CompletedAction`, `DedupedAction`, `groupActionsByDay()`, etc.

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
  "id": 2.14240561981117e36,
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
- `GET /api/v1/tasks/filter?query={filter}` — Todoist filter syntax, used for notes from the Aside/Within projects

### Rate Limits

- 1000 requests per 15 minutes per user
- Not a concern for this use case (single user, incremental fetches)

### Key Gotcha: Recurring Tasks

When a recurring task is completed, Todoist doesn't create a separate "completed" record in the project view. The task simply advances its due date. The completion IS logged in the Activity Log. Reviewist captures recurring completions correctly via the activity log.

## Current State

Vite + Svelte 5 + TypeScript app. Build produces a single self-contained HTML file via `vite-plugin-singlefile`. Dev environment managed by direnv (Nix flake devShell: Node + pnpm).

### Project Structure

```output
reviewist/
├── index.html              # Vite entry (minimal shell with font links)
├── package.json
├── vite.config.ts
├── tsconfig.json
├── svelte.config.js
├── eslint.config.js
├── sea-config.json         # node SEA blob config for `pnpm compile`
├── pnpm-workspace.yaml     # pnpm settings (allowBuilds for esbuild + sharp)
├── flake.nix               # Nix devShell (nodejs, pnpm); entered via .envrc
├── .envrc                  # direnv: use flake, pnpm install, PATH_add node_modules/.bin
├── scripts/
│   ├── todoist-sweep-aside.sh      # Daily cron: closes uncompletable Aside tasks due today
│   ├── todoist-sweep-aside.service # systemd service unit
│   ├── todoist-sweep-aside.timer   # systemd timer unit
│   ├── obsidian-reviewist.css      # Obsidian CSS snippet: non-italic blockquotes for reviewist notes
│   └── build-sea.sh                # Builds reviewist-export via esbuild + node SEA + postject
├── src/
│   ├── main.ts             # Mount App
│   ├── cli.ts              # CLI export tool entry point
│   ├── generate-icons.ts   # Vite plugin: generates PWA icons from SVG at build time
│   ├── App.svelte          # Root: shared state, fetch orchestration, layout
│   ├── app.css             # Global: CSS vars, reset, typography, print, responsive
│   ├── lib/
│   │   ├── types.ts        # Interfaces for API responses + internal state
│   │   ├── constants.ts    # NOTE_PROJECT_NAMES, NOTE_PROJECT_EMOJIS, BLOCKLIST
│   │   ├── api.ts          # Todoist fetch functions (projects, activity events)
│   │   ├── reconcile.ts    # Activity event reconciliation (complete/uncomplete pairing)
│   │   ├── colors.ts       # TODOIST_COLORS map
│   │   ├── cache.ts        # IndexedDB cache with integrity checks (SHA-256 + structural)
│   │   ├── dates.ts        # fmtDate, formatDayLabel, monthKey, monthRange, startOfPreviousMonth
│   │   ├── events.ts       # Event merge/dedup, SIX_WEEKS_MS/OVERLAP_MS constants
│   │   ├── actions.ts      # eventsToActions pipeline, prepareNotes, sortActions, grouping, dedup
│   │   ├── markdown.ts     # Markdown rendering for CLI export (uses sortActions for ordering)
│   │   ├── richtext.ts     # Sanitized markdown-to-HTML for action titles and descriptions (marked + DOMPurify)
│   │   ├── store.svelte.ts # Reactive store: fetch orchestration, incremental fetching (uses eventsToActions)
│   │   └── storage.ts      # localStorage helpers (token, excluded projects, refresh interval)
│   └── components/
│       ├── Header.svelte       # Title, date range, refresh indicator, settings toggle
│       ├── SetupPanel.svelte   # Token, refresh interval, fetch/forget buttons
│       ├── StatusMessage.svelte # Error/info/loading bar
│       ├── FilterChips.svelte  # Project filter toggles with Todoist colors
│       ├── ActionList.svelte    # Day grouping, dedup, renders ActionItems
│       ├── ActionItem.svelte   # Single action: gutter (emoji or ✓), content, timestamp (far right)
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
    ├── actions.test.ts
    ├── markdown.test.ts
    └── richtext.test.ts
```

### Architecture

#### Data flow

1. **Fetch**: Activity log events (`completed` + `uncompleted`) via paginated API calls
2. **Process** (`eventsToActions` pipeline): Filter blocklist → reconcile (pair uncompletes with completes) → `prepareNotes` (strip `*` prefix, prepend default emoji) → `sortActions` (canonical order: note projects first by project then alphabetically, regular tasks by time)
3. **Display**: Group by day, dedup recurring actions (×N badge), render with project colors

#### Timezone convention

The Todoist API returns `event_date` in UTC (ISO 8601 with `Z` suffix). The app uses two date functions:

- **`fmtDate`** (UTC) — for API parameters (`date_from`) and cache logic. Uses `toISOString()`.
- **`fmtLocalDate`** / **`fmtLocalTime`** (local timezone) — for all user-facing display: day grouping keys, "Today"/"Yesterday" labels, action completion times.

This matters because an action completed at `2026-02-20T23:30:00Z` should appear under Feb 21 for a CET user, not Feb 20. Never use `split('T')[0]` to extract dates for display — always convert to a `Date` object first and use `fmtLocalDate`.

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

Each `uncompleted` event cancels the most recent preceding `completed` event for the same `object_id`. Recurring actions produce multiple `completed` events sharing one `object_id` — each is treated as a separate completion.

#### Blocklist

A blocklist of known-bad Todoist task IDs (`BLOCKLIST` in `src/lib/constants.ts`) filters out IDs before reconciliation. Used by both the web app and the CLI export tool.

### Dev Workflow

- `pnpm dev` — Vite dev server with hot reload
- `pnpm build` — produces `dist/index.html` (single file, works from `file://`)
- `pnpm check` — svelte-check type diagnostics
- `pnpm test` — vitest unit tests
- `pnpm lint` — ESLint with Svelte + TypeScript rules
- `pnpm validate` — runs tests, type checks, and lint in sequence. **Use this to verify changes.**
- `pnpm bench` — run reconciliation benchmarks
- `pnpm compile` — build standalone `reviewist-export` binary (node SEA; see `scripts/build-sea.sh`)
- `pnpm clean` — remove dist, build, and Vite cache
- `pnpm raze` — remove dist, build, node_modules, coverage, .direnv, and the compiled binary
- `pnpm export` — CLI export tool, JSON output (requires `TODOIST_TOKEN` env var). Default range: current + previous month.
- `pnpm export -- --format markdown` — CLI export with markdown output to stdout (Obsidian-compatible frontmatter)
- `pnpm export -- --outdir ~/vault/reviews` — write monthly `YYYY/YYYY-MM.md` files to directory (overwrites existing)
- `pnpm export -- --help` — CLI usage and options

### Testing

Tests live in `tests/` (project root), using vitest with jsdom environment. Non-trivial `src/lib/` logic should have test coverage. When modifying existing code, verify existing tests still pass. When adding new logic, add tests if the code is non-trivial and feasible to test (pure functions, state logic — not Svelte components or fetch wrappers).

- `pnpm validate` runs vitest, svelte-check, and eslint in sequence.
- `tests/reconcile.test.ts` covers reconciliation: uncomplete cancellation, recurring action handling, out-of-order events.
- Cache tests are split across three files: `cache.test.ts` (round-trips, integrity checks, throw-based errors via fake-indexeddb), `cache-errors.test.ts` (IDB `onerror` callbacks via prototype patching), `cache-upgrade.test.ts` (DB version upgrade, isolated to avoid connection conflicts).
- Coverage thresholds are enforced at 95% for statements, branches, functions, and lines.
- When creating test tasks in Todoist for API experimentation, always delete them while uncompleted. Completing and then deleting a test task leaves orphaned `completed` events in the activity log that will show up in Reviewist forever.

### SDK note

The Todoist SDK (`@doist/todoist-api-typescript`) might be installed as a dev dependency and exposed on `window.todoist` for console experimentation in dev mode **only**. **Do not use the SDK in production code** — it bundles `undici` (a Node.js HTTP client), adding ~600 KB to the build. The app uses direct `fetch()` calls instead.

## Reference Links

- Todoist API v1 docs: <https://developer.todoist.com/api/v1/>
- Todoist color guide: <https://developer.todoist.com/api/v1#tag/Colors>
- Uncompletable tasks: <https://www.todoist.com/help/articles/create-an-uncompletable-task-in-todoist-QxQosZuF>
