<script lang="ts">
  import { onMount } from 'svelte';
  import type { StatusType } from './lib/types';
  import { store } from './lib/store.svelte';
  import Header from './components/Header.svelte';
  import SetupPanel from './components/SetupPanel.svelte';
  import StatusMessage from './components/StatusMessage.svelte';
  import FilterChips from './components/FilterChips.svelte';
  import TaskList from './components/TaskList.svelte';

  let statusMessage = $state('');
  let statusType: StatusType = $state(null);
  let setupVisible = $state(false);

  function showStatus(msg: string, type: StatusType) {
    statusMessage = msg;
    statusType = type;
  }

  function clearStatus() {
    statusMessage = '';
    statusType = null;
  }

  async function handleFetch() {
    store.saveToken();
    showStatus('Fetching...', 'loading');
    const { error } = await store.fetch();
    if (error) {
      showStatus(error, 'error');
    } else {
      clearStatus();
    }
    setupVisible = false;
  }

  function handleForget() {
    store.forgetToken();
    showStatus('Token forgotten', 'info');
  }

  function handleRefreshChange(ms: number) {
    store.setRefreshInterval(ms);
  }

  function handleToggleProject(pid: string) {
    store.toggleProject(pid);
  }

  onMount(async () => {
    if (!store.token) {
      setupVisible = true;
      return;
    }
    showStatus('Fetching...', 'loading');
    const { error } = await store.fetch();
    if (error) {
      showStatus(error, 'error');
    } else {
      clearStatus();
    }
  });

  // Configurable auto-refresh (0 = off)
  $effect(() => {
    if (!store.token || store.refreshInterval === 0) return;
    const id = setInterval(async () => {
      const { error } = await store.fetch(true);
      if (error) showStatus(error, 'error');
    }, store.refreshInterval);
    return () => clearInterval(id);
  });
</script>

<div class="container">
  <Header lastFetchTime={store.lastFetchTime} onToggleSetup={() => (setupVisible = !setupVisible)} />
  <SetupPanel
    visible={setupVisible}
    bind:token={store.token}
    bind:since={store.since}
    bind:until={store.until}
    fetching={store.fetching}
    refreshInterval={store.refreshInterval}
    onFetch={handleFetch}
    onForget={handleForget}
    onRefreshChange={handleRefreshChange}
  />
  <StatusMessage message={statusMessage} type={statusType} />

  {#if !store.token && store.allTasks.length === 0}
    <div class="needs-token">
      Paste your API token to get started
      <div class="hint">Settings → Integrations → Developer</div>
    </div>
  {:else}
    <FilterChips
      tasks={store.allTasks}
      projects={store.projects}
      excludedProjects={store.excludedProjects}
      onToggle={handleToggleProject}
    />
    <TaskList tasks={store.allTasks} excludedProjects={store.excludedProjects} projects={store.projects} />
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
