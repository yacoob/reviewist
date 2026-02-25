// ABOUTME: localStorage helpers for persisting user settings.
// ABOUTME: Manages API token and excluded project preferences.

const TOKEN_KEY = 'reviewist_token';
const EXCLUDED_KEY = 'reviewist_excluded';
const REFRESH_KEY = 'reviewist_refresh';

export function loadToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function forgetToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXCLUDED_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function loadExcludedProjects(): string[] {
  try {
    return JSON.parse(localStorage.getItem(EXCLUDED_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveExcludedProjects(excluded: string[]): void {
  localStorage.setItem(EXCLUDED_KEY, JSON.stringify(excluded));
}

export function loadRefreshInterval(): number {
  const val = localStorage.getItem(REFRESH_KEY);
  return val ? Number(val) : 300_000;
}

export function saveRefreshInterval(ms: number): void {
  localStorage.setItem(REFRESH_KEY, String(ms));
}
