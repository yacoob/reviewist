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

export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const today = fmtLocalDate(now);
  const yd = new Date(now);
  yd.setDate(yd.getDate() - 1);
  const yesterday = fmtLocalDate(yd);

  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (dateStr === today) return `${month} · Today`;
  if (dateStr === yesterday) return `${month} · Yesterday`;
  return `${month} · ${weekday}`;
}
