<script lang="ts">
  interface Props {
    lastFetchTime: number | null;
    onToggleSetup: () => void;
  }

  let { lastFetchTime, onToggleSetup }: Props = $props();

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
  <h1>reviewist</h1>
  <div class="header-right">
    {#if indicatorText}
      <span class="refresh-indicator">{indicatorText}</span>
    {/if}
    <button class="btn-icon" onclick={onToggleSetup} title="Settings">⚙</button>
  </div>
</header>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
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
    align-items: center;
  }
  .refresh-indicator {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--text-muted);
  }
  .btn-icon {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 0.85rem;
    padding: 0.3rem 0.5rem;
    border-radius: 5px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .btn-icon:hover { color: var(--text); border-color: var(--text-muted); }

  @media print {
    .header-right { display: none; }
  }
</style>
