<script lang="ts">
  import { fmtDate } from '../lib/dates';

  interface Props {
    lastFetchTime: number | null;
    fetching: boolean;
    searchQuery: string;
    onToggleSetup: () => void;
    onRefresh: () => void;
    onSearch: () => void;
  }

  let { lastFetchTime, fetching, searchQuery, onToggleSetup, onRefresh, onSearch }: Props = $props();

  const since = $derived(fmtDate(new Date(Date.now() - 42 * 86400000)));

  let indicatorText = $state('');

  function updateIndicator() {
    if (!lastFetchTime) {
      indicatorText = '';
      return;
    }
    const s = Math.round((Date.now() - lastFetchTime) / 1000);
    let text: string;
    if (s < 5) text = 'just now';
    else if (s < 60) text = `${s}s ago`;
    else text = `${Math.floor(s / 60)}m ago`;
    indicatorText = text;
  }

  $effect(() => {
    // Re-read lastFetchTime to establish dependency
    void lastFetchTime;
    updateIndicator();
    const id = setInterval(updateIndicator, 10000);
    return () => clearInterval(id);
  });
</script>

<header>
  <div class="header-left">
    <h1>reviewist //</h1>
    <span class="date-range">since {since}{#if searchQuery}&nbsp;| rg -S "{searchQuery}"{/if}</span>
  </div>
  <div class="header-right">
    {#if fetching}
      <span class="fetch-spinner" title="Fetching..."></span>
    {/if}
    {#if indicatorText}
      <button class="refresh-indicator" onclick={onRefresh} disabled={fetching} title="Click to refresh">{indicatorText}</button>
    {/if}
    <button class="btn-bare" onclick={onSearch} title="Filter tasks (Ctrl+K)">⌕</button>
    <button class="btn-bare" onclick={onToggleSetup} title="Settings">⚙</button>
  </div>
</header>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1.25rem;
  }
  h1 {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text);
  }
  .header-right {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
  }
  .fetch-spinner {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border: 2px solid var(--border);
    border-top-color: var(--text-muted);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    vertical-align: middle;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .refresh-indicator {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
  }
  .refresh-indicator:hover { color: var(--text); }
  .refresh-indicator:disabled { cursor: default; }
  .header-left {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }
  .date-range {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .btn-bare {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 0.85rem;
    padding: 0;
    cursor: pointer;
    transition: color 0.15s;
    vertical-align: baseline;
  }
  .btn-bare:hover { color: var(--text); }

  @media print {
    .header-right { display: none; }
  }
</style>
