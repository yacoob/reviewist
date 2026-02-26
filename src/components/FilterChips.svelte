<script lang="ts">
  import type { CompletedTask, Project } from '../lib/types';
  import { TODOIST_COLORS } from '../lib/colors';

  interface Props {
    tasks: CompletedTask[];
    projects: Record<string, Project>;
    excludedProjects: string[];
    onToggle: (projectId: string) => void;
  }

  let { tasks, projects, excludedProjects, onToggle }: Props = $props();

  let sortedProjects = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      counts[t.project_id] = (counts[t.project_id] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => {
      const nameA = (projects[a[0]]?.name || '').toLowerCase();
      const nameB = (projects[b[0]]?.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  });

  function chipColor(pid: string): string | null {
    const p = projects[pid];
    return p?.color ? TODOIST_COLORS[p.color] || null : null;
  }

  function chipName(pid: string): string {
    return projects[pid]?.name || pid || '?';
  }
</script>

{#if sortedProjects.length > 0}
  <div class="filters">
    {#each sortedProjects as [pid] (pid)}
      {@const hex = chipColor(pid)}
      {@const active = !excludedProjects.includes(pid)}
      <span
        class="filter-chip"
        class:active
        role="button"
        tabindex="0"
        style={hex ? `--chip-color:${hex}` : ''}
        onclick={() => onToggle(pid)}
        onkeydown={(e) => e.key === 'Enter' && onToggle(pid)}
      >{chipName(pid)}</span>
    {/each}
  </div>
{/if}

<style>
  .filters {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  .filter-chip {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-dim);
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
    opacity: 0.45;
  }
  .filter-chip.active {
    opacity: 1;
    background: color-mix(in srgb, var(--chip-color, var(--text-dim)) 13%, transparent);
    color: var(--chip-color, var(--text-dim));
    border-color: color-mix(in srgb, var(--chip-color, var(--border)) 27%, transparent);
  }
  .filter-chip:not(.active):hover {
    opacity: 0.75;
    background: color-mix(in srgb, var(--chip-color, var(--text-dim)) 7%, transparent);
    color: color-mix(in srgb, var(--chip-color, var(--text-dim)) 53%, transparent);
    border-color: color-mix(in srgb, var(--chip-color, var(--border)) 13%, transparent);
  }

  @media print {
    .filters { display: none; }
  }
</style>
