import type { ActivityEvent, Project } from './types';

const BASE = 'https://api.todoist.com/api/v1';
const PAGE_LIMIT = 100;

async function api(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchProjects(
  token: string,
): Promise<Record<string, Project>> {
  const data = (await api(
    `${BASE}/projects`,
    token,
  )) as { results: { id: string; name: string; color?: string }[] };
  const map: Record<string, Project> = {};
  for (const p of data.results) {
    map[p.id] = { name: p.name, color: p.color || null };
  }
  return map;
}

/**
 * Fetch activity events for completed/uncompleted/deleted items,
 * paging through all results. Returns events in API order (newest first).
 */
export async function fetchActivityEvents(
  token: string,
  since: string,
): Promise<ActivityEvent[]> {
  const allEvents: ActivityEvent[] = [];
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      date_from: since,
      object_event_types: JSON.stringify(['item:completed', 'item:uncompleted']),
      limit: String(PAGE_LIMIT),
    });
    if (cursor) params.set('cursor', cursor);

    const data = (await api(
      `${BASE}/activities?${params}`,
      token,
    )) as { results: ActivityEvent[]; next_cursor?: string };

    allEvents.push(...(data.results ?? []));

    if (!data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return allEvents;
}
