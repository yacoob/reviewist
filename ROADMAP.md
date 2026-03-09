# Roadmap

## open questions and things to implement
- better test coverage (includes dropping old code)
- check if `event_date` is UTC and adjust to the local (?) timezone - otherwise a task completed at 11pm local time may show as the next day.
- better UI, especially on mobile

## possible future improvements
- editable date range - simple would be "allow scrolling back into the past by 6w", more convenient would be "scrolling + arbitrary date range selection". This would definitely require smart decisions about event fetches.
- **export** — copy button that dumps current view as markdown or CSV 
