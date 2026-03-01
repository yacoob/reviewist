<script lang="ts">
  import { onMount } from 'svelte';
  import type { ActivityEvent, Project, StatusType } from './lib/types';
  import { fmtDate } from './lib/dates';
  import { fetchProjects, fetchActivityEvents } from './lib/api';
  import {
    loadToken, saveToken, forgetToken as forgetStoredToken,
    loadRefreshInterval, saveRefreshInterval,
  } from './lib/storage';
  import { clearCache } from './lib/cache';
  import Header from './components/Header.svelte';
  import SetupPanel from './components/SetupPanel.svelte';
  import StatusMessage from './components/StatusMessage.svelte';

  let allEvents: ActivityEvent[] = $state([]);
  let projects: Record<string, Project> = $state({});
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
      const [projMap, events] = await Promise.all([
        fetchProjects(token),
        fetchActivityEvents(token, since, until),
      ]);

      projects = projMap;
      allEvents = events;
      lastFetchTime = Date.now();
      fromCache = false;
      clearStatus();
    } catch (e) {
      if (!silent) {
        showStatus((e as Error).message, 'error');
        allEvents = [];
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



  // Fetch fresh on mount, or show setup if no token
  onMount(async () => {
    if (!token) {
      setupVisible = true;
      return;
    }
    await doFetch();
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

  {#if !token && allEvents.length === 0}
    <div class="needs-token">
      Paste your API token to get started
      <div class="hint">Settings → Integrations → Developer</div>
    </div>
  {:else if allEvents.length > 0}
    {@const grouped = (() => {
      const byId = new Map<string, ActivityEvent[]>();
      for (const e of allEvents) {
        const group = byId.get(e.object_id) ?? [];
        group.push(e);
        byId.set(e.object_id, group);
      }
      for (const group of byId.values()) {
        group.sort((a, b) => a.event_date.localeCompare(b.event_date));
      }
      return [...byId.entries()].sort((a, b) =>
        a[1][0].event_date.localeCompare(b[1][0].event_date)
      );
    })()}
    <div class="event-dump">
      <h3>{allEvents.length} activity events, {grouped.length} items</h3>
      {#each grouped as [objectId, events] (objectId)}
        <div class="event-group">
          {#each events as event (event.event_type + '|' + event.event_date)}
            <div class="event-item event-{event.event_type}">
              <div class="event-row">
                <span class="event-type">{event.event_type}</span>
                <span class="event-content">{event.extra_data?.content ?? '(no content)'}</span>
                <span class="event-date">{event.event_date}</span>
                <span class="event-project">{projects[event.parent_project_id ?? '']?.name ?? event.parent_project_id ?? '?'}</span>
                <span class="event-id">{event.object_id}</span>
              </div>
              <div class="event-extra">{JSON.stringify(event.extra_data)}</div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 100%;
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
  .event-dump h3 {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }
  .event-group {
    border-bottom: 2px solid var(--text-muted, #666);
    margin-bottom: 0.25rem;
    padding-bottom: 0.25rem;
  }
  .event-item {
    padding: 0.3rem 0.4rem;
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    border-bottom: 1px solid var(--border);
  }
  .event-row {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
  }
  .event-item:hover {
    background: var(--hover, rgba(255, 255, 255, 0.05));
  }
  .event-type {
    min-width: 7em;
    font-weight: 600;
  }
  .event-completed .event-type { color: var(--green, #4caf50); }
  .event-uncompleted .event-type { color: var(--yellow, #ff9800); }
  .event-deleted .event-type { color: var(--red, #f44336); }
  .event-content {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .event-date {
    color: var(--text-muted);
    font-size: 0.65rem;
  }
  .event-project {
    color: var(--text-muted);
    font-size: 0.65rem;
  }
  .event-id {
    color: var(--text-muted);
    font-size: 0.6rem;
    opacity: 0.5;
  }
  .event-extra {
    color: var(--text-muted);
    font-size: 0.6rem;
    opacity: 0.7;
    padding-left: 7.75em;
    word-break: break-all;
  }
</style>
