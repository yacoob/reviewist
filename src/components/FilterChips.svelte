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

  function chipStyle(pid: string): string {
    const p = projects[pid];
    const hex = p?.color ? TODOIST_COLORS[p.color] || null : null;
    const on = !excludedProjects.includes(pid);

    if (on && hex) {
      return `background:${hex}22;color:${hex};border-color:${hex}44`;
    }
    if (!on) {
      return 'opacity:0.45';
    }
    return '';
  }

  function chipName(pid: string): string {
    return projects[pid]?.name || pid || '?';
  }

  function handleHover(e: MouseEvent, pid: string, entering: boolean) {
    const on = !excludedProjects.includes(pid);
    if (on) return;
    const p = projects[pid];
    const hex = p?.color ? TODOIST_COLORS[p.color] || null : null;
    if (!hex) return;
    const el = e.currentTarget as HTMLElement;
    if (entering) {
      el.style.opacity = '0.75';
      el.style.background = `${hex}11`;
      el.style.color = `${hex}88`;
      el.style.borderColor = `${hex}22`;
    } else {
      el.style.opacity = '0.45';
      el.style.background = '';
      el.style.color = '';
      el.style.borderColor = '';
    }
  }
</script>

{#if sortedProjects.length > 0}
  <div class="filters">
    {#each sortedProjects as [pid] (pid)}
      <span
        class="filter-chip"
        role="button"
        tabindex="0"
        style={chipStyle(pid)}
        onmouseenter={(e) => handleHover(e, pid, true)}
        onmouseleave={(e) => handleHover(e, pid, false)}
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
  }

  @media print {
    .filters { display: none; }
  }
</style>
