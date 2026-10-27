# Reviewist vs tududi

Notes from evaluating [tududi](https://github.com/chrisvel/tududi) v1.9.7 (October 2026) as a self-hosted replacement for the Todoist + Reviewist combo. The motivation was self-hosting and data ownership; porting Reviewist to tududi was out of scope. See also [vs-vikunja.md](vs-vikunja.md).

## What was tested

- The REST API against a test instance, plus a read of the backend and frontend source at the v1.9.7 tag.
- Creating each kind of task from the original Todoist requirements: dated, timed, fixed-cycle recurring, completion-based recurring, month/year floating, undated.
- Completing recurring tasks and checking the next due date for every recurrence shape in the real Todoist data.
- Where completions end up: task lists, the Today dashboard, per-task timelines, activity summaries, backup export.
- A full import of the 87 active Todoist tasks via the API (projects, labels, priorities, descriptions, recurrence, times, deadlines), with read-back verification.
- The web UI for projects, Today, the daily planner, Upcoming and the calendar.

## Data model mapping

Most of the Todoist data maps across:

| Todoist | tududi |
|---|---|
| Project | Project (no sections, no colours carried over) |
| Label | Tag |
| Due date / time | `due_date` + `due_time` (HH:mm in profile timezone) |
| Priority p1-p4 | high / medium / low / none |
| Description | `note` |
| `every! N days/weeks/months` | daily/weekly/monthly with `completion_based` |
| Weekly, every weekday, every N weeks, Nth weekday of month | native recurrence types |
| Yearly | no yearly type; monthly with interval 12 works |
| "Last X of month" | `recurrence_week_of_month = 5` (what the UI stores for "Last") |
| Deadline-only "sometime this month" task | `defer_until` = 1st of month, `due_date` = month end, `floating` tag |

Deadlines, uncompletable tasks and dated notes have no equivalent. tududi notes are a separate entity without a date.

## Behaviour observed

Recurring tasks behave like Todoist's: completing one moves the due date forward and keeps a single task row. Each completion is recorded as a task event and a recurring-completion row, so the history exists in the database and in the backup export (gzipped JSON with `task_events`), which is more than Todoist gives you.

Getting that history back out is the problem. `status=done` lists and saved views only see one-off tasks, because recurring tasks never stay in the done state. The only API for events is per task (`/task/:uid/timeline`); `/user/activity-summary` returns counts per day without the tasks. The Today dashboard's "completed today" list includes recurring tasks but is today-only. A Reviewist equivalent would still be needed and would have to read the backup or the SQLite file directly.

`defer_until` hides a task from Today and suggestions only. Project lists and the calendar still show it, which makes the floating-task workaround usable: the task shows up in its project, appears on the calendar on the 1st of its month, stays out of Today until then, and goes overdue after the month ends.

The Upcoming view expands recurring tasks onto every day they occur, unlike Todoist, which shows only the next occurrence. Its "Tomorrow" group matched Todoist's for the imported data.

## Shortcomings

- No month- or year-floating tasks; the defer + due + tag workaround puts them on the month-end day in Upcoming and the calendar.
- No yearly recurrence type.
- No list of completed tasks over a period, so no review of a day or a week.
- Upcoming is fixed at 7 days with no paging, one layout, reordering explicitly disabled, and no drag to another day. Saved views only filter dates up to one month ahead.
- The daily planner is today-only in the UI. The API accepts any date, but the candidate list is always relative to today, and "carry over to tomorrow" exists only behind the AI feature.
- Notes have no date and there are no bullet-journal-style entry types.

## Bugs found

Not yet reported upstream.

1. `recurrence_week_of_month = -1` passes validation but the next date lands about two weeks before the target month. The UI never writes -1, but CalDAV import turns `BYDAY=-1FR` into -1. In the other direction, CalDAV export writes the UI's "Last" as `BYDAY=5FR`, which RFC 5545 defines as the fifth Friday.
2. SQLite foreign keys are never enabled at runtime, so the declared `ON DELETE CASCADE` rules don't fire. Deleting a task leaves its recurring completions and daily-plan entries behind; SQLite then reuses the task id and those rows attach to an unrelated new task. This showed up as phantom "completed today" items and planned tasks after a delete-and-reimport.
3. The calendar ignores `due_time`, so timed tasks are drawn at midnight in the day and week views. Dragging a task in the calendar sends only a date and the backend clears the time.
4. Due times sent inside `due_date` (as an ISO timestamp) are dropped without an error; the API wants a separate `due_time` field.

The code behind bugs 1 (recurrence calculation) and 3 was unchanged on upstream `main` at the time of writing.
