<script lang="ts">
  interface Props {
    visible: boolean;
    token: string;
    fetching: boolean;
    refreshInterval: number;
    debugEnabled: boolean;
    onFetch: () => void;
    onForget: () => void;
    onPurgeCache: () => void;
    onRefreshChange: (ms: number) => void;
    onDebugChange: (on: boolean) => void;
  }

  let { visible, token = $bindable(), fetching, refreshInterval, debugEnabled, onFetch, onForget, onPurgeCache, onRefreshChange, onDebugChange }: Props = $props();
</script>

{#if visible}
  <div class="setup">
    <div class="input-group">
      <input
        id="token-input"
        type="password"
        bind:value={token}
        placeholder="Settings → Integrations → Developer"
      />
      <button class="btn-fetch" disabled={fetching} onclick={onFetch}>
        {fetching ? '...' : 'Fetch'}
      </button>
    </div>
    <div class="options-bar">
      <div class="options-left">
        <label class="option" for="refresh-select">
          <span class="option-key">refresh</span>
          <select id="refresh-select" value={refreshInterval} onchange={(e) => onRefreshChange(Number(e.currentTarget.value))}>
            <option value={0}>off</option>
            <option value={60000}>1m</option>
            <option value={300000}>5m</option>
            <option value={900000}>15m</option>
          </select>
        </label>
        <label class="option" for="debug-check">
          <span class="option-key">debug</span>
          <input id="debug-check" type="checkbox" checked={debugEnabled} onchange={(e) => onDebugChange(e.currentTarget.checked)} />
        </label>
      </div>
      <div class="options-right">
        <button class="btn-danger-link" onclick={onPurgeCache}>purge cache</button>
        <button class="btn-danger-link" onclick={onForget}>forget token</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .setup {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  /* Token input with attached Fetch button */
  .input-group {
    display: flex;
  }
  .input-group input {
    flex: 1;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right: none;
    min-width: 0;
  }
  .btn-fetch {
    background: var(--accent);
    color: white;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    white-space: nowrap;
  }
  .btn-fetch:hover { opacity: 0.85; }
  .btn-fetch:focus-visible { outline: 2px solid var(--text-muted); outline-offset: 2px; }
  .btn-fetch:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Options bar — compact row below the input */
  .options-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.1rem;
  }
  .options-left {
    display: flex;
    gap: 1.25rem;
    align-items: center;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
  }
  .option-key {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }
  .option select {
    font-size: 0.65rem;
    padding: 0.2rem 0.35rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--text-dim);
  }
  .option select:focus { border-color: var(--text-dim); }
  .option input[type="checkbox"] { cursor: pointer; }

  /* Destructive text links — right side */
  .options-right {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .btn-danger-link {
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.55rem;
    padding: 0;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.15s;
    letter-spacing: 0.04em;
  }
  .btn-danger-link:hover { opacity: 1; color: var(--text-dim); }
  .btn-danger-link:focus-visible { outline: 2px solid var(--text-muted); outline-offset: 2px; }

  @media (max-width: 600px) {
    .options-bar { flex-wrap: wrap; gap: 0.5rem; }
  }

  @media print {
    .setup { display: none !important; }
  }
</style>
