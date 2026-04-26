'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTestAuthStore, type TestAuthUser } from '@/stores/test-auth-store';

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
  const router = useRouter();

  const compatUser = useMemo(() => toCompat(user), [user]);

  const logout = () => {
    clearSession();
    router.push('/tests/login');
  };

  return {
    user: compatUser,
    rawUser: user,
    token,
    isAuthenticated: !!user && !!token,
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
      return fetch(input, { ...init, headers });
    },
    [token],
  );
}
