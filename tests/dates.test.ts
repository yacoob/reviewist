import { describe, it, expect, vi, afterEach } from 'vitest';
import { fmtDate, fmtLocalDate, fmtLocalTime, formatDayLabel, startOfPreviousMonth, monthKey, snapToMonthStart, monthRange } from '../src/lib/dates';

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

describe('startOfPreviousMonth', () => {
  it('returns first of previous month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'));
    expect(startOfPreviousMonth()).toBe('2026-02-01');
  });

  it('handles January (crosses year boundary)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    expect(startOfPreviousMonth()).toBe('2025-12-01');
  });
});

describe('monthKey', () => {
  it('extracts YYYY-MM from ISO timestamp using local date', () => {
    expect(monthKey('2026-03-15T12:00:00Z')).toBe('2026-03');
  });

  it('extracts from a different month', () => {
    expect(monthKey('2025-11-01T12:00:00Z')).toBe('2025-11');
  });
});

describe('snapToMonthStart', () => {
  it('snaps a mid-month date to the 1st', () => {
    expect(snapToMonthStart('2026-03-15')).toBe('2026-03-01');
  });

  it('is a no-op for the 1st', () => {
    expect(snapToMonthStart('2026-03-01')).toBe('2026-03-01');
  });
});

describe('monthRange', () => {
  it('returns full range for a 31-day month', () => {
    expect(monthRange('2026-03')).toEqual({ since: '2026-03-01', until: '2026-03-31' });
  });

  it('handles February in a non-leap year', () => {
    expect(monthRange('2025-02')).toEqual({ since: '2025-02-01', until: '2025-02-28' });
  });

  it('handles February in a leap year', () => {
    expect(monthRange('2028-02')).toEqual({ since: '2028-02-01', until: '2028-02-29' });
  });

  it('handles 30-day months', () => {
    expect(monthRange('2026-04')).toEqual({ since: '2026-04-01', until: '2026-04-30' });
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
