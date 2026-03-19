'use client';

import { useEffect, useCallback } from 'react';
import { getUserKey, STORAGE_BASE_KEYS } from '@/lib/utils/user-storage';

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
      const key = getUserKey(STORAGE_BASE_KEYS.session);
      const raw = localStorage.getItem(key);
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
        const key = getUserKey(STORAGE_BASE_KEYS.session);
        localStorage.setItem(key, JSON.stringify(merged));
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
