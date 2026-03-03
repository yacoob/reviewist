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

let token = $state(loadToken());
let since = $state(fmtDate(new Date(Date.now() - 42 * 86400000)));
let until = $state(fmtDate(new Date()));
let refreshInterval = $state(loadRefreshInterval());
let excludedProjects: string[] = $state(loadExcludedProjects());
let allTasks: CompletedTask[] = $state([]);
let projects: Record<string, Project> = $state({});
let lastFetchTime: number | null = $state(null);
let fetching = $state(false);

async function doFetch(silent = false): Promise<{ error?: string }> {
  if (!token || !since || !until) {
    return { error: 'Enter your API token' };
  }

  if (!silent) fetching = true;

  try {
    const [projMap, events] = await Promise.all([
      fetchProjects(token),
      fetchActivityEvents(token, since, until),
    ]);

    projects = projMap;
    const filtered = events.filter(e => !BLOCKLIST.has(e.object_id));
    allTasks = reconcile(filtered);
    lastFetchTime = Date.now();
    return {};
  } catch (e) {
    if (!silent) allTasks = [];
    return { error: (e as Error).message };
  } finally {
    fetching = false;
  }
}

function saveTokenValue() {
  if (token) persistToken(token);
}

function forgetToken() {
  clearStoredToken();
  token = '';
  refreshInterval = 0;
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
  get since() { return since; },
  set since(v: string) { since = v; },
  get until() { return until; },
  set until(v: string) { until = v; },
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
