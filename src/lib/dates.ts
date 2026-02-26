export function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const today = fmtDate(now);
  const yd = new Date(now);
  yd.setDate(yd.getDate() - 1);
  const yesterday = fmtDate(yd);

  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (dateStr === today) return `${month} · Today`;
  if (dateStr === yesterday) return `${month} · Yesterday`;
  return `${month} · ${weekday}`;
}
