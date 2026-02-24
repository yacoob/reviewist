// ABOUTME: Todoist API client for fetching projects and completed tasks.
// ABOUTME: Tries both parameter naming conventions for the completed tasks endpoint.

import type { CompletedTask, Project } from './types';

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
    'https://api.todoist.com/api/v1/projects',
    token,
  )) as Record<string, unknown>[];
  const list = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown>).results as Record<string, unknown>[]) ??
      data;
  const map: Record<string, Project> = {};
  if (Array.isArray(list)) {
    for (const p of list) {
      map[p.id as string] = {
        name: p.name as string,
        color: (p.color as string) || null,
      };
    }
  }
  return map;
}

export async function fetchCompletedTasks(
  token: string,
  since: string,
  until: string,
): Promise<CompletedTask[]> {
  const sinceISO = new Date(since + 'T00:00:00').toISOString();
  const untilISO = new Date(until + 'T23:59:59').toISOString();

  const urls = [
    `https://api.todoist.com/api/v1/tasks/completed?since=${sinceISO}&until=${untilISO}&limit=200`,
    `https://api.todoist.com/api/v1/tasks/completed?completed_after=${sinceISO}&completed_before=${untilISO}&limit=200`,
  ];

  for (const url of urls) {
    try {
      const data = (await api(url, token)) as Record<string, unknown>;
      const items =
        data.items ?? data.results ?? (Array.isArray(data) ? data : []);
      return items as CompletedTask[];
    } catch {
      // Try next URL pattern
    }
  }

  throw new Error(
    'Completed tasks endpoint failed. Check your token and Pro plan.',
  );
}
