import type { CompletedTask, Project } from './types';

interface CachedData {
  tasks: CompletedTask[];
  projects: Record<string, Project>;
  fetchedAt: number;
}

const KEY_PREFIX = 'reviewist_cache_v2_';
const OLD_KEY_PREFIX = 'reviewist_cache_';
const STALE_THRESHOLD = 7 * 86400000; // 7 days

function cacheKey(since: string, until: string): string {
  return `${KEY_PREFIX}${since}|${until}`;
}

export function loadCache(since: string, until: string): CachedData | null {
  try {
    const raw = localStorage.getItem(cacheKey(since, until));
    if (!raw) return null;
    const data = JSON.parse(raw) as CachedData;
    if (Date.now() - data.fetchedAt > STALE_THRESHOLD) {
      localStorage.removeItem(cacheKey(since, until));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function saveCache(since: string, until: string, data: CachedData): void {
  try {
    localStorage.setItem(cacheKey(since, until), JSON.stringify(data));
  } catch {
    // Storage full — silently ignore
  }
}

export function clearCache(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(KEY_PREFIX) || key?.startsWith(OLD_KEY_PREFIX)) toRemove.push(key);
  }
  toRemove.forEach((key) => localStorage.removeItem(key));
}
