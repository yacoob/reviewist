import type { ActivityEvent } from './types';

export const SIX_WEEKS_MS = 42 * 86400000;
export const OVERLAP_MS = 3600000; // 1 hour

export function newestEventDate(events: ActivityEvent[]): string | null {
  if (events.length === 0) return null;
  return events.at(-1)!.event_date;
}

/** Merge new events into existing, dedup, sort, evict old. */
export function mergeEvents(existing: ActivityEvent[], incoming: ActivityEvent[]): ActivityEvent[] {
  const seen: Record<string, true> = {};
  const merged: ActivityEvent[] = [];
  for (const e of [...existing, ...incoming]) {
    const key = e.object_id + '|' + e.event_date;
    if (!seen[key]) {
      seen[key] = true;
      merged.push(e);
    }
  }
  merged.sort((a, b) => a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0);
  const cutoff = new Date(Date.now() - SIX_WEEKS_MS).toISOString();
  return merged.filter(e => e.event_date >= cutoff);
}
