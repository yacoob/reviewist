<script lang="ts">
  interface Props {
    entries: string[];
  }

  let { entries }: Props = $props();
  let visible = $state(true);
</script>

{#if entries.length > 0}
  <div class="debug">
    <button class="debug-toggle" onclick={() => (visible = !visible)}>
      {visible ? '▾' : '▸'} Debug log ({entries.length})
    </button>
    {#if visible}
      <pre class="debug-log">{entries.join('\n')}</pre>
    {/if}
  </div>
{/if}

<style>
  .debug {
    margin-bottom: 1.25rem;
  }
  .debug-toggle {
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    padding: 0;
    cursor: pointer;
  }
  .debug-toggle:hover { color: var(--text-dim); }
  .debug-log {
    margin-top: 0.5rem;
    font-size: 0.65rem;
    line-height: 1.6;
    color: var(--text-dim);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.5rem 0.65rem;
    overflow-x: auto;
    max-height: 16rem;
    overflow-y: auto;
    white-space: pre;
  }

  @media print {
    .debug { display: none !important; }
  }
</style>
