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
- Has an "Events" project for non-task entries (e.g. "Dawn returns from London") — these should be filterable/excludable
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
| Notes/events (not tasks) | Separate "Events" project | Kludge. Everything is a checkbox. Filter out of working views. |
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

   **Exact URL paths and parameter names are unconfirmed.** The docs are rendered via Redocly and hard to scrape. The prototype tries `/api/v1/tasks/completed` with `since`/`until` and `completed_after`/`completed_before` params.

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

- `GET /api/v1/tasks/filter?query={filter}` — accepts Todoist filter syntax (e.g. `#Events & due after: 2026-01-13 & due before: 2026-02-25`). Returns `{ results: [...], next_cursor: ... }`. Used to fetch event tasks from the Events project within a date range. Note: `due after`/`due before` are exclusive boundaries.

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
│   │   ├── cache.ts        # IndexedDB cache for instant render from stale data
│   │   ├── dates.ts        # fmtDate, formatDayLabel
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
- Event tasks (uncompletable `* ` tasks from Events project) shown in review with colored bullet instead of checkmark, grouped by due date
- Dark theme, JetBrains Mono + DM Sans typography

### Dev Workflow

- `mise run dev` / `npm run dev` — Vite dev server with hot reload
- `mise run build` / `npm run build` — produces `dist/index.html` (single file, works from `file://`)
- `mise run check` / `npm run check` — svelte-check type diagnostics
- `mise run lint` / `npm run lint` — ESLint with Svelte + TypeScript rules

## Improvement Roadmap

### High Priority

- **Pin down exact v1 endpoint params** — currently trying two URL patterns, one is presumably 404ing silently. Confirm and remove the dead one

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

## Todoist Feature Notes

- **Uncompletable tasks**: Prefix task name with `* ` (asterisk + space). No checkbox, but still gets dates, times, labels, comments, assignees. Better solution for notes/events than a separate project. Works on Free plan. Caveat: completing a parent task silently marks uncompletable subtasks as done too.
- **Todoist color palette** (20 colors): berry_red, red, orange, yellow, olive_green, lime_green, green, mint_green, teal, sky_blue, light_blue, blue, grape, violet, lavender, magenta, salmon, charcoal, grey, taupe. Hex values in source code.

## Reference Links

- Todoist API v1 docs: https://developer.todoist.com/api/v1/
- Todoist color guide (referenced from API docs): https://developer.todoist.com/api/v1#tag/Colors
- Todoist Python SDK: https://doist.github.io/todoist-api-python/
- Todoist TypeScript SDK: https://doist.github.io/todoist-api-typescript/
- Terminalist (Rust TUI for Todoist): https://github.com/romaintb/terminalist
- Official Todoist CLI: https://github.com/Doist/todoist-cli
- n8n weekly email workflow (needs updating for v1): https://n8n.io/workflows/2805-todoist-weekly-email-of-completed-tasks/
- Uncompletable tasks: https://www.todoist.com/help/articles/create-an-uncompletable-task-in-todoist-QxQosZuF
