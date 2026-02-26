import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadToken,
  saveToken,
  forgetToken,
  loadExcludedProjects,
  saveExcludedProjects,
  loadRefreshInterval,
  saveRefreshInterval,
} from './storage';

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
