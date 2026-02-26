<!-- ABOUTME: Groups completed tasks by day, deduplicates recurring completions, and renders TaskItems. -->
<!-- ABOUTME: Shows empty state when no tasks match the current filters. -->

<script lang="ts">
  import type { CompletedTask, DedupedTask, Project } from '../lib/types';
  import { formatDayLabel } from '../lib/dates';
  import { TODOIST_COLORS } from '../lib/colors';
  import TaskItem from './TaskItem.svelte';

  interface ProjectGroup {
    projectId: string;
    hex: string | null;
    unfiled: boolean;
    tasks: DedupedTask[];
  }

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

        // Sub-group by project, sorted alphabetically by project name
        const byProject: Record<string, DedupedTask[]> = {};
        for (const t of deduped) {
          const pid = t.project_id || '';
          (byProject[pid] ??= []).push(t);
        }

        const projectGroups: ProjectGroup[] = Object.entries(byProject)
          .map(([pid, tasks]) => {
            const proj = projects[pid];
            const hex = proj?.color ? TODOIST_COLORS[proj.color] || null : null;
            const unfiled = !proj?.name;
            return { projectId: pid, hex, unfiled, tasks };
          })
          .sort((a, b) => {
            // Unfiled always last
            if (a.unfiled !== b.unfiled) return a.unfiled ? 1 : -1;
            const nameA = (projects[a.projectId]?.name || '').toLowerCase();
            const nameB = (projects[b.projectId]?.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });

        const label = day === 'Unknown' ? 'Unknown date' : formatDayLabel(day);
        const taskCount = deduped.length;
        return { day, label, taskCount, projectGroups };
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
  {#each days as { day, label, taskCount, projectGroups } (day)}
    <div class="day-group">
      <div class="day-header">
        <span>{label}</span>
        <span class="day-count">{taskCount}</span>
      </div>
      {#each projectGroups as group (group.projectId)}
        <div
          class="project-box"
          class:unfiled={group.unfiled}
          style={group.unfiled
            ? 'border-left-color:#DC4C3E;background:#DC4C3E11'
            : group.hex
              ? `border-left-color:${group.hex};background:${group.hex}11`
              : ''}
        >
          {#if group.unfiled}
            <div class="unfiled-header">unfiled</div>
          {/if}
          {#each group.tasks as task (task.id + task.completed_at)}
            <TaskItem {task} />
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
    border-left: 3px solid var(--border);
    padding-left: 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 0 4px 4px 0;
  }
  .unfiled-header {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6rem;
    font-weight: 600;
    color: #DC4C3E;
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
