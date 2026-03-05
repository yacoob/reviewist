import type { ActivityEvent, CompletedTask, Project } from './types';
import { fmtDate } from './dates';
import { fetchProjects, fetchActivityEvents } from './api';
import { reconcile } from './reconcile';
import {
  loadToken, saveToken as persistToken, forgetToken as clearStoredToken,
  loadExcludedProjects, saveExcludedProjects,
  loadRefreshInterval, saveRefreshInterval,
  BLOCKLIST,
} from './storage';
import { loadCachedState, saveCachedState, clearCachedState } from './cache';

const SIX_WEEKS_MS = 42 * 86400000;
const OVERLAP_MS = 3600000; // 1 hour

let token = $state(loadToken());
let refreshInterval = $state(loadRefreshInterval());
let excludedProjects: string[] = $state(loadExcludedProjects());
let allTasks: CompletedTask[] = $state([]);
let projects: Record<string, Project> = $state({});
let lastFetchTime: number | null = $state(null);
let fetching = $state(false);

// Internal event cache — not reactive, used for incremental fetch logic
let cachedEvents: ActivityEvent[] = [];

function newestEventDate(events: ActivityEvent[]): string | null {
  if (events.length === 0) return null;
  return events.at(-1)!.event_date;
}

/** Merge new events into existing, dedup, sort, evict old. */
function mergeEvents(existing: ActivityEvent[], incoming: ActivityEvent[]): ActivityEvent[] {
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

async function doFetch(): Promise<{ error?: string }> {
  const t0 = performance.now();
  const log = (msg: string) => console.log('[store] %s (%.1fms)', msg, performance.now() - t0);

  if (!token) {
    return { error: 'Enter your API token' };
  }

  fetching = true;
  log('fetch start');

  // Load cache on first call (when we have no events in memory)
  if (cachedEvents.length === 0) {
    try {
      const cached = await loadCachedState();
      if (cached) {
        cachedEvents = cached.events;
        projects = cached.projects;
        lastFetchTime = cached.fetchedAt;
        // Reconcile cached events for instant render
        const filtered = cachedEvents.filter(e => !BLOCKLIST.has(e.object_id));
        allTasks = reconcile(filtered);
        log(`cache hit: ${cachedEvents.length} events → ${allTasks.length} tasks, fetched ${new Date(cached.fetchedAt).toLocaleTimeString()}`);
      } else {
        log('cache miss');
      }
    } catch {
      log('cache load error');
    }
  }

  // Determine fetch range
  const newest = newestEventDate(cachedEvents);
  const since = newest
    ? fmtDate(new Date(new Date(newest).getTime() - OVERLAP_MS))
    : fmtDate(new Date(Date.now() - SIX_WEEKS_MS));
  const until = fmtDate(new Date());

  const incremental = !!newest;
  log(`API fetch start (${incremental ? 'incremental' : 'full'}, since=${since})`);

  try {
    const [projMap, newEvents] = await Promise.all([
      fetchProjects(token),
      fetchActivityEvents(token, since, until),
    ]);
    log(`API done: ${Object.keys(projMap).length} projects, ${newEvents.length} events`);

    // Merge and reconcile
    const merged = incremental ? mergeEvents(cachedEvents, newEvents) : newEvents;
    // Sort full-fetch events too (API returns newest-first)
    if (!incremental) {
      merged.sort((a, b) => a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0);
    }
    log(`merged: ${merged.length} events`);

    const filtered = merged.filter(e => !BLOCKLIST.has(e.object_id));
    const newTasks = reconcile(filtered);
    log(`reconciled: ${newTasks.length} tasks`);

    // Update state
    cachedEvents = merged;
    const tasksChanged = JSON.stringify(newTasks) !== JSON.stringify($state.snapshot(allTasks));
    const projChanged = JSON.stringify(projMap) !== JSON.stringify($state.snapshot(projects));
    if (tasksChanged || projChanged) {
      allTasks = newTasks;
      projects = projMap;
      log('state updated');
    } else {
      log('no changes');
    }

    // Save cache
    saveCachedState(cachedEvents, $state.snapshot(projects));
    lastFetchTime = Date.now();
    return {};
  } catch (e) {
    log(`API error: ${(e as Error).message}`);
    if (cachedEvents.length > 0) return {};
    allTasks = [];
    return { error: (e as Error).message };
  } finally {
    fetching = false;
    log('fetch complete');
  }
}

function saveTokenValue() {
  if (token) persistToken(token);
}

function forgetToken() {
  clearStoredToken();
  clearCachedState();
  token = '';
  allTasks = [];
  projects = {};
  cachedEvents = [];
  lastFetchTime = null;
}

function setRefreshInterval(ms: number) {
  refreshInterval = ms;
  saveRefreshInterval(ms);
}

function toggleProject(pid: string) {
  const idx = excludedProjects.indexOf(pid);
  if (idx >= 0) {
    excludedProjects = [...excludedProjects.slice(0, idx), ...excludedProjects.slice(idx + 1)];
  } else {
    excludedProjects = [...excludedProjects, pid];
  }
  saveExcludedProjects(excludedProjects);
}

export const store = {
  get token() { return token; },
  set token(v: string) { token = v; },
  get refreshInterval() { return refreshInterval; },
  get excludedProjects() { return excludedProjects; },
  get allTasks() { return allTasks; },
  get projects() { return projects; },
  get lastFetchTime() { return lastFetchTime; },
  get fetching() { return fetching; },

  fetch: doFetch,
  saveToken: saveTokenValue,
  forgetToken,
  setRefreshInterval,
  toggleProject,
};
