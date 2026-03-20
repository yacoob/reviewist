<script lang="ts">
  import type { DedupedAction } from '../lib/types';
  import { fmtLocalTime } from '../lib/dates';

  interface Props {
    action: DedupedAction;
    isNote?: boolean;
  }

  let { action, isNote = false }: Props = $props();

  let rawContent = $derived(action.content || action.task_id || '?');
  type ContentPart = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };
  let contentParts: ContentPart[] = $derived((() => {
    const parts: ContentPart[] = [];
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0;
    let m;
    while ((m = re.exec(rawContent)) !== null) {
      if (m.index > last) parts.push({ type: 'text', text: rawContent.slice(last, m.index) });
      parts.push({ type: 'link', text: m[1], href: m[2] });
      last = m.index + m[0].length;
    }
    if (last < rawContent.length) parts.push({ type: 'text', text: rawContent.slice(last) });
    return parts;
  })());

  let latestTime = $derived(action.completed_at ? fmtLocalTime(action.completed_at) : '');
  let allTimesFormatted = $derived(
    action.allTimes.map((ts: string) => fmtLocalTime(ts)).sort().join(', '),
  );
</script>

<div class="action-item">
  {#if !isNote}
    <a
      class="action-time"
      class:has-tooltip={action.count > 1 && !!latestTime}
      title={action.count > 1 ? allTimesFormatted : undefined}
      href="https://app.todoist.com/app/task/{action.task_id}"
      target="_blank">{latestTime}</a>
    <span class="action-check">✓</span>
  {/if}
  <span class="action-content">{#each contentParts as part, i (i)}{#if part.type === 'link'}<a class="action-inline-link" href={part.href} target="_blank">{part.text}</a>{:else}{part.text}{/if}{/each}{#if !isNote && action.count > 1}&nbsp;<span class="action-count">(×{action.count})</span>{/if}</span>
</div>

<style>
  .action-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.5rem 0.45rem 0;
    font-size: 0.85rem;
  }
  .action-check {
    color: var(--green);
    font-size: 0.75rem;
    flex-shrink: 0;
  }
  .action-content {
    flex: 1;
    color: var(--text);
  }
  :global(.action-inline-link) {
    color: #7aafff;
    text-decoration: none;
  }
  :global(.action-inline-link):hover { text-decoration: underline; }
  .action-time {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--text-muted);
    text-decoration: none;
    white-space: nowrap;
    width: 2.5em;
    text-align: right;
    flex-shrink: 0;
  }
  .action-time:hover { color: var(--text); text-decoration: underline; }
  .action-time.has-tooltip {
    cursor: help;
    text-decoration: underline dotted var(--text-muted);
  }
  .action-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75em;
    color: var(--text-muted);
  }

  @media (max-width: 600px) {
    .action-item { flex-wrap: wrap; }
  }

  @media print {
    .action-check { color: #333; }
  }
</style>
