# Reviewist vs Super Productivity

Notes from evaluating [Super Productivity](https://github.com/super-productivity/super-productivity) 19.3.1 (October 2026) as a self-hosted replacement for the Todoist + Reviewist combo. The motivation was self-hosting and data ownership; porting Reviewist was out of scope. See also [vs-tududi.md](vs-tududi.md) and [vs-vikunja.md](vs-vikunja.md).

Super Productivity (SP) is local-first: each client keeps its data in its own storage (IndexedDB in the browser) and a sync backend carries changes between clients. There is no server holding the data in readable form, which changes what "self-hosted" means here.

## What was tested

- The web app from the `johannesjo/super-productivity:19.3.1` image, driven with Playwright in Chromium with the browser clock under test control (Europe/Dublin).
- 14 recurring tasks created through the repeat dialog, one per recurrence shape in the real Todoist data, then 70 simulated days (2026-11-02 to 2027-01-10) of opening Today each morning and completing what was there. Completion-based tasks were completed a day late on purpose, and two tasks were skipped on chosen days.
- Where completions end up: the task list, the archive, the backup export, and the History view.
- A self-hosted SuperSync server (`ghcr.io/super-productivity/supersync:v19.3.1` + Postgres + Mailpit for email), with one browser profile uploading the 70 days of history and a fresh profile joining afterwards.
- The Planner view: adding tasks to tomorrow, reordering within a day, dragging to another day.
- Source reading at the v19.3.1 tag for anything the UI didn't make obvious.

Not tested: the Android app, the bundled Todoist importer against the real account, the plugin API, and WebDAV sync.

## Data model mapping

| Todoist | Super Productivity |
|---|---|
| Project | Project (a `section` entity exists in the data model; not tried) |
| Label | Tag |
| Due date / time | `dueDay` or `dueWithTime`, mutually exclusive |
| Deadline | `deadlineDay` / `deadlineWithTime`; the `!` short syntax is off by default |
| Priority p1-p4 | `priority`, short syntax `p1`-`p3` |
| Description | `notes` (markdown) |
| every day | "Every day" preset |
| every weekday | "Every Monday through Friday" preset |
| every wednesday, every tue, thu, every 2 weeks on monday | Custom, unit Week, weekday chips, interval |
| every 1st friday, every last friday | Custom, unit Month, monthly pattern (first..fourth, last + weekday) |
| every last day | "Every month on the last day" preset |
| every 15th, every year on nov 20 | "Every month on day N" / "Every year on" presets, anchored to the start date |
| every day at 08:00 | Time set through the start-date picker in the repeat dialog; stored as `startTime` with an at-start reminder |
| `every! N days/weeks/months` | "After I complete it…"; weeks are stored as days (2 weeks = `DAILY` x 14) with `waitForCompletion` |

Uncompletable tasks have no equivalent. SP notes are per-project scratch notes without a date, so Reviewist-style dated notes would have to be ordinary tasks. There is no month- or year-floating concept, and it wasn't tried hands-on. From the docs, a deadline with no due date comes closest: the task stays in its project, shows as a deadline marker in the Planner and with a flag in the Schedule views, appears in the Deadline view, and moves into Today by itself on the deadline day. Nothing ties it to a month or brings it up at the start of one.

Quick-add short syntax understands recurrence (`@every friday`, `@daily`, `@every 2 days`, `@every 15th`) as well as `@tomorrow`-style dates.

## Behaviour observed

Each occurrence of a recurring task is a separate task instance with its own id (`rpt_<cfg>_<date>`) and, once completed, its own `doneOn`. This is the main difference from Todoist, tududi and Vikunja, which all move one task's due date forward. The 70-day run produced 261 instances, and every completion was still there at the end with the right date.

All fixed-cycle rules produced exactly the dates Todoist would: weekdays, Wednesdays, Tuesday/Thursday, every other Monday, first and last Friday, last day of month, the 15th, yearly, and the timed daily task at 08:00. The completion-based rules counted from the completion day every time: done Nov 3 gave Nov 6 for 3 days, Nov 17 for 2 weeks and Dec 3 for a month; done Dec 4 gave Jan 4.

Missed occurrences depend on the "If you fall behind" option. The default keeps every copy, so a skipped Wednesday instance was still open on Thursday. The exception is a plain every-day rule, which gets `skipOverdue` ("don't let overdue instances pile up") switched on at creation (`get-default-skip-overdue.ts`). The two daily instances I skipped disappeared a few seconds after the next day's copy appeared, and left nothing behind. That is documented behaviour, but it surprised me: for a habit tracker the missed days are part of the history.

New repeat instances are created on app start and on date change. One caveat: the source has a comment describing a known, unexplained gap where an instance can fail to appear until the next restart or day change (`task-due.effects.ts`, issue #6230). I didn't hit it.

Completed tasks stay in the active list until you archive them with "Finish day" or "Move done to archive". There is no automatic archiving. Archiving keeps title, project, tags, notes, `repeatCfgId`, `created` and `doneOn`, and drops `dueDay`/`dueWithTime` (`archive.service.ts`), so the archive knows when something was done but not when it was due. Tasks older than 21 days go to a second "old" archive tier straight away.

The History view is a usable review screen. It lists every day with the number of tasks completed and opens a day to show them, recurring ones marked, with a restore button per row. Tasks without tracked time are still listed. In the Today context it covers every project, active and archived (`get-complete-state-for-work-context.util.ts`); in a project it covers that project. There is no per-project filtering in the Today version, and no way to show notes alongside.

The Planner covers the Todoist "plan tomorrow" workflow: each day is a column with its own add button, tasks can be reordered within a day and dragged to another day, and both survive a reload. New tasks are added at the top of the day.

## Sync and self-hosting

The sync dialog offers SuperSync (beta, the default), Dropbox, Nextcloud, and "WebDAV (not recommended / no support)" with a long warning. SuperSync is the one the project supports.

Self-hosting SuperSync works but is not light. The README's tested setup is an amd64 host, a public domain with ports 80/443 for Caddy, Postgres, and a working SMTP account, with the desktop and mobile apps as clients. The web app isn't on that list. Accounts are email magic links or passkeys only, so SMTP isn't optional. In production mode the server refuses to start unless `PUBLIC_URL` is HTTPS; the local test ran it with `NODE_ENV=development`. On first start it ran its database migrations and had to recover one (`DROP INDEX CONCURRENTLY` inside a transaction) before coming up.

End-to-end encryption is mandatory for SuperSync. The first client sets a password, and every other client has to enter it. IDs and timestamps stay readable on the server; task content doesn't. That is good for privacy but rules out a review tool that reads the server.

A fresh client joining after 70 days of history got everything: all 14 repeat configs, the active tasks, and both archive tiers (78 + 182 tasks) with their `doneOn` values. That was my main worry, because the archive docs describe archives being rebuilt from operations rather than synced as files.

The web app talks to SuperSync from the browser, so `CORS_ORIGINS` on the server has to include wherever the web app is served from.

## Getting the data out

For a Reviewist replacement the options are:

- The History view as is, which may be enough.
- A plugin running inside the app. The plugin API has `getArchivedTasks()`, `getTasks()` and `getAllProjects()`, and plugins run on desktop, mobile and web (web needs a manual ZIP install). Not tried.
- The backup export (Settings > Sync & Backup > Import/Export), a JSON file with active and archived tasks. The CLI export in Reviewist could read that instead of the Todoist API, but someone has to produce the file.
- The local REST API, Electron desktop only.

## Shortcomings

- Self-hosted SuperSync needs a public HTTPS domain, SMTP and Postgres, and the web app isn't part of the tested setup.
- No uncompletable tasks or dated notes.
- Every-day rules drop missed occurrences without trace unless the option is switched off per task.
- Archiving is manual and drops due dates.
- The History view has no project filter in its cross-project form.
- The Todoist importer doesn't create repeat configs (it keeps the next date and copies the rule text into notes), drops sections, flattens nested projects and skips completed history (`packages/plugin-dev/todoist-import/README.md`). Recurring tasks would have to be set up again by hand.
- The repeat dialog sets a time of day through a second, nested schedule dialog, which took some finding.

## Rough edges seen during automation

These may be artefacts of driving the UI with Playwright and weren't confirmed by hand:

- After adding a task with `@` short syntax, the next short-syntax add in a row left the submit button disabled.
- After an add, the new task's title is sometimes left in edit mode, and the add button ignores clicks until edit mode is left.

## Verdict at the time

Of the three candidates, SP is the only one that keeps a real per-occurrence completion history for recurring tasks, its recurrence rules covered every shape in the Todoist data, and it has a built-in History view that does a fair part of what Reviewist does. The costs are the SuperSync hosting requirements and the lack of notes. The Android app and the real-data import still need a hands-on look before deciding.
