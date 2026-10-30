# Reviewist vs Donetick

Notes from evaluating [Donetick](https://github.com/donetick/donetick) v0.1.85 (October 2026) as a self-hosted replacement for the Todoist + Reviewist combo. The motivation was self-hosting and data ownership; porting Reviewist was out of scope. See also [vs-super-productivity.md](vs-super-productivity.md), [vs-tududi.md](vs-tududi.md) and [vs-vikunja.md](vs-vikunja.md).

Donetick started as a household chore manager (circles, assignees, points), but it has grown projects, sections, labels, priorities, subtasks and descriptions, so it can be used as a personal task manager. The server is a single Go binary with the web UI built in, storing everything in SQLite (Postgres optional).

## What was tested

- The `donetick/donetick:v0.1.85` image with SQLite, password signup, and a long-lived API key (`secretkey` header).
- 16 chores created through the REST API, one per recurrence shape in the real Todoist data, with payloads built the way the web editor builds them (`ChoreEdit.jsx`, `RepeatSection.jsx`). One daily chore was also created through the web UI to check what the editor actually stores.
- 88 simulated days (2026-08-03 to 2026-10-29) of completing everything due each morning, using the `completedTime` field to backdate completions. Completion-based chores were completed a day late on purpose, and two chores were skipped on chosen days. The window crosses the October DST change; a separate probe covered March 2027.
- The completion history: per chore, the cross-chore `/chores/history` endpoint, the Activities page and the per-chore history page.
- Skip, undo, archive and delete, and what each does to the history.
- Source reading of the scheduler (`internal/chore/scheduler.go`) and the frontend at the same version.

Not tested: the Android app, any kind of Todoist import (there is none), and Postgres.

## Data model mapping

| Todoist | Donetick |
|---|---|
| Project | Project, with sections |
| Label | Label |
| Due date / time | `nextDueDate`; with no time picked the editor uses 23:59:59 local |
| Deadline | none; `completionWindow` limits how early a chore can be completed |
| Priority p1-p4 | `priority` P1-P4 |
| Description | `description`, plus attachments and subtasks |
| every day | `daily` |
| every weekday, every wednesday, every tue, thu | `days_of_the_week` with a set of days |
| every 2 weeks on monday | `interval`, 2 weeks |
| every 1st friday, every last friday | `days_of_the_week` with `weekPattern: week_of_month` and occurrences 1..4 or -1 (last) |
| every last day | `day_of_the_month` 31 in all months (clamped to the month's last day) |
| every 15th | `day_of_the_month` 15, or `monthly` from a due date on the 15th |
| every year on aug 20 | `yearly` |
| `every! N days/weeks/months` | `interval` with `isRolling` ("based on completion date") |

The "custom" types (`interval`, `days_of_the_week`, `day_of_the_month`) always carry a time of day, 18:00 unless you change it, plus the browser's timezone. The plain `daily`/`weekly`/`monthly`/`yearly` types carry neither.

There are no uncompletable tasks, dated notes or month-floating tasks. A chore can have no due date at all.

## Behaviour observed

Donetick keeps one row per chore and moves its due date forward, like Todoist. Unlike Todoist, every completion, skip, rejection or miss is also written to a `chore_histories` table with `performedAt`, `dueDate`, `completedBy`, notes and a status. After the simulation the history held 332 completions, and every fixed-cycle rule had exactly the due dates Todoist would produce: daily, weekdays, Wednesdays, Tuesday/Thursday, every other Monday, first and last Friday, month end (Aug 31, Sep 30), the 15th, monthly, yearly. The rolling rules counted from the completion day each time: done Aug 4 gave Aug 7 for 3 days, Aug 18 for 2 weeks and Sep 4 for a month.

A non-rolling chore advances by exactly one interval per completion, from its previous due date. After skipping the daily chore on two days it took three completions in a row to bring it back to today; each one wrote a history entry for one missed date. Todoist would have jumped straight to the next date. Upstream has this open as [#834](https://github.com/donetick/donetick/issues/834).

Skip writes a "skipped" entry and advances the chore. Undo removes the latest entry and restores the previous due date, so the history doesn't need Reviewist-style complete/uncomplete pairing. Archiving a chore keeps its history; unarchiving brings it back as it was. Deleting a chore deletes its history in the same transaction (`DeleteChore` in `internal/chore/repo/repository.go`), which the probe confirmed: 3 entries before, 0 after.

The Activities page is a cross-chore review view: completions grouped by day with their times, a search box, filters, on-time/late counts, and 7/30/90/all-days ranges. The per-chore history page lists each completion with how early or late it was, and lets you edit or delete entries. Both read the same table as `GET /chores/history?limit=<days>`, which returns entries for every chore with `choreId`, `performedAt`, `dueDate` and status. Entries don't carry the chore name, so a client has to join against `/chores/` (and `/chores/archived` for archived ones). The day range filters on `updated_at`, not `performed_at`, so editing an old entry pulls it into "last 7 days"; all the backdated entries in this test showed up as recent for the same reason.

The home view groups chores into Tomorrow, Next 7 Days and Future, next to a calendar and a recent-activity panel. Order within a group follows the due date; I didn't find manual ordering or drag-to-another-day.

## Bugs found

Not yet reported upstream.

1. Plain `daily`, `weekly`, `monthly` and `yearly` chores drift at every DST change. The scheduler does its arithmetic in the chore's timezone, but the web editor only fills `frequencyMetadata.timezone` for the custom types, so these fall back to UTC (`choreLocation` in `scheduler.go`). A UI-created daily chore was stored with `timezone: ""`. In the simulation, a daily chore due at 08:00 was due at 07:00 after 2026-10-25, and the end-of-day daily chore moved from 23:59 to 22:59. In spring it gets worse: an end-of-day daily chore due 2027-03-27 23:59 came back due 2027-03-29 00:59, so March 28 never had an occurrence and every later one is shown a day late. Upstream closed [#808](https://github.com/donetick/donetick/issues/808) (the same drift) with the timezone-aware scheduler; that fix doesn't reach chores the editor saves without a timezone. [#595](https://github.com/donetick/donetick/issues/595) ("DST") is still open.

## Self-hosting

This was the easiest server of the four. One container, one SQLite file, port 2021, a generated `selfhosted.yaml` with the JWT secret. Password signup works out of the box (it can be disabled), with OIDC and TOTP MFA optional. No SMTP, domain or TLS is required to start, though anything reachable from a phone should sit behind TLS.

The Android app is on [Google Play](https://play.google.com/store/apps/details?id=com.donetick.app) ("Donetick: Home Chore Reminder", 5K+ downloads, updated 2026-10-30). It's a Capacitor build of the same React frontend, the server URL is set on the login screen, and the frontend has an offline edit queue. PostHog analytics are off by default on self-hosted servers unless you opt in (`src/analytics/consent.js`). An iOS build is on TestFlight.

## Getting the data out

The SQLite file holds everything in plain tables. The REST API with a long-lived key covers chores, projects, labels and the cross-chore history, so a Reviewist port would swap the Todoist activity log for `/chores/history` plus `/chores/`. Completions keep their due date as well as the completion time, which the Todoist activity log doesn't give.

## Shortcomings

- The DST bug above, for the simple recurrence types.
- Missed occurrences have to be cleared one at a time (or skipped one at a time).
- Deleting a chore destroys its history; archive instead.
- No uncompletable tasks, dated notes, deadlines or month-floating tasks.
- I found no manual ordering or drag-to-reschedule in the upcoming view, so no Todoist-style "plan tomorrow" workflow (only looked at the web UI briefly).
- No importer from Todoist.
- The household features (circles, assignees, points, approvals) are always there in the UI, even for a single user.
- Every custom-type chore has a time of day; there is no all-day option for those types.

## Verdict at the time

Donetick keeps the completion history Reviewist was built to reconstruct, exposes it through a plain API and a decent Activities page, and is trivial to host. The DST bug is the one that would hurt daily use: plain daily chores get the wrong time for half the year, and end-of-day ones lose a day each spring until upstream fixes the editor or the scheduler fallback. The missing planner workflow and notes are the other costs. The Android app still needs a hands-on look.
