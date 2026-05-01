'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LEGACY_TEST_AUTH_STORAGE_KEY,
  useTestAuthStore,
  type TestAuthUser,
} from '@/stores/test-auth-store';

/**
 * Drop-in shape mirroring useAuth() so that existing test-module code that
 * reads `user.id`, `user.role`, and `user.displayName` keeps working unchanged.
 */
export interface CompatUser {
  id: string;
  displayName: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
}

function toCompat(user: TestAuthUser | null): CompatUser | null {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
  };
}

export function useTestAuth() {
  const user = useTestAuthStore((state) => state.user);
  const token = useTestAuthStore((state) => state.token);
  const hydrated = useTestAuthStore((state) => state.hydrated);
  const clearSession = useTestAuthStore((state) => state.clearSession);
  const setSession = useTestAuthStore((state) => state.setSession);
  const markHydrated = useTestAuthStore((state) => state.markHydrated);
  const router = useRouter();
  const legacyCleanupDoneRef = useRef(false);

  const compatUser = useMemo(() => toCompat(user), [user]);

  useEffect(() => {
    if (legacyCleanupDoneRef.current) {
      return;
    }

    legacyCleanupDoneRef.current = true;

    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(LEGACY_TEST_AUTH_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  useEffect(() => {
    if (hydrated) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 8000);

    const hydrateFromServer = async () => {
      try {
        const res = await fetch('/api/test-auth/me', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) {
          if (!cancelled) {
            const currentUser = useTestAuthStore.getState().user;
            if (!currentUser) {
              clearSession();
            }
          }
          return;
        }

        const data = await res.json().catch(() => null) as {
          user?: {
            id?: unknown;
            email?: unknown;
            role?: unknown;
            display_name?: unknown;
          };
        } | null;

        const serverUser = data?.user;
        if (
          !serverUser
          || typeof serverUser.id !== 'string'
          || typeof serverUser.email !== 'string'
          || (serverUser.role !== 'admin' && serverUser.role !== 'teacher' && serverUser.role !== 'student')
          || typeof serverUser.display_name !== 'string'
        ) {
          if (!cancelled) {
            const currentUser = useTestAuthStore.getState().user;
            if (!currentUser) {
              clearSession();
            }
          }
          return;
        }

        if (!cancelled) {
          setSession({
            user: {
              id: serverUser.id,
              email: serverUser.email,
              role: serverUser.role,
              displayName: serverUser.display_name,
            },
            token: null,
          });
        }
      } catch {
        if (!cancelled) {
          const currentUser = useTestAuthStore.getState().user;
          if (!currentUser) {
            clearSession();
          }
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) {
          markHydrated();
        }
      }
    };

    void hydrateFromServer();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [clearSession, hydrated, markHydrated, setSession]);

  const logout = () => {
    void fetch('/api/test-auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => {
      // Clear local auth state even if server cookie cleanup fails.
    });
    clearSession();
    router.push('/tests/login');
  };

  return {
    user: compatUser,
    rawUser: user,
    token,
    isAuthenticated: !!user,
    hydrated,
    setSession,
    logout,
  };
}

/**
 * Redirect to the test-module login screen if the visitor is not authenticated.
 * Returns whether the gate is currently allowing access.
 */
export function useRequireTestAuth(options?: { allowedRoles?: Array<'admin' | 'teacher' | 'student'> }) {
  const router = useRouter();
  const { user, hydrated, isAuthenticated } = useTestAuth();

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/tests/login');
      return;
    }
    if (options?.allowedRoles && user && !options.allowedRoles.includes(user.role)) {
      // Send users to the role-appropriate landing page instead of looping login.
      const fallback = user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/tests' : '/tests';
      router.replace(fallback);
    }
  }, [hydrated, isAuthenticated, options?.allowedRoles, router, user]);

  return {
    user,
    isAuthenticated,
    hydrated,
    isAllowed:
      hydrated &&
      isAuthenticated &&
      (!options?.allowedRoles || (user && options.allowedRoles.includes(user.role))),
  };
}

/**
 * Helper for fetch() calls that need to send the test-auth token (admin APIs etc.).
 */
export function useAuthorizedFetch() {
  const token = useTestAuthStore((state) => state.token);

  return useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers ?? {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return fetch(input, {
        ...init,
        headers,
        credentials: init.credentials ?? 'same-origin',
      });
    },
    [token],
  );
}
