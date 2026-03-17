# Roadmap

## CLI Export Tool

Standalone Bun-compiled binary that fetches completed actions from the Todoist Activity Log, reconciles them, and writes structured JSON to stdout. Shares core logic with Reviewist — no code duplication. Bun also replaces Node as the project's runtime (Vite, vitest, svelte-check all run on Bun).

### Invocation

```
reviewist-export [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--note-projects "Aside,Within"] [--blocklist path/to/blocklist.txt]
```

- **Token**: `TODOIST_TOKEN` env var (required, exits with error to stderr, exit code 1)
- **`--since`**: start of date range (default: 6 weeks ago, using `SIX_WEEKS_MS` from `events.ts`)
- **`--until`**: end of date range (default: today)
- **`--note-projects`**: comma-separated list (default: from shared `NOTE_PROJECT_NAMES` constant)
- **`--blocklist`**: path to additional blocklist file, one task ID per line (optional). Merged with the built-in `BLOCKLIST` constant.

Errors go to stderr, JSON to stdout, exit 0 on success, 1 on failure.

### Output

JSON object to stdout with two top-level keys:

```json
{
  "projects": {
    "abc123": { "name": "Household", "color": "green" }
  },
  "actions": [
    {
      "content": "Feed the cats",
      "completed_at": "2026-03-17T08:30:00.000Z",
      "project_id": "abc123",
      "task_id": "def456",
      "is_note": true
    }
  ]
}
```

- `projects`: map of project ID → `{ name, color }` — same `Project` type from `types.ts`. Color is the Todoist color name (e.g. `"green"`), not hex.
- `actions`: flat array sorted by `completed_at` ascending. Each entry is a `CompletedAction` from `types.ts` plus an `is_note` boolean. The `id` field (composite `object_id|event_date` key) is included since it's part of the type. The `is_note` flag is added by the CLI during serialization — it does not modify the shared `CompletedAction` type.
- Only projects referenced by at least one action are included in the `projects` map.

Actions are sorted by `completed_at` ascending (handled by `reconcile()`).

### Shared code changes

1. **New `src/lib/constants.ts`** — exports:
   - `NOTE_PROJECT_NAMES = ['Aside', 'Within']` — replaces the `__NOTE_PROJECTS__` Vite define. `vite.config.ts` define, `vite-env.d.ts` declaration, and `eslint.config.js` global are removed. `App.svelte` imports from `constants.ts`.
   - `BLOCKLIST: ReadonlySet<string>` — the task IDs currently in `src/blocklist.txt`, moved inline as a constant. `src/blocklist.txt` and the `?raw` import in `storage.ts` are removed. Both web app and CLI import from here. The CLI's `--blocklist` flag loads additional IDs and merges them with this constant.

2. **Add optional `until` parameter to `fetchActivityEvents`** — the current signature is `(token, since)`. Add an optional `until?: string` parameter that sets `date_to` in the API request. The web app doesn't pass it (behavior unchanged). The CLI passes it for `--until`.

3. **Sort `reconcile()` output by `completed_at` ascending** — currently returns actions in Map iteration order. Add an explicit sort before returning. This benefits both the web app (removes implicit ordering assumptions) and the CLI.

4. **No changes to `dates.ts`, `events.ts`, `actions.ts`, `colors.ts`, `types.ts`**.

### CLI structure

```
cli/
  main.ts          # Entry point: arg parsing, orchestration, JSON output
```

`main.ts` flow:
1. Read `TODOIST_TOKEN` from `process.env`
2. Parse args (since, until, note-projects, blocklist)
3. `fetchProjects()` + `fetchActivityEvents(token, since, until)` in parallel
4. `reconcile()` the events (returns sorted by `completed_at`)
5. Filter by `BLOCKLIST` + any additional IDs from `--blocklist`
6. Serialize: add `is_note` flag per action, filter projects map to referenced IDs only
7. Write JSON to stdout

### Bun compatibility

- `api.ts` uses global `fetch()` — works in Bun natively
- `reconcile.ts`, `dates.ts`, `events.ts`, `colors.ts` — pure functions, no browser APIs
- `storage.ts`, `cache.ts`, `store.svelte.ts` — not imported by CLI
- No import resolution issues — Bun uses Node-compatible module resolution, matching the existing extensionless imports
- Bun also replaces Node for the web app dev workflow (Vite, vitest, svelte-check, eslint)

### Build

`bun build --compile cli/main.ts --outfile reviewist-export` producing a single binary.

### Runtime migration

- `mise.toml`: replace `node = "22"` + `pnpm = "latest"` with `bun = "latest"`
- All scripts invoked via `bun run` (e.g. `bun run dev`, `bun run validate`)

## Future ideas

- Rendering utilities that consume the export JSON → markdown, CSV, etc.
- Subcommand structure (`reviewist export`, `reviewist render`) if multiple tools emerge
