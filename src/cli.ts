import { parseArgs } from 'util';
import { fetchProjects, fetchActivityEvents } from './lib/api';
import { reconcile } from './lib/reconcile';
import { BLOCKLIST, NOTE_PROJECT_NAMES } from './lib/constants';
import { SIX_WEEKS_MS } from './lib/events';
import { fmtDate } from './lib/dates';
import { renderMarkdown } from './lib/markdown';
import type { Project } from './lib/types';

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
    until: { type: 'string' },
    'note-projects': { type: 'string' },
    blocklist: { type: 'string' },
    format: { type: 'string', default: 'json' },
    help: { type: 'boolean', default: false },
  },
});

if (args.help) {
  console.log(`Usage: reviewist-export [options]

Export completed Todoist actions as JSON or markdown.

Options:
  --format <json|markdown>   Output format (default: json)
  --since <YYYY-MM-DD>       Start date (default: 6 weeks ago)
  --until <YYYY-MM-DD>       End date (default: today)
  --note-projects <a,b,...>  Comma-separated note project names
  --blocklist <file>         File with task IDs to exclude (one per line)
  --help                     Show this help

Environment:
  TODOIST_TOKEN              Todoist API token (required)`);
  process.exit(0);
}

// Token
const token = process.env.TODOIST_TOKEN;
if (!token) die('TODOIST_TOKEN environment variable is required');

// Date range
const since = args.since ?? fmtDate(new Date(Date.now() - SIX_WEEKS_MS));
const until = args.until;

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
  fetchActivityEvents(token, since, until),
]);

// Reconcile and filter
const actions = reconcile(events).filter(a => !blocklist.has(a.task_id));

// Determine note project IDs
const noteProjectIds = new Set(
  noteProjectNames
    .map(name => Object.entries(projects).find(([, p]) => p.name === name)?.[0])
    .filter((id): id is string => id != null),
);

const format = args.format ?? 'json';

if (format === 'json') {
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
  process.stdout.write(renderMarkdown(actions, projects, noteProjectIds, { since, until: until ?? fmtDate(new Date()) }));
} else {
  die(`Unknown format "${format}". Available: json, markdown`);
}
