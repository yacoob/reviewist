/**
 * Benchmark for reconcile().
 *
 * Run: pnpm bench
 *
 * Generates event streams modeled on observed usage patterns:
 * - 5 recurring tasks at varied frequencies (~2.67 completions/day)
 * - 6 one-off completions per day (unique task IDs)
 * - occasional complete->uncomplete->re-complete oops cycles
 * - spread across 5 projects
 */

import { reconcile } from '../src/lib/reconcile';
import type { ActivityEvent } from '../src/lib/types';

function makeEvent(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: 1,
    event_date: '2026-02-20T10:00:00Z',
    event_type: 'completed',
    object_id: 'task1',
    object_type: 'item',
    parent_project_id: 'proj1',
    parent_item_id: null,
    initiator_id: 'user1',
    extra_data: { content: 'interview ant #1' },
    ...overrides,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(day: number, hour: number, minute: number): string {
  const month = 1 + Math.floor(day / 28);
  const d = 1 + (day % 28);
  return `2026-${pad2(month)}-${pad2(d)}T${pad2(hour)}:${pad2(minute)}:00Z`;
}

const PROJECTS = ['proj_A', 'proj_B', 'proj_C', 'proj_D', 'proj_E'];

const RECURRING = [
  { id: 'rec_daily_1', content: 'water the cactus', every: 1 },
  { id: 'rec_daily_2', content: 'count pigeons in the park', every: 1 },
  { id: 'rec_3d', content: 'rotate the sofa cushions', every: 3 },
  { id: 'rec_5d', content: 'sharpen pencil #2', every: 5 },
  { id: 'rec_7d', content: 'weekly ant census', every: 7 },
];

/**
 * Build a realistic event stream.
 *
 * Per simulated day:
 * - recurring completions for tasks whose frequency divides the day number
 * - 6 one-off completions with unique task IDs
 * - every 12th day: one oops cycle on a one-off
 *   (complete -> uncomplete -> re-complete = 3 events, net +2 over base)
 *
 * ~8.67 base events/day. To reach N events, overshoots then trims.
 */
function generateRealistic(targetEvents: number): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  let oneOffSeq = 0;
  let day = 0;

  while (events.length < targetEvents + 50) {
    // Recurring completions
    for (let r = 0; r < RECURRING.length; r++) {
      if (day % RECURRING[r].every !== 0) continue;
      events.push(
        makeEvent({
          object_id: RECURRING[r].id,
          event_type: 'completed',
          event_date: isoDate(day, 7 + r, 0),
          parent_project_id: PROJECTS[r % PROJECTS.length],
          extra_data: { content: RECURRING[r].content },
        }),
      );
    }

    // One-off completions
    for (let j = 0; j < 6; j++) {
      oneOffSeq++;
      const taskId = `ant_${oneOffSeq}`;
      const hour = 9 + j * 2;

      events.push(
        makeEvent({
          object_id: taskId,
          event_type: 'completed',
          event_date: isoDate(day, hour, 30),
          parent_project_id: PROJECTS[oneOffSeq % PROJECTS.length],
          extra_data: { content: `interview ant #${oneOffSeq}` },
        }),
      );

      // Oops cycle every 12th day on the 3rd one-off
      if (day % 12 === 0 && j === 2) {
        events.push(
          makeEvent({
            object_id: taskId,
            event_type: 'uncompleted',
            event_date: isoDate(day, hour, 35),
            parent_project_id: PROJECTS[oneOffSeq % PROJECTS.length],
            extra_data: { content: `interview ant #${oneOffSeq}` },
          }),
        );
        events.push(
          makeEvent({
            object_id: taskId,
            event_type: 'completed',
            event_date: isoDate(day, hour, 40),
            parent_project_id: PROJECTS[oneOffSeq % PROJECTS.length],
            extra_data: { content: `interview ant #${oneOffSeq}` },
          }),
        );
      }
    }

    day++;
  }

  events.length = targetEvents;
  return events;
}

/**
 * Worst case: all events share a single object_id with interleaved
 * complete/uncomplete. Pathological for the splice-based inner loop.
 */
function generateWorstCase(targetEvents: number): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (let i = 0; i < targetEvents; i++) {
    const isUncomplete = i % 3 === 2;
    events.push(
      makeEvent({
        object_id: 'the_one_ant',
        event_type: isUncomplete ? 'uncompleted' : 'completed',
        event_date: isoDate(Math.floor(i / 60), Math.floor(i / 60) % 24, i % 60),
        extra_data: { content: 'interview ant #0 (the eternal)' },
      }),
    );
  }
  return events;
}

// --- Run ---

interface Scenario {
  name: string;
  events: ActivityEvent[];
}

const scenarios: Scenario[] = [
  { name: 'Realistic 5k', events: generateRealistic(5000) },
  { name: 'Realistic 10k', events: generateRealistic(10000) },
  { name: 'Worst-case 5k (single task)', events: generateWorstCase(5000) },
];

const WARMUP = 100;
const RUNS = 1000;

console.log(`reconcile() benchmark — ${WARMUP} warmup + ${RUNS} measured runs\n`);

for (const { name, events } of scenarios) {
  const typeCounts = new Map<string, number>();
  const taskIds = new Set<string>();
  for (const e of events) {
    typeCounts.set(e.event_type, (typeCounts.get(e.event_type) ?? 0) + 1);
    taskIds.add(e.object_id);
  }
  const breakdown = [...typeCounts.entries()].map(([k, v]) => `${k}=${v}`).join(', ');

  console.log(`--- ${name} ---`);
  console.log(`  ${events.length} events, ${taskIds.size} unique tasks | ${breakdown}`);

  for (let i = 0; i < WARMUP; i++) reconcile([...events]);

  const times: number[] = [];
  let outputSize = 0;
  for (let i = 0; i < RUNS; i++) {
    const copy = [...events];
    const t0 = performance.now();
    const result = reconcile(copy);
    times.push(performance.now() - t0);
    outputSize = result.length;
  }

  times.sort((a, b) => a - b);
  const fmt = (ms: number) => ms.toFixed(3);
  const pct = (p: number) => times[Math.floor(times.length * p)];

  // Sparkline: bucket sorted times into 20 bins, map counts to block chars
  const bars = '▁▂▃▄▅▆▇█';
  const binCount = 20;
  const lo = times[0];
  const hi = times[times.length - 1];
  const buckets = new Array<number>(binCount).fill(0);
  for (const t of times) {
    const bin = hi === lo ? 0 : Math.min(Math.floor(((t - lo) / (hi - lo)) * binCount), binCount - 1);
    buckets[bin]++;
  }
  const maxBucket = Math.max(...buckets);
  const sparkline = buckets.map(b => bars[Math.round((b / maxBucket) * (bars.length - 1))]).join('');

  console.log(`  -> ${outputSize} surviving completions`);
  console.log(
    `  min ${fmt(times[0])}ms` +
      ` | median ${fmt(pct(0.5))}ms` +
      ` | p95 ${fmt(pct(0.95))}ms` +
      ` | p99 ${fmt(pct(0.99))}ms` +
      ` | max ${fmt(times[times.length - 1])}ms`,
  );
  console.log(`  ${sparkline}\n`);
}
