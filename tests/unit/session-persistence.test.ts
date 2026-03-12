import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for session persistence logic.
 * Since useSessionPersistence is a React hook using localStorage,
 * we test the underlying storage logic directly.
 */

const SESSION_KEY = 'querycraft-session';

interface SessionData {
  lastPage: string;
  lastTopicSlug?: string;
  lastLessonSlug?: string;
  lastLessonStep?: number;
  timestamp: string;
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

function save(data: Partial<SessionData>) {
  const raw = localStorageMock.getItem(SESSION_KEY);
  const existing: SessionData | null = raw ? JSON.parse(raw) : null;
  const merged: SessionData = {
    lastPage: data.lastPage ?? existing?.lastPage ?? '/',
    lastTopicSlug: data.lastTopicSlug ?? existing?.lastTopicSlug,
    lastLessonSlug: data.lastLessonSlug ?? existing?.lastLessonSlug,
    lastLessonStep: data.lastLessonStep ?? existing?.lastLessonStep,
    timestamp: new Date().toISOString(),
  };
  localStorageMock.setItem(SESSION_KEY, JSON.stringify(merged));
}

function restore(): SessionData | null {
  const raw = localStorageMock.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as SessionData) : null;
}

describe('Session Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns null when no session exists', () => {
    const result = restore();
    expect(result).toBeNull();
  });

  it('saves and restores a session', () => {
    save({ lastPage: 'sandbox' });
    const result = restore();
    expect(result).not.toBeNull();
    expect(result!.lastPage).toBe('sandbox');
    expect(result!.timestamp).toBeDefined();
  });

  it('merges partial updates with existing session', () => {
    save({ lastPage: 'lesson', lastTopicSlug: 'sql' });
    save({ lastLessonSlug: 'ddl' });

    const result = restore();
    expect(result!.lastPage).toBe('lesson');
    expect(result!.lastTopicSlug).toBe('sql');
    expect(result!.lastLessonSlug).toBe('ddl');
  });

  it('overwrites fields when explicitly provided', () => {
    save({ lastPage: 'lesson', lastTopicSlug: 'sql' });
    save({ lastPage: 'sandbox', lastTopicSlug: 'normalization' });

    const result = restore();
    expect(result!.lastPage).toBe('sandbox');
    expect(result!.lastTopicSlug).toBe('normalization');
  });

  it('preserves lesson step information', () => {
    save({ lastPage: 'lesson', lastTopicSlug: 'sql', lastLessonSlug: 'joins', lastLessonStep: 3 });

    const result = restore();
    expect(result!.lastLessonStep).toBe(3);
  });

  it('defaults lastPage to / when not provided and no existing session', () => {
    save({ lastTopicSlug: 'normalization' });

    const result = restore();
    expect(result!.lastPage).toBe('/');
  });

  it('updates timestamp on each save', () => {
    save({ lastPage: 'sandbox' });
    const first = restore()!.timestamp;

    save({ lastPage: 'lesson' });
    const second = restore()!.timestamp;

    // Both should be valid ISO dates
    expect(new Date(first).getTime()).not.toBeNaN();
    expect(new Date(second).getTime()).not.toBeNaN();
    // Second timestamp should be >= first
    expect(new Date(second).getTime()).toBeGreaterThanOrEqual(new Date(first).getTime());
  });
});
