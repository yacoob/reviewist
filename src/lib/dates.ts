/** UTC date as YYYY-MM-DD — use for API parameters only. */
export function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Local date as YYYY-MM-DD — use for display grouping. */
export function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local HH:MM from an ISO 8601 timestamp. */
export function fmtLocalTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** First day of previous month as YYYY-MM-DD (UTC). Used for API date_from default. */
export function startOfPreviousMonth(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return fmtDate(d);
}

/** Extract YYYY-MM from an ISO timestamp, using local timezone (for display grouping). */
export function monthKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Snap a YYYY-MM-DD date string to the 1st of its month. */
export function snapToMonthStart(dateStr: string): string {
  return dateStr.slice(0, 7) + '-01';
}

/** Given YYYY-MM, return { since: first day, until: last day }. */
export function monthRange(ym: string): { since: string; until: string } {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    since: `${ym}-01`,
    until: `${ym}-${String(lastDay).padStart(2, '0')}`,
  };
}

/** ISO 8601 week number for a YYYY-MM-DD date string. Weeks start on Monday. */
export function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00');
  // Nearest Thursday: current date + 4 - current day number (Mon=1..Sun=7)
  const dayOfWeek = d.getDay() || 7; // convert Sun=0 to Sun=7
  const nearestThursday = new Date(d.getTime());
  nearestThursday.setDate(d.getDate() + 4 - dayOfWeek);
  const jan1 = new Date(nearestThursday.getFullYear(), 0, 1);
  return Math.ceil(((nearestThursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
}

/** Static day label: "Feb 20 · Friday". No relative labels. */
export function formatDayLabelStatic(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${month} · ${weekday}`;
}

export function formatDayLabel(dateStr: string): string {
  const now = new Date();
  const today = fmtLocalDate(now);
  const yd = new Date(now);
  yd.setDate(yd.getDate() - 1);
  const yesterday = fmtLocalDate(yd);

  const base = formatDayLabelStatic(dateStr);
  if (dateStr === today) return `${base.split(' · ')[0]} · Today`;
  if (dateStr === yesterday) return `${base.split(' · ')[0]} · Yesterday`;
  return base;
}
