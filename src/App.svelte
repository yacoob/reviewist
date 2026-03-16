<script lang="ts">
  import { onMount } from 'svelte';
  import type { StatusType } from './lib/types';
  import { store } from './lib/store.svelte';
  import Header from './components/Header.svelte';
  import SetupPanel from './components/SetupPanel.svelte';
  import StatusMessage from './components/StatusMessage.svelte';
  import FilterChips from './components/FilterChips.svelte';
  import TaskList from './components/TaskList.svelte';
  import DebugLog from './components/DebugLog.svelte';

  let statusMessage = $state('');
  let statusType: StatusType = $state(null);
  let setupVisible = $state(false);

  let searchOpen = $state(false);
  let searchInput = $state('');
  let searchQuery = $state('');
  let inputEl: HTMLInputElement | undefined = $state();

  function openSearch() {
    searchInput = searchQuery;
    searchOpen = true;
    requestAnimationFrame(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  }

  function closeSearch() {
    searchOpen = false;
  }

  function submitSearch() {
    searchQuery = searchInput;
    searchOpen = false;
  }

  function handleSearchKey(e: KeyboardEvent) {
    if (e.key === 'Escape') closeSearch();
    else if (e.key === 'Enter') submitSearch();
  }

  function handleGlobalKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (searchOpen) {
        closeSearch();
      } else {
        openSearch();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      setupVisible = !setupVisible;
    }
  }

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
    clearStatus();
    const { error } = await store.fetch();
    if (error) {
      showStatus(error, 'error');
    }
    setupVisible = false;
  }

  function handleForget() {
    store.forgetToken();
    showStatus('Token forgotten', 'info');
    setTimeout(clearStatus, 3000);
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
    const { error } = await store.fetch();
    if (error) {
      showStatus(error, 'error');
    }
  });

  // Configurable auto-refresh (0 = off)
  $effect(() => {
    if (!store.token || store.refreshInterval === 0) return;
    const id = setInterval(async () => {
      const { error } = await store.fetch();
      if (error) showStatus(error, 'error');
    }, store.refreshInterval);
    return () => clearInterval(id);
  });
</script>

<svelte:window onkeydown={handleGlobalKey} />

<div class="container">
  <Header lastFetchTime={store.lastFetchTime} fetching={store.fetching} {searchQuery} onToggleSetup={() => setupVisible = !setupVisible} onRefresh={handleFetch} onSearch={openSearch} />
  <SetupPanel
    visible={setupVisible}
    bind:token={store.token}
    fetching={store.fetching}
    refreshInterval={store.refreshInterval}
    debugEnabled={store.debugEnabled}
    onFetch={handleFetch}
    onForget={handleForget}
    onRefreshChange={handleRefreshChange}
    onDebugChange={(on) => store.setDebugEnabled(on)}
  />
  <StatusMessage message={statusMessage} type={statusType} />
  {#if store.debugEnabled}
    <DebugLog entries={store.debugLog} />
  {/if}

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
    <TaskList tasks={store.allTasks} excludedProjects={store.excludedProjects} projects={store.projects} {searchQuery} />
  {/if}
</div>

{#if searchOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="search-overlay" onclick={closeSearch} role="presentation">
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="search-modal" onclick={(e) => e.stopPropagation()}>
      <input
        bind:this={inputEl}
        type="text"
        class="search-input"
        placeholder="filter tasks..."
        bind:value={searchInput}
        onkeydown={handleSearchKey}
      />
      <span class="search-hint">Enter to apply · Esc to cancel</span>
    </div>
  </div>
{/if}

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
  .search-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 20vh;
    z-index: 100;
  }
  .search-modal {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    width: min(480px, 90vw);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .search-input {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 0.75rem 1rem;
    color: var(--text);
    outline: none;
    width: 100%;
  }
  .search-input:focus { border-color: var(--text-dim); }
  .search-hint {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--text-muted);
    text-align: center;
  }
</style>
