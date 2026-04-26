<script lang="ts">
  import type { DedupedAction } from '../lib/types';
  import { fmtLocalTime } from '../lib/dates';

  interface Props {
    action: DedupedAction;
    isNote?: boolean;
  }

  let { action, isNote = false }: Props = $props();

  let rawContent = $derived(action.content || action.task_id || '?');

  // Split leading emoji from note content for gutter alignment
  let noteEmoji = $derived.by(() => {
    if (!isNote) return '';
    const m = rawContent.match(/^(\p{Extended_Pictographic}[\uFE0F\u200D]*(?:\p{Extended_Pictographic}[\uFE0F\u200D]*)*)\s*/u);
    return m ? m[1] : '';
  });
  let displayContent = $derived(isNote && noteEmoji ? rawContent.slice(noteEmoji.length).trimStart() : rawContent);

  type ContentPart = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };
  let contentParts: ContentPart[] = $derived((() => {
    const parts: ContentPart[] = [];
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0;
    let m;
    while ((m = re.exec(displayContent)) !== null) {
      if (m.index > last) parts.push({ type: 'text', text: displayContent.slice(last, m.index) });
      parts.push({ type: 'link', text: m[1], href: m[2] });
      last = m.index + m[0].length;
    }
    if (last < displayContent.length) parts.push({ type: 'text', text: displayContent.slice(last) });
    return parts;
  })());

  let latestTime = $derived(action.completed_at ? fmtLocalTime(action.completed_at) : '');
  let allTimesFormatted = $derived(
    action.allTimes.map((ts: string) => fmtLocalTime(ts)).sort().join(', '),
  );

  let expanded = $state(false);
</script>

<div class="action-item" class:is-note={isNote}>
  <div class="gutter">
    {#if isNote}
      <span class="note-emoji">{noteEmoji}</span>
    {:else}
      <span class="action-check">✓</span>
    {/if}
  </div>
  <span class="action-content">{#each contentParts as part, i (i)}{#if part.type === 'link'}<a class="action-inline-link" href={part.href} target="_blank">{part.text}</a>{:else}{part.text}{/if}{/each}{#if !isNote && action.count > 1}&nbsp;<span class="action-count">(×{action.count})</span>{/if}</span>
  {#if action.description}
    <button class="description-toggle" onclick={() => expanded = !expanded} aria-expanded={expanded}>{expanded ? '[−]' : '[+]'}</button>
  {/if}
  {#if !isNote}
    <a
      class="action-time"
      class:has-tooltip={action.count > 1 && !!latestTime}
      title={action.count > 1 ? allTimesFormatted : undefined}
      href="https://app.todoist.com/app/task/{action.task_id}"
      target="_blank">{latestTime}</a>
  {/if}
</div>
{#if action.description && expanded}
  <div class="action-description">{action.description}</div>
{/if}

<style>
  .action-item {
    display: flex;
    align-items: baseline;
    padding: 0.45rem 0.5rem 0.45rem 0;
    font-size: 0.85rem;
  }
  .gutter {
    display: flex;
    align-items: baseline;
    width: 1.5rem;
    flex-shrink: 0;
    justify-content: center;
    margin-right: 0.5rem;
  }
  .note-emoji {
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
    flex-shrink: 0;
    margin-left: 0.6rem;
  }
  .action-time:hover { color: var(--text); text-decoration: underline; }
  .action-time.has-tooltip {
    cursor: help;
  }
  .action-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75em;
    color: var(--text-muted);
  }
  .description-toggle {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    color: var(--text-muted);
    line-height: 1;
    flex-shrink: 0;
    margin-left: 0.6rem;
  }
  .description-toggle:hover { color: var(--text); }
  .action-description {
    padding: 0.2rem 0 0.3rem 2rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    white-space: pre-wrap;
  }

  @media (max-width: 600px) {
    .action-item { flex-wrap: wrap; }
  }

  @media print {
    .action-check { color: #333; }
  }
</style>
