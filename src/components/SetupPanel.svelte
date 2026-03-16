<script lang="ts">
  interface Props {
    visible: boolean;
    token: string;
    fetching: boolean;
    refreshInterval: number;
    debugEnabled: boolean;
    onFetch: () => void;
    onForget: () => void;
    onRefreshChange: (ms: number) => void;
    onDebugChange: (on: boolean) => void;
  }

  let { visible, token = $bindable(), fetching, refreshInterval, debugEnabled, onFetch, onForget, onRefreshChange, onDebugChange }: Props = $props();
</script>

{#if visible}
  <div class="setup">
    <div class="setup-row">
      <div class="field grow">
        <label for="token-input">API Token</label>
        <input
          id="token-input"
          type="password"
          bind:value={token}
          placeholder="Settings → Integrations → Developer"
        />
      </div>
      <div class="field">
        <label for="refresh-select">Auto-refresh</label>
        <select id="refresh-select" value={refreshInterval} onchange={(e) => onRefreshChange(Number(e.currentTarget.value))}>
          <option value={0}>Off</option>
          <option value={60000}>1 min</option>
          <option value={300000}>5 min</option>
          <option value={900000}>15 min</option>
        </select>
      </div>
      <button class="btn-primary" disabled={fetching} onclick={onFetch}>
        {fetching ? '...' : 'Fetch'}
      </button>
      <button class="btn-secondary btn-small" onclick={onForget} title="Forget saved token">
        Forget
      </button>
      <label class="debug-check">
        <input type="checkbox" checked={debugEnabled} onchange={(e) => onDebugChange(e.currentTarget.checked)} />
        Debug
      </label>
    </div>
  </div>
{/if}

<style>
  .setup {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
    margin-bottom: 1.25rem;
  }
  .setup-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    flex-wrap: wrap;
  }
  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .field.grow { flex: 1; min-width: 200px; }
  .field label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover { opacity: 0.85; }
  .btn-primary:focus-visible { outline: 2px solid var(--text-muted); outline-offset: 2px; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary {
    background: var(--surface-3);
    color: var(--text-dim);
    border: 1px solid var(--border);
  }
  .btn-secondary:hover { color: var(--text); border-color: var(--text-muted); }
  .btn-secondary:focus-visible { outline: 2px solid var(--text-muted); outline-offset: 2px; }
  .btn-small { font-size: 0.65rem; padding: 0.3rem 0.6rem; }
  .debug-check {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    color: var(--text-muted);
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .debug-check input { cursor: pointer; }

  @media (max-width: 600px) {
    .setup-row { flex-direction: column; }
    .field.grow { min-width: 100%; }
  }

  @media print {
    .setup { display: none !important; }
  }
</style>
