# Reviewist vs Vikunja

Notes from evaluating [Vikunja](https://github.com/go-vikunja/vikunja) 2.7.0 (October 2026) as a self-hosted replacement for the Todoist + Reviewist combo. The motivation was self-hosting and data ownership; porting Reviewist to Vikunja was out of scope. See also [vs-tududi.md](vs-tududi.md).

This evaluation was shallower than the tududi one: API probing and source reading only, no data import and no hands-on UI testing.

## What was tested

- The REST API against a self-hosted instance, including the full route list from `/api/v1/docs.json` and the webhook event list.
- Recurring tasks: fixed interval, monthly-on-same-date, and repeat-from-completion, each completed through the API.
- Month-floating tasks modelled with start/end dates, and filter queries over dated and floating tasks.
- Completed-task filters (`done`, `done_at`) for one-off and recurring tasks.
- Source reading: the Upcoming view in the frontend, the filter documentation, and the built-in Todoist migrator.

## Data model mapping

| Todoist | Vikunja |
|---|---|
| Project | Project |
| Label | Label |
| Due date / time | `due_date` |
| `every N days/weeks` | `repeat_after` (a fixed number of seconds) |
| Monthly on the same date | `repeat_mode = 1` |
| `every! N ...` | `repeat_mode = 2` (repeat from completion) |
| Weekday sets, Nth weekday, last X of month, every weekday | no equivalent |
| Deadline-only "sometime this month" task | `start_date`/`end_date` spanning the month (workaround) |

Uncompletable tasks have no equivalent; notes would be ordinary checkable tasks in a dedicated project or with a label. There are no bullet-journal entry types.

## Behaviour observed

Completing a recurring task sets `done` back to false, moves the due date forward and overwrites `done_at`. Nothing else records the completion: comments stay empty and the API has no activity or audit endpoint. A `done_at > now-7d` filter does return recurring tasks, but only with their most recent completion. This is a step back from Todoist, which at least keeps an activity log.

Repeat-from-completion sets the next due time to the completion time plus the interval, so the time of day drifts (a task due at 08:00 came back due at 20:29).

Filters are expressive enough for the views Todoist couldn't do. `end_date >= 2026-11-01 && start_date <= 2026-11-30` finds a month's floating tasks, and an OR of a due-date range and a start/end overlap puts dated and floating tasks for a day in one result. In the UI these would have to be saved filters.

The Upcoming view filters on `due_date` only; a comment in the frontend source says start/end dates aren't covered. Floating tasks therefore never appear there.

`POST /tasks/{id}` replaces the whole task, so a partial update such as `{"done": true}` clears every field not sent, the due date included. Any tooling has to read, modify and write back.

The built-in Todoist migrator brings over "every N units" recurrences and drops all other recurrence rules on purpose. It reads completed tasks from Todoist's completed-tasks endpoint, so it can't bring the recurring completion history across either; the Reviewist markdown export stays the archive.

CalDAV is enabled, so external clients are an option.

## Shortcomings

- No completion history for recurring tasks at all; reviewing a day or a week of completions is impossible without extra software.
- Limited recurrence rules: no weekday sets, no Nth or last weekday of the month, no yearly-on-a-weekday.
- Repeat-from-completion drifts the time of day.
- No month- or year-floating tasks; the start/end-date workaround doesn't show in Upcoming, and overdue floating tasks only surface through a hand-built `done = false && end_date < now` filter.
- No notes or dated non-task entries.
- Partial task updates through the API wipe unsent fields.

## Possible way out (untested)

Vikunja has a `task.updated` webhook. A small receiver that records every completion to storage you control would rebuild the missing history, and would count as real data ownership. It is also a backend to keep running, and any completion that happens while it's down is lost for good. The webhook payload was not tested.

## Verdict at the time

Vikunja covers plain Todoist use with weaker recurrence. It doesn't replace the Todoist + Reviewist combo: Reviewist exists because Todoist's completion history is hard to review, and Vikunja doesn't keep that history in the first place, so the custom tooling would grow instead of going away.
