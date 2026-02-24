// ABOUTME: localStorage helpers for persisting user settings.
// ABOUTME: Manages API token and excluded project preferences.

const TOKEN_KEY = 'todoist_review_token';
const EXCLUDED_KEY = 'todoist_review_excluded';

export function loadToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function forgetToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXCLUDED_KEY);
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
