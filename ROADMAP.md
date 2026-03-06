# Roadmap

## open questions and things to implement
- how is the merge of new data performed? are we risking a quick redraw of existing cached rows? how does svelte handle that?
- are we actually using something we should no longer be using? like localStorage, etc? fragmented code surviving from previous iterations?
- better test coverage (includes dropping old code)
- check if `event_date` is UTC and adjust to the local (?) timezone - otherwise a task completed at 11pm local time may show as the next day.
- can we get `@labels` for the activity log entries, or are these lost?

## possible future improvements
- editable date range - simple would be "allow scrolling back into the past by 6w", more convenient would be "scrolling + arbitrary date range selection". This would definitely require smart decisions about event fetches.
- **Upcoming deadlines panel** — month-floaters with deadline fields. A weekly review needs "what's coming due" alongside "what got done"
- **Markdown export** — copy button that dumps current view as markdown
- **Offline/PWA** — service worker for offline access to last-fetched data
- **Completion date correction** — would it be possible to have a CLI script to backdate a task's completion timestamp via Sync API batch `item_uncomplete` + `item_complete`?
