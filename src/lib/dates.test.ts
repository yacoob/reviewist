import { describe, it, expect, vi, afterEach } from 'vitest';
import { fmtDate, formatDayLabel } from './dates';

afterEach(() => {
  vi.useRealTimers();
});

describe('fmtDate', () => {
  it('returns YYYY-MM-DD', () => {
    expect(fmtDate(new Date('2026-03-15T14:30:00Z'))).toBe('2026-03-15');
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
