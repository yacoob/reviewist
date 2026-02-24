<!-- ABOUTME: Groups completed tasks by day, deduplicates recurring completions, and renders TaskItems. -->
<!-- ABOUTME: Shows empty state when no tasks match the current filters. -->

<script lang="ts">
  import type { CompletedTask, DedupedTask, Project } from '../lib/types';
  import { formatDayLabel } from '../lib/dates';
  import TaskItem from './TaskItem.svelte';

  interface Props {
    tasks: CompletedTask[];
    excludedProjects: string[];
    projects: Record<string, Project>;
  }

  let { tasks, excludedProjects, projects }: Props = $props();

  let filteredTasks = $derived(
    tasks.filter((t) => !excludedProjects.includes(t.project_id)),
  );

  let days = $derived.by(() => {
    const grouped: Record<string, CompletedTask[]> = {};
    for (const t of filteredTasks) {
      const date = (t.completed_at || '').split('T')[0] || 'Unknown';
      (grouped[date] ??= []).push(t);
    }

    return Object.keys(grouped)
      .sort()
      .reverse()
      .map((day) => {
        const sorted = grouped[day].sort((a, b) =>
          (a.completed_at || '').localeCompare(b.completed_at || ''),
        );

        const deduped: DedupedTask[] = [];
        const seen: Record<string, DedupedTask> = {};
        for (const t of sorted) {
          const key = (t.content || '') + '||' + (t.project_id || '');
          if (seen[key]) {
            seen[key].count++;
            seen[key].allTimes.push(t.completed_at || '');
            if ((t.completed_at || '') > (seen[key].completed_at || '')) {
              seen[key].completed_at = t.completed_at;
            }
          } else {
            const entry: DedupedTask = { ...t, count: 1, allTimes: [t.completed_at || ''] };
            seen[key] = entry;
            deduped.push(entry);
          }
        }

        const label = day === 'Unknown' ? 'Unknown date' : formatDayLabel(day);
        return { day, label, tasks: deduped };
      });
  });
</script>

{#if filteredTasks.length === 0}
  <div class="empty">
    <div class="empty-icon">∅</div>
    {#if tasks.length === 0}
      No completed tasks in this range.
    {:else}
      All projects filtered out.
    {/if}
  </div>
{:else}
  {#each days as { day, label, tasks: dayTasks } (day)}
    <div class="day-group">
      <div class="day-header">
        <span>{label}</span>
        <span class="day-count">{dayTasks.length}</span>
      </div>
      {#each dayTasks as task (task.id + task.completed_at)}
        <TaskItem {task} project={projects[task.project_id]} />
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
  .empty {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted);
    font-size: 0.85rem;
  }
  .empty-icon { font-size: 2rem; margin-bottom: 0.5rem; }
</style>
