<script lang="ts">
  import type { StatusType } from '../lib/types';

  interface Props {
    message: string;
    type: StatusType;
  }

  let { message, type }: Props = $props();
</script>

{#if type}
  <div class="status {type}">{message}</div>
{/if}

<style>
  .status {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    padding: 0.6rem 0.85rem;
    border-radius: 5px;
    margin-bottom: 1.25rem;
  }
  .status.error {
    background: var(--accent-dim);
    color: var(--accent);
    border: 1px solid rgba(228, 67, 50, 0.25);
  }
  .status.info {
    background: var(--green-dim);
    color: var(--green);
    border: 1px solid rgba(76, 175, 80, 0.2);
  }
</style>
