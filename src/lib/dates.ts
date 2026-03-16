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
