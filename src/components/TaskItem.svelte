<script lang="ts">
  import type { DedupedTask } from '../lib/types';

  interface Props {
    task: DedupedTask;
  }

  let { task }: Props = $props();

  let rawContent = $derived(task.content || task.task_id || '?');
  let isEvent = $derived(rawContent.startsWith('* '));
  let strippedContent = $derived(isEvent ? rawContent.replace(/^\*\s+/, '') : rawContent);
  let inlineLabels = $derived((strippedContent.match(/@\w+/g) || []).map((l: string) => l.slice(1)));
  let plainContent = $derived(strippedContent.replace(/@\w+/g, '').replace(/\s{2,}/g, ' ').trim());

  type ContentPart = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };
  let contentParts: ContentPart[] = $derived((() => {
    const parts: ContentPart[] = [];
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0;
    let m;
    while ((m = re.exec(plainContent)) !== null) {
      if (m.index > last) parts.push({ type: 'text', text: plainContent.slice(last, m.index) });
      parts.push({ type: 'link', text: m[1], href: m[2] });
      last = m.index + m[0].length;
    }
    if (last < plainContent.length) parts.push({ type: 'text', text: plainContent.slice(last) });
    return parts;
  })());

  let labels = $derived([...new Set([...inlineLabels, ...(task.labels || [])])]);
  let latestTime = $derived((task.completed_at || '').split('T')[1]?.slice(0, 5) || '');
  let allTimesFormatted = $derived(
    task.allTimes.map((ts: string) => ts.split('T')[1]?.slice(0, 5) || '?').sort().join(', '),
  );
</script>

<div class="task-item">
  {#if import.meta.env.DEV}
    <span class="task-debug-id">{task.task_id}</span>
  {/if}
  <a
    class="task-time"
    class:has-tooltip={task.count > 1 && !!latestTime}
    title={task.count > 1 ? allTimesFormatted : undefined}
    href="https://app.todoist.com/app/task/{task.task_id}"
    target="_blank">{latestTime}</a>
  <span class="task-check">{isEvent ? '' : '✓'}</span>
  <span class="task-content">{#each contentParts as part}{#if part.type === 'link'}<a class="task-inline-link" href={part.href} target="_blank">{part.text}</a>{:else}{part.text}{/if}{/each}{#if task.count > 1}{' '}<span class="task-count">(×{task.count})</span>{/if}</span>
  <div class="task-meta">
    {#if labels.length}
      <span class="task-labels">
        {#each labels as label (label)}
          <a
            href="https://app.todoist.com/app/label/{encodeURIComponent(label)}"
            target="_blank"
            class="task-label"
>{label}</a>
        {/each}
      </span>
    {/if}
  </div>
</div>

<style>
  .task-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.5rem 0.45rem 0;
    font-size: 0.85rem;
    position: relative;
  }
  .task-debug-id {
    position: absolute;
    right: calc(100% + 2rem);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.5rem;
    color: var(--text-muted);
    opacity: 0.4;
    white-space: nowrap;
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
    color: var(--accent, #4a9eff);
    text-decoration: none;
  }
  :global(.task-inline-link):hover { text-decoration: underline; }
  .task-meta {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-shrink: 0;
  }
  .task-labels { display: inline-flex; gap: 0.25rem; }
  :global(a).task-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    white-space: nowrap;
    text-decoration: none;
    transition: border-color 0.15s;
  }
  :global(a).task-label:hover { border-color: var(--text-dim); }
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
  .task-time:hover { color: var(--text); }
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
    .task-meta { margin-left: 1.35rem; }
  }

  @media print {
    .task-check { color: #333; }
  }
</style>
