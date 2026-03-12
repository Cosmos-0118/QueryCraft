'use client';

import { useEffect, useCallback } from 'react';

const SESSION_KEY = 'querycraft-session';

export interface SessionData {
  lastPage: string;
  lastTopicSlug?: string;
  lastLessonSlug?: string;
  lastLessonStep?: number;
  timestamp: string;
}

export function useSessionPersistence() {
  const restore = useCallback((): SessionData | null => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as SessionData) : null;
    } catch {
      return null;
    }
  }, []);

  const save = useCallback(
    (data: Partial<SessionData>) => {
      try {
        const existing = restore();
        const merged: SessionData = {
          lastPage: data.lastPage ?? existing?.lastPage ?? '/',
          lastTopicSlug: data.lastTopicSlug ?? existing?.lastTopicSlug,
          lastLessonSlug: data.lastLessonSlug ?? existing?.lastLessonSlug,
          lastLessonStep: data.lastLessonStep ?? existing?.lastLessonStep,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
      } catch {
        // localStorage unavailable
      }
    },
    [restore],
  );

  return { save, restore };
}

/**
 * Hook to auto-save session data for a specific page.
 * Saves on mount and whenever deps change.
 */
export function useAutoSave(data: Partial<SessionData>, deps: unknown[] = []) {
  const { save } = useSessionPersistence();

  useEffect(() => {
    save(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
