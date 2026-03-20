<script lang="ts">
  import type { CompletedAction, Project } from '../lib/types';
  import { groupActionsByDay } from '../lib/actions';
  import ActionItem from './ActionItem.svelte';
  import { fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { prefersReducedMotion } from 'svelte/motion';

  interface Props {
    actions: CompletedAction[];
    excludedProjects: string[];
    projects: Record<string, Project>;
    noteProjectIds: Set<string>;
    searchQuery?: string;
  }

  let { actions, excludedProjects, projects, noteProjectIds, searchQuery = '' }: Props = $props();

  let searchRegex = $derived.by(() => {
    if (!searchQuery) return null;
    try {
      const flags = searchQuery === searchQuery.toLowerCase() ? 'i' : '';
      return new RegExp(searchQuery, flags);
    } catch {
      return null;
    }
  });

  let filteredActions = $derived(
    actions.filter((t) => {
      if (excludedProjects.includes(t.project_id)) return false;
      if (searchRegex) return searchRegex.test(t.content);
      return true;
    }),
  );

  let days = $derived(groupActionsByDay(filteredActions, projects, noteProjectIds));

  function d(ms: number) { return prefersReducedMotion.current ? 0 : ms; }
</script>

{#if filteredActions.length === 0}
  <div class="empty">
    <div class="empty-icon">∅</div>
    {#if actions.length === 0}
      No completed actions in this range.
    {:else}
      All projects filtered out.
    {/if}
  </div>
{:else}
  {#each days as { day, label, actionCount, projectGroups } (day)}
    <div class="day-group">
      <div class="day-header">
        <span>{label}</span>
        <span class="day-count">{actionCount}</span>
      </div>
      {#each projectGroups as group (group.projectId)}
        <div
          class="project-box"
          style={group.hex ? `--box-color:${group.hex}` : ''}
          in:fade={{ duration: d(150) }}
          out:fade={{ duration: d(100) }}
        >
          {#if group.unfiled}
            <div class="unfiled-header">unfiled</div>
          {/if}
          {#each group.actions as action (action.id)}
            <div
              in:fade={{ duration: d(150) }}
              out:fade={{ duration: d(100) }}
              animate:flip={{ duration: d(200) }}
            >
              <ActionItem {action} isNote={noteProjectIds.has(group.projectId)} />
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/each}
{/if}

<style>
  .day-group { margin-bottom: 1.75rem; }
  .day-header {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-dim);
    padding-bottom: 0.5rem;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .day-count {
    font-weight: 400;
    color: var(--text-muted);
    font-size: 0.65rem;
  }
  .project-box {
    border-left: 3px solid var(--box-color, var(--border));
    background: color-mix(in srgb, var(--box-color, transparent) 10%, transparent);
    padding-left: 0.75rem;
    border-radius: 0 4px 4px 0;
  }
  .unfiled-header {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--box-color);
    padding-top: 0.25rem;
    padding-bottom: 0.15rem;
  }
  .empty {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted);
    font-size: 0.85rem;
  }
  .empty-icon { font-size: 2rem; margin-bottom: 0.5rem; }
</style>
