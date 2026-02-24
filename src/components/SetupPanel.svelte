<!-- ABOUTME: Collapsible settings panel with API token input, date range pickers, and action buttons. -->
<!-- ABOUTME: Handles token entry, date range selection, fetch trigger, and token forget. -->

<script lang="ts">
  interface Props {
    visible: boolean;
    token: string;
    since: string;
    until: string;
    fetching: boolean;
    onFetch: () => void;
    onForget: () => void;
  }

  let { visible, token = $bindable(), since = $bindable(), until = $bindable(), fetching, onFetch, onForget }: Props = $props();
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
        <label for="since-input">From</label>
        <input id="since-input" type="date" bind:value={since} />
      </div>
      <div class="field">
        <label for="until-input">To</label>
        <input id="until-input" type="date" bind:value={until} />
      </div>
      <button class="btn-primary" disabled={fetching} onclick={onFetch}>
        {fetching ? '...' : 'Fetch'}
      </button>
      <button class="btn-secondary btn-small" onclick={onForget} title="Forget saved token">
        Forget
      </button>
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
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary {
    background: var(--surface-3);
    color: var(--text-dim);
    border: 1px solid var(--border);
  }
  .btn-secondary:hover { color: var(--text); border-color: var(--text-muted); }
  .btn-small { font-size: 0.65rem; padding: 0.3rem 0.6rem; }

  @media (max-width: 600px) {
    .setup-row { flex-direction: column; }
    .field.grow { min-width: 100%; }
  }

  @media print {
    .setup { display: none !important; }
  }
</style>
