import { describe, it, expect, vi, afterEach } from 'vitest';
import { fmtDate, fmtLocalDate, fmtLocalTime, formatDayLabel } from '../src/lib/dates';

afterEach(() => {
  vi.useRealTimers();
});

describe('fmtDate', () => {
  it('returns YYYY-MM-DD', () => {
    expect(fmtDate(new Date('2026-03-15T14:30:00Z'))).toBe('2026-03-15');
  });
});

describe('fmtLocalDate', () => {
  it('returns YYYY-MM-DD in local timezone', () => {
    // 2026-03-15T23:30:00Z — in UTC+1 this is Mar 16, in UTC it's Mar 15
    const d = new Date('2026-03-15T23:30:00Z');
    const result = fmtLocalDate(d);
    // Should match local date (varies by TZ, but format is always YYYY-MM-DD)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  });
});

describe('fmtLocalTime', () => {
  it('returns HH:MM in local timezone', () => {
    const iso = '2026-03-15T14:30:00Z';
    const result = fmtLocalTime(iso);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
    // Should match local hours:minutes
    const d = new Date(iso);
    const expected = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    expect(result).toBe(expected);
  });
});

describe('formatDayLabel', () => {
  function freeze(dateStr: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(dateStr + 'T12:00:00'));
  }

  it('labels today', () => {
    freeze('2026-02-20');
    expect(formatDayLabel('2026-02-20')).toContain('Today');
    expect(formatDayLabel('2026-02-20')).toContain('Feb 20');
  });

  it('labels yesterday', () => {
    freeze('2026-02-20');
    expect(formatDayLabel('2026-02-19')).toContain('Yesterday');
    expect(formatDayLabel('2026-02-19')).toContain('Feb 19');
  });

  it('labels other days with weekday', () => {
    freeze('2026-02-20');
    const label = formatDayLabel('2026-02-17');
    expect(label).toContain('Feb 17');
    expect(label).toContain('Tuesday');
    expect(label).not.toContain('Today');
    expect(label).not.toContain('Yesterday');
  });
});
