<!-- ABOUTME: Root component with all shared state, fetch orchestration, and layout. -->
<!-- ABOUTME: Manages auto-refresh, project exclusion, and composes all child components. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import type { CompletedTask, Project, StatusType } from './lib/types';
  import { fmtDate } from './lib/dates';
  import { fetchProjects, fetchCompletedTasks, fetchEventTasks } from './lib/api';
  import {
    loadToken, saveToken, forgetToken as forgetStoredToken,
    loadExcludedProjects, saveExcludedProjects,
    loadRefreshInterval, saveRefreshInterval,
  } from './lib/storage';
  import { loadCache, saveCache, clearCache } from './lib/cache';
  import Header from './components/Header.svelte';
  import SetupPanel from './components/SetupPanel.svelte';
  import StatusMessage from './components/StatusMessage.svelte';
  import FilterChips from './components/FilterChips.svelte';
  import TaskList from './components/TaskList.svelte';

  let allTasks: CompletedTask[] = $state([]);
  let projects: Record<string, Project> = $state({});
  let excludedProjects: string[] = $state(loadExcludedProjects());
  let lastFetchTime: number | null = $state(null);
  let statusMessage = $state('');
  let statusType: StatusType = $state(null);
  let setupVisible = $state(false);
  let fetching = $state(false);
  let fromCache = $state(false);
  let refreshInterval = $state(loadRefreshInterval());

  let token = $state(loadToken());
  let since = $state(fmtDate(new Date(Date.now() - 42 * 86400000)));
  let until = $state(fmtDate(new Date()));

  function showStatus(msg: string, type: StatusType) {
    statusMessage = msg;
    statusType = type;
  }

  function clearStatus() {
    statusMessage = '';
    statusType = null;
  }

  async function doFetch(silent = false) {
    if (!token || !since || !until) {
      if (!silent) showStatus('Enter your API token', 'error');
      return;
    }

    if (!silent) {
      fetching = true;
      showStatus('Fetching...', 'loading');
    }

    try {
      const [projMap, items, eventItems] = await Promise.all([
        fetchProjects(token),
        fetchCompletedTasks(token, since, until),
        fetchEventTasks(token, since, until),
      ]);

      projects = { ...projects, ...projMap };
      allTasks = [...items, ...eventItems];
      lastFetchTime = Date.now();
      fromCache = false;
      clearStatus();
      saveCache(since, until, { tasks: [...items, ...eventItems], projects: projMap, fetchedAt: lastFetchTime });
    } catch (e) {
      if (!silent) {
        showStatus((e as Error).message, 'error');
        allTasks = [];
      }
    } finally {
      fetching = false;
    }
  }

  function handleFetch() {
    if (token) {
      saveToken(token);
    }
    doFetch();
    setupVisible = false;
  }

  function handleForget() {
    forgetStoredToken();
    clearCache();
    token = '';
    refreshInterval = 0;
    showStatus('Token forgotten', 'info');
  }

  function handleRefreshChange(ms: number) {
    refreshInterval = ms;
    saveRefreshInterval(ms);
  }

  function handleToggleProject(pid: string) {
    const idx = excludedProjects.indexOf(pid);
    if (idx >= 0) {
      excludedProjects = [...excludedProjects.slice(0, idx), ...excludedProjects.slice(idx + 1)];
    } else {
      excludedProjects = [...excludedProjects, pid];
    }
    saveExcludedProjects(excludedProjects);
  }

  // Load cached data then fetch fresh on mount, or show setup if no token
  onMount(async () => {
    if (!token) {
      setupVisible = true;
      return;
    }
    const cached = await loadCache(since, until);
    if (cached) {
      allTasks = cached.tasks;
      projects = cached.projects;
      lastFetchTime = cached.fetchedAt;
      fromCache = true;
    }
    await doFetch(cached != null);
  });

  // Configurable auto-refresh (0 = off)
  $effect(() => {
    if (!token || refreshInterval === 0) return;
    const id = setInterval(() => doFetch(true), refreshInterval);
    return () => clearInterval(id);
  });
</script>

<div class="container">
  <Header {lastFetchTime} {fromCache} onToggleSetup={() => (setupVisible = !setupVisible)} />
  <SetupPanel
    visible={setupVisible}
    bind:token
    bind:since
    bind:until
    {fetching}
    {refreshInterval}
    onFetch={handleFetch}
    onForget={handleForget}
    onRefreshChange={handleRefreshChange}
  />
  <StatusMessage message={statusMessage} type={statusType} />

  {#if !token && allTasks.length === 0}
    <div class="needs-token">
      Paste your API token to get started
      <div class="hint">Settings → Integrations → Developer</div>
    </div>
  {:else}
    <FilterChips
      tasks={allTasks}
      {projects}
      {excludedProjects}
      onToggle={handleToggleProject}
    />
    <TaskList tasks={allTasks} {excludedProjects} {projects} />
  {/if}
</div>

<style>
  .container {
    max-width: 740px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }
  .needs-token {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted);
    font-size: 0.85rem;
  }
  .needs-token .hint {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    margin-top: 0.5rem;
  }
</style>
