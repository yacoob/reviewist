<script lang="ts">
  import type { DedupedTask } from '../lib/types';
  import { fmtLocalTime } from '../lib/dates';

  interface Props {
    task: DedupedTask;
    isNote?: boolean;
  }

  let { task, isNote = false }: Props = $props();

  let rawContent = $derived(task.content || task.task_id || '?');
  let strippedContent = $derived(isNote ? rawContent.replace(/^\*\s+/, '') : rawContent);
  type ContentPart = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };
  let contentParts: ContentPart[] = $derived((() => {
    const parts: ContentPart[] = [];
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0;
    let m;
    while ((m = re.exec(strippedContent)) !== null) {
      if (m.index > last) parts.push({ type: 'text', text: strippedContent.slice(last, m.index) });
      parts.push({ type: 'link', text: m[1], href: m[2] });
      last = m.index + m[0].length;
    }
    if (last < strippedContent.length) parts.push({ type: 'text', text: strippedContent.slice(last) });
    return parts;
  })());

  let latestTime = $derived(task.completed_at ? fmtLocalTime(task.completed_at) : '');
  let allTimesFormatted = $derived(
    task.allTimes.map((ts: string) => fmtLocalTime(ts)).sort().join(', '),
  );
</script>

<div class="task-item">
  {#if !isNote}
    <a
      class="task-time"
      class:has-tooltip={task.count > 1 && !!latestTime}
      title={task.count > 1 ? allTimesFormatted : undefined}
      href="https://app.todoist.com/app/task/{task.task_id}"
      target="_blank">{latestTime}</a>
    <span class="task-check">✓</span>
  {/if}
  <span class="task-content">{#each contentParts as part, i (i)}{#if part.type === 'link'}<a class="task-inline-link" href={part.href} target="_blank">{part.text}</a>{:else}{part.text}{/if}{/each}{#if !isNote && task.count > 1}&nbsp;<span class="task-count">(×{task.count})</span>{/if}</span>
</div>

<style>
  .task-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.5rem 0.45rem 0;
    font-size: 0.85rem;
  }
  .task-check {
    color: var(--green);
    font-size: 0.75rem;
    flex-shrink: 0;
  }
  .task-content {
    flex: 1;
    color: var(--text);
  }
  :global(.task-inline-link) {
    color: #7aafff;
    text-decoration: none;
  }
  :global(.task-inline-link):hover { text-decoration: underline; }
  .task-time {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--text-muted);
    text-decoration: none;
    white-space: nowrap;
    width: 2.5em;
    text-align: right;
    flex-shrink: 0;
  }
  .task-time:hover { color: var(--text); text-decoration: underline; }
  .task-time.has-tooltip {
    cursor: help;
    text-decoration: underline dotted var(--text-muted);
  }
  .task-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75em;
    color: var(--text-muted);
  }

  @media (max-width: 600px) {
    .task-item { flex-wrap: wrap; }
  }

  @media print {
    .task-check { color: #333; }
  }
</style>
