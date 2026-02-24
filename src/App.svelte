<!-- ABOUTME: Root component with all shared state, fetch orchestration, and layout. -->
<!-- ABOUTME: Manages auto-refresh, project exclusion, and composes all child components. -->

<script lang="ts">
  import type { CompletedTask, Project, StatusType } from './lib/types';
  import { fmtDate } from './lib/dates';
  import { fetchProjects, fetchCompletedTasks } from './lib/api';
  import {
    loadToken, saveToken, forgetToken as forgetStoredToken,
    loadExcludedProjects, saveExcludedProjects,
  } from './lib/storage';
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
      const [projMap, items] = await Promise.all([
        fetchProjects(token),
        fetchCompletedTasks(token, since, until),
      ]);

      projects = { ...projects, ...projMap };
      allTasks = items;
      lastFetchTime = Date.now();
      clearStatus();
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
    token = '';
    showStatus('Token forgotten', 'info');
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

  // Auto-fetch on load if token present, otherwise show setup
  $effect(() => {
    if (token) {
      doFetch();
    } else {
      setupVisible = true;
    }
  });

  // Auto-refresh every 60 seconds
  $effect(() => {
    if (!token) return;
    const id = setInterval(() => doFetch(true), 60000);
    return () => clearInterval(id);
  });
</script>

<div class="container">
  <Header {lastFetchTime} onToggleSetup={() => (setupVisible = !setupVisible)} />
  <SetupPanel
    visible={setupVisible}
    bind:token
    bind:since
    bind:until
    {fetching}
    onFetch={handleFetch}
    onForget={handleForget}
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
