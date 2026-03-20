import type { ActivityEvent, CompletedAction, Project } from './types';
import { fmtDate } from './dates';
import { fetchProjects, fetchActivityEvents } from './api';
import { eventsToActions } from './actions';
import {
  loadToken, saveToken as persistToken, forgetToken as clearStoredToken,
  loadExcludedProjects, saveExcludedProjects,
  loadRefreshInterval, saveRefreshInterval,
  loadDebugEnabled, saveDebugEnabled,
} from './storage';
import { BLOCKLIST, NOTE_PROJECT_NAMES } from './constants';
import { loadCachedState, saveCachedState, clearCachedState } from './cache';

import { newestEventDate, mergeEvents, SIX_WEEKS_MS, OVERLAP_MS } from './events';

let token = $state(loadToken());
let refreshInterval = $state(loadRefreshInterval());
let debugEnabled = $state(loadDebugEnabled());
let excludedProjects: string[] = $state(loadExcludedProjects());
let allActions: CompletedAction[] = $state([]);
let projects: Record<string, Project> = $state({});
let lastFetchTime: number | null = $state(null);
let fetching = $state(false);
let noteProjectIds: Set<string> = $state(new Set());

function computeNoteProjectIds(projs: Record<string, Project>): Set<string> {
  return new Set(
    NOTE_PROJECT_NAMES
      .map(name => Object.entries(projs).find(([, p]) => p.name === name)?.[0])
      .filter((id): id is string => id != null),
  );
}

// Internal event cache — not reactive, used for incremental fetch logic
let cachedEvents: ActivityEvent[] = [];

// Debug log ring buffer (visible in settings panel on mobile)
const DEBUG_LOG_MAX = 50;
let debugLog: string[] = $state([]);

function pushLog(msg: string) {
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const entry = `${ts} ${msg}`;
  console.log(`[store] ${msg}`);
  debugLog = [...debugLog.slice(-(DEBUG_LOG_MAX - 1)), entry];
}

async function doFetch(): Promise<{ error?: string }> {
  const t0 = performance.now();
  let tPrev = t0;
  const log = (msg: string) => {
    const now = performance.now();
    const delta = `+${Math.round(now - tPrev).toString().padStart(4)}ms`;
    tPrev = now;
    pushLog(`${delta}: ${msg}`);
  };

  if (!token) {
    return { error: 'Enter your API token' };
  }

  fetching = true;
  pushLog('refresh started');

  // Load cache on first call (when we have no events in memory)
  if (cachedEvents.length === 0) {
    try {
      const cached = await loadCachedState();
      if (cached) {
        cachedEvents = cached.events;
        projects = cached.projects;
        lastFetchTime = cached.fetchedAt;
        noteProjectIds = computeNoteProjectIds(projects);
        allActions = eventsToActions(cachedEvents, projects, BLOCKLIST, noteProjectIds);
        log(`loaded ${cachedEvents.length} events and ${Object.keys(cached.projects).length} projects from IndexedDB cache (last fetched ${new Date(cached.fetchedAt).toLocaleTimeString()}), reconciled into ${allActions.length} actions`);
      } else {
        log('no IndexedDB cache found');
      }
    } catch {
      log('IndexedDB cache load failed');
    }
  }

  // Determine fetch range
  const newest = newestEventDate(cachedEvents);
  const since = newest
    ? fmtDate(new Date(new Date(newest).getTime() - OVERLAP_MS))
    : fmtDate(new Date(Date.now() - SIX_WEEKS_MS));

  const incremental = !!newest;
  log(`fetching events from API (${incremental ? 'incremental' : 'full'}, since=${since})`);

  try {
    const [projMap, newEvents] = await Promise.all([
      fetchProjects(token),
      fetchActivityEvents(token, since),
    ]);
    log(`API returned ${newEvents.length} events, ${Object.keys(projMap).length} projects`);

    // Merge and reconcile
    const merged = incremental ? mergeEvents(cachedEvents, newEvents) : newEvents;
    // Sort full-fetch events too (API returns newest-first)
    if (!incremental) {
      merged.sort((a, b) => a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0);
    }
    if (incremental) {
      log(`merged ${cachedEvents.length} cached + ${newEvents.length} fetched events into ${merged.length} events (${merged.length - cachedEvents.length} new)`);
    }

    noteProjectIds = computeNoteProjectIds(projMap);
    const newActions = eventsToActions(merged, projMap, BLOCKLIST, noteProjectIds);

    // Update state
    cachedEvents = merged;
    const actionsChanged = JSON.stringify(newActions) !== JSON.stringify($state.snapshot(allActions));
    const projChanged = JSON.stringify(projMap) !== JSON.stringify($state.snapshot(projects));
    if (actionsChanged || projChanged) {
      allActions = newActions;
      projects = projMap;
      log(`reconciled ${merged.length} events into ${newActions.length} actions, action data changed`);
    } else {
      log(`reconciled ${merged.length} events into ${newActions.length} actions, action data unchanged`);
    }

    // Save cache
    saveCachedState(cachedEvents, $state.snapshot(projects));
    log(`saved ${cachedEvents.length} events to IndexedDB cache`);
    lastFetchTime = Date.now();
    return {};
  } catch (e) {
    log(`API request failed: ${(e as Error).message}`);
    if (cachedEvents.length > 0) return {};
    allActions = [];
    return { error: (e as Error).message };
  } finally {
    fetching = false;
    pushLog(`refresh done (${Math.round(performance.now() - t0)}ms)`);
  }
}

function saveTokenValue() {
  if (token) persistToken(token);
}

function forgetToken() {
  clearStoredToken();
  clearCachedState();
  token = '';
  allActions = [];
  projects = {};
  cachedEvents = [];
  lastFetchTime = null;
}

async function purgeCache() {
  await clearCachedState();
  cachedEvents = [];
  allActions = [];
  projects = {};
  lastFetchTime = null;
  pushLog('cache purged');
}

function setRefreshInterval(ms: number) {
  refreshInterval = ms;
  saveRefreshInterval(ms);
}

function setDebugEnabled(on: boolean) {
  debugEnabled = on;
  saveDebugEnabled(on);
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
  get allActions() { return allActions; },
  get projects() { return projects; },
  get lastFetchTime() { return lastFetchTime; },
  get fetching() { return fetching; },
  get noteProjectIds() { return noteProjectIds; },
  get debugEnabled() { return debugEnabled; },
  get debugLog() { return debugLog; },

  fetch: doFetch,
  saveToken: saveTokenValue,
  forgetToken,
  purgeCache,
  setRefreshInterval,
  setDebugEnabled,
  toggleProject,
};
