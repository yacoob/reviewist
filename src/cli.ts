import { parseArgs } from 'util';
import { fetchProjects, fetchActivityEvents } from './lib/api';
import { eventsToActions } from './lib/actions';
import { BLOCKLIST, NOTE_PROJECT_NAMES } from './lib/constants';
import { fmtDate, startOfPreviousMonth, monthKey, monthRange, snapToMonthStart } from './lib/dates';
import { renderMarkdown } from './lib/markdown';
import { mkdirSync } from 'fs';
import type { CompletedAction, Project } from './lib/types';

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseBlocklistFile(text: string): Set<string> {
  return new Set(text.split('\n').map(s => s.trim()).filter(Boolean));
}

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    since: { type: 'string' },
    'note-projects': { type: 'string' },
    blocklist: { type: 'string' },
    format: { type: 'string' },
    outdir: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

if (args.help) {
  console.log(`Usage: reviewist-export [options]

Export completed Todoist actions as JSON or markdown.

Options:
  --format <json|markdown>   Output format (default: json)
  --since <YYYY-MM-DD>       Start date (default: 1st of previous month)
  --note-projects <a,b,...>  Comma-separated note project names
  --outdir <path>            Write monthly YYYY/YYYY-MM.md files to directory
  --blocklist <file>         File with task IDs to exclude (one per line)
  --help                     Show this help

Environment:
  TODOIST_TOKEN              Todoist API token (required)`);
  process.exit(0);
}

if (args.outdir && args.format === 'json') {
  die('--outdir produces markdown files; --format json is not compatible');
}

// Token
const token = process.env.TODOIST_TOKEN;
if (!token) die('TODOIST_TOKEN environment variable is required');

// Date range
let since = args.since ?? startOfPreviousMonth();

if (args.outdir && args.since) {
  const snapped = snapToMonthStart(args.since);
  if (snapped !== args.since) {
    console.error(`warning: --since snapped from ${args.since} to ${snapped} (--outdir requires full months)`);
    since = snapped;
  }
}

// Note projects
const noteProjectNames: readonly string[] = args['note-projects']
  ? args['note-projects'].split(',').map(s => s.trim())
  : NOTE_PROJECT_NAMES;

// Blocklist: built-in + optional file
let blocklist: ReadonlySet<string> = BLOCKLIST;
if (args.blocklist) {
  const extra = parseBlocklistFile(await Bun.file(args.blocklist).text());
  blocklist = new Set([...BLOCKLIST, ...extra]);
}

// Fetch
const [projects, events] = await Promise.all([
  fetchProjects(token),
  fetchActivityEvents(token, since),
]);

// Determine note project IDs
const noteProjectIds = new Set(
  noteProjectNames
    .map(name => Object.entries(projects).find(([, p]) => p.name === name)?.[0])
    .filter((id): id is string => id != null),
);

// Events → display-ready actions
const actions = eventsToActions(events, projects, blocklist, noteProjectIds);

const format = args.format ?? 'json';

if (args.outdir) {
  const byMonth: Record<string, CompletedAction[]> = {};
  for (const a of actions) {
    if (!a.completed_at) continue;
    const mk = monthKey(a.completed_at);
    (byMonth[mk] ??= []).push(a);
  }

  const months = Object.keys(byMonth).sort();
  for (const mk of months) {
    const range = monthRange(mk);
    const md = renderMarkdown(byMonth[mk], projects, noteProjectIds, range);
    const [year] = mk.split('-');
    const dir = `${args.outdir}/${year}`;
    mkdirSync(dir, { recursive: true });
    await Bun.write(`${dir}/${mk}.md`, md);
    console.error(`wrote ${dir}/${mk}.md (${byMonth[mk].length} actions)`);
  }
} else if (format === 'json') {
  const referencedProjects: Record<string, Project> = {};
  for (const a of actions) {
    if (a.project_id && projects[a.project_id]) {
      referencedProjects[a.project_id] = projects[a.project_id];
    }
  }
  const output = {
    projects: referencedProjects,
    actions: actions.map(a => ({
      ...a,
      is_note: noteProjectIds.has(a.project_id),
    })),
  };
  console.log(JSON.stringify(output, null, 2));
} else if (format === 'markdown') {
  process.stdout.write(renderMarkdown(actions, projects, noteProjectIds, { since, until: fmtDate(new Date()) }));
} else {
  die(`Unknown format "${format}". Available: json, markdown`);
}
