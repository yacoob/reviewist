import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadToken,
  saveToken,
  forgetToken,
  loadExcludedProjects,
  saveExcludedProjects,
  loadRefreshInterval,
  saveRefreshInterval,
  loadDebugEnabled,
  saveDebugEnabled,
  loadTheme,
  saveTheme,
} from '../src/lib/storage';
import { BLOCKLIST } from '../src/lib/constants';

beforeEach(() => {
  localStorage.clear();
});

describe('token', () => {
  it('round-trips save and load', () => {
    saveToken('abc123');
    expect(loadToken()).toBe('abc123');
  });

  it('returns empty string when unset', () => {
    expect(loadToken()).toBe('');
  });

  it('forgetToken clears all storage keys', () => {
    saveToken('abc123');
    saveExcludedProjects(['p1']);
    saveRefreshInterval(60000);
    forgetToken();
    expect(loadToken()).toBe('');
    expect(loadExcludedProjects()).toEqual([]);
    expect(loadRefreshInterval()).toBe(300_000);
  });
});

describe('excluded projects', () => {
  it('round-trips save and load', () => {
    saveExcludedProjects(['p1', 'p2']);
    expect(loadExcludedProjects()).toEqual(['p1', 'p2']);
  });

  it('returns empty array for malformed JSON', () => {
    localStorage.setItem('reviewist_excluded', 'not-json');
    expect(loadExcludedProjects()).toEqual([]);
  });
});

describe('blocklist', () => {
  it('is a non-empty set parsed from blocklist.txt', () => {
    expect(BLOCKLIST).toBeInstanceOf(Set);
    expect(BLOCKLIST.size).toBeGreaterThan(0);
  });

  it('contains only non-empty trimmed strings', () => {
    for (const id of BLOCKLIST) {
      expect(id).toBe(id.trim());
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('contains known blocklisted IDs', () => {
    expect(BLOCKLIST.has('69gqQwRw52w2V2Qg')).toBe(true);
    expect(BLOCKLIST.has('6g5Mrp4hpm786fp5')).toBe(true);
  });

  it('does not contain IDs not in the file', () => {
    expect(BLOCKLIST.has('nonexistent_id')).toBe(false);
  });
});

describe('refresh interval', () => {
  it('round-trips save and load', () => {
    saveRefreshInterval(60000);
    expect(loadRefreshInterval()).toBe(60000);
  });

  it('returns default 300000 when unset', () => {
    expect(loadRefreshInterval()).toBe(300_000);
  });

  it('stores and loads 0 correctly (auto-refresh off)', () => {
    saveRefreshInterval(0);
    expect(loadRefreshInterval()).toBe(0);
  });
});

describe('theme', () => {
  it('returns auto when unset', () => {
    expect(loadTheme()).toBe('auto');
  });

  it('round-trips light', () => {
    saveTheme('light');
    expect(loadTheme()).toBe('light');
  });

  it('round-trips dark', () => {
    saveTheme('dark');
    expect(loadTheme()).toBe('dark');
  });

  it('saving auto removes the key', () => {
    saveTheme('light');
    saveTheme('auto');
    expect(localStorage.getItem('reviewist_theme')).toBeNull();
    expect(loadTheme()).toBe('auto');
  });

  it('ignores unknown stored values', () => {
    localStorage.setItem('reviewist_theme', 'invalid');
    expect(loadTheme()).toBe('auto');
  });
});

describe('debug enabled', () => {
  it('returns false when unset', () => {
    expect(loadDebugEnabled()).toBe(false);
  });

  it('round-trips true', () => {
    saveDebugEnabled(true);
    expect(loadDebugEnabled()).toBe(true);
  });

  it('round-trips false', () => {
    saveDebugEnabled(true);
    saveDebugEnabled(false);
    expect(loadDebugEnabled()).toBe(false);
  });
});
