/**
 * Tests for IDB error callbacks by patching fake-indexeddb's prototypes.
 * Each test monkey-patches IDBObjectStore/IDBFactory methods to produce
 * requests whose onerror fires, then restores the original after.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Patching IDB prototypes requires untyped access */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB, loadCachedState, saveCachedState, clearCachedState } from '../src/lib/cache';
import type { ActivityEvent, Project } from '../src/lib/types';

function event(objectId: string): ActivityEvent {
  return {
    id: 12345,
    event_date: '2026-02-20T10:00:00.000000Z',
    event_type: 'completed',
    object_id: objectId,
    object_type: 'item',
    parent_project_id: 'proj1',
    parent_item_id: null,
    initiator_id: 'user1',
    extra_data: { content: `Task ${objectId}` },
  };
}

const projects: Record<string, Project> = {
  proj1: { name: 'Work', color: 'blue' },
};

describe('cache IDB error callbacks', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('openDB rejects when the open request errors', async () => {
    const fakeError = new DOMException('open failed');
    const orig = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function () {
      const req: any = { error: fakeError };
      queueMicrotask(() => req.onerror?.());
      return req;
    };
    try {
      await expect(openDB()).rejects.toBe(fakeError);
    } finally {
      IDBFactory.prototype.open = orig;
    }
  });

  it('loadCachedState returns null when store.get request errors', async () => {
    const orig = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function () {
      const req: any = {};
      queueMicrotask(() => req.onerror?.());
      return req;
    };
    try {
      expect(await loadCachedState()).toBeNull();
    } finally {
      IDBObjectStore.prototype.get = orig;
    }
  });

  it('saveCachedState logs error when store.put request errors', async () => {
    const fakeError = new DOMException('put failed');
    const orig = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      const req: any = { error: fakeError };
      queueMicrotask(() => req.onerror?.());
      return req;
    };
    try {
      await saveCachedState([event('a')], projects);
      expect(console.error).toHaveBeenCalledWith('[cache] save failed:', fakeError);
    } finally {
      IDBObjectStore.prototype.put = orig;
    }
  });

  it('saveCachedState logs error when transaction errors', async () => {
    const fakeError = new DOMException('tx failed');
    const origPut = IDBObjectStore.prototype.put;
    const origTx = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: [string | Iterable<string>, IDBTransactionMode?, IDBTransactionOptions?]) {
      const tx = origTx.apply(this, args);
      // Intercept onerror assignment to capture the handler, then fire it
      let handler: (() => void) | null = null;
      Object.defineProperty(tx, 'onerror', {
        set(fn) { handler = fn; },
        get() { return handler; },
        configurable: true,
      });
      Object.defineProperty(tx, 'error', { value: fakeError, configurable: true });
      // Suppress put so it doesn't interfere
      IDBObjectStore.prototype.put = function () {
        return { set onerror(_: any) {} } as any;
      };
      queueMicrotask(() => handler?.());
      return tx;
    };
    try {
      await saveCachedState([event('a')], projects);
      expect(console.error).toHaveBeenCalledWith('[cache] save failed:', fakeError);
    } finally {
      IDBDatabase.prototype.transaction = origTx;
      IDBObjectStore.prototype.put = origPut;
    }
  });

  it('clearCachedState resolves when transaction errors', async () => {
    const origTx = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: [string | Iterable<string>, IDBTransactionMode?, IDBTransactionOptions?]) {
      const tx = origTx.apply(this, args);
      let handler: (() => void) | null = null;
      Object.defineProperty(tx, 'onerror', {
        set(fn) { handler = fn; },
        get() { return handler; },
        configurable: true,
      });
      queueMicrotask(() => handler?.());
      return tx;
    };
    try {
      await clearCachedState();
    } finally {
      IDBDatabase.prototype.transaction = origTx;
    }
  });
});
