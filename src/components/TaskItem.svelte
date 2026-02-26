<!-- ABOUTME: Renders a single completed task with check mark, content, labels, project chip, and time. -->
<!-- ABOUTME: Handles dedup count badge and timestamp tooltip for recurring tasks. -->

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
  let content = $derived(strippedContent.replace(/@\w+/g, '').replace(/\s{2,}/g, ' ').trim());
  let labels = $derived([...new Set([...inlineLabels, ...(task.labels || [])])]);
  let latestTime = $derived((task.completed_at || '').split('T')[1]?.slice(0, 5) || '');
  let allTimesFormatted = $derived(
    task.allTimes.map((ts: string) => ts.split('T')[1]?.slice(0, 5) || '?').sort().join(', '),
  );
</script>

<div class="task-item">
  <span
    class="task-time"
    class:has-tooltip={task.count > 1 && !!latestTime}
    title={task.count > 1 ? allTimesFormatted : undefined}>{latestTime}</span>
  <span class="task-check">{isEvent ? '' : '✓'}</span>
  <span class="task-content">{content}</span>
  <div class="task-meta">
    {#if task.count > 1}
      <span class="task-count">×{task.count}</span>
    {/if}
    {#if labels.length}
      <span class="task-labels">
        {#each labels as label (label)}
          <a
            href="https://app.todoist.com/app/label/{encodeURIComponent(label)}"
            target="_blank"
            class="task-label">@{label}</a>
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
    padding: 0.45rem 0;
    font-size: 0.85rem;
  }
  .task-check {
    color: var(--green);
    font-size: 0.75rem;
    flex-shrink: 0;
  }
  .task-content { flex: 1; color: var(--text); }
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
    color: var(--text-muted);
    background: var(--surface-2);
    padding: 0.15rem 0.45rem;
    border-radius: 3px;
    white-space: nowrap;
    text-decoration: none;
  }
  :global(a).task-label:hover { text-decoration: underline; }
  .task-time {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--text-muted);
    white-space: nowrap;
    width: 2.5em;
    text-align: right;
    flex-shrink: 0;
  }
  .task-time.has-tooltip {
    cursor: help;
    text-decoration: underline dotted var(--text-muted);
  }
  .task-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--text-muted);
    background: var(--surface-3);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
  }

  @media (max-width: 600px) {
    .task-item { flex-wrap: wrap; }
    .task-meta { margin-left: 1.35rem; }
  }

  @media print {
    .task-check { color: #333; }
  }
</style>
