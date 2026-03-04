import type { CompletedTask, Project } from './types';
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

let token = $state(loadToken());
let refreshInterval = $state(loadRefreshInterval());
let excludedProjects: string[] = $state(loadExcludedProjects());
let allTasks: CompletedTask[] = $state([]);
let projects: Record<string, Project> = $state({});
let lastFetchTime: number | null = $state(null);
let fetching = $state(false);

async function doFetch(): Promise<{ error?: string }> {
  const t0 = performance.now();
  const log = (msg: string) => console.log('[store] %s (%.1fms)', msg, performance.now() - t0);

  if (!token) {
    return { error: 'Enter your API token' };
  }

  const since = fmtDate(new Date(Date.now() - 42 * 86400000));
  const until = fmtDate(new Date());

  fetching = true;
  log('fetch start');

  // Only load cache when state is empty (first load)
  let hadCache = false;
  if (allTasks.length === 0) {
    try {
      const cached = await loadCachedState();
      if (cached) {
        hadCache = true;
        allTasks = cached.tasks;
        projects = cached.projects;
        lastFetchTime = cached.fetchedAt;
        log(`cache hit: ${cached.tasks.length} tasks, fetched ${new Date(cached.fetchedAt).toLocaleTimeString()}`);
      } else {
        log('cache miss');
      }
    } catch {
      log('cache load error');
    }
  }

  try {
    log('API fetch start');
    const [projMap, events] = await Promise.all([
      fetchProjects(token),
      fetchActivityEvents(token, since, until),
    ]);
    log(`API done: ${Object.keys(projMap).length} projects, ${events.length} events`);

    const filtered = events.filter(e => !BLOCKLIST.has(e.object_id));
    const newTasks = reconcile(filtered);
    log(`reconciled: ${newTasks.length} tasks`);

    // Only update state and cache if data actually changed
    const tasksChanged = JSON.stringify(newTasks) !== JSON.stringify($state.snapshot(allTasks));
    const projChanged = JSON.stringify(projMap) !== JSON.stringify($state.snapshot(projects));
    if (tasksChanged || projChanged) {
      allTasks = newTasks;
      projects = projMap;
      saveCachedState($state.snapshot(allTasks), $state.snapshot(projects));
      log('state updated + cache saved');
    } else {
      log('no changes');
    }
    lastFetchTime = Date.now();
    return {};
  } catch (e) {
    log(`API error: ${(e as Error).message}`);
    if (hadCache) return {};
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
