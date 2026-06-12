import { create } from 'zustand';

/**
 * Auth scoped to the test module only. Independent from the global useAuthStore
 * so that the rest of the app (sandbox, algebra, etc.) keeps working unchanged.
 *
 * Security note:
 * - Do NOT persist test-module auth in localStorage/sessionStorage.
 * - Session authority is the httpOnly cookie set by server login routes.
 * - This in-memory store is only a client-side mirror of server state.
 */

export type TestAuthRole = 'admin' | 'teacher' | 'student';

export interface TestAuthUser {
  id: string;
  email: string;
  role: TestAuthRole;
  displayName: string;
}

interface TestAuthState {
  user: TestAuthUser | null;
  token: string | null;
  hydrated: boolean;
  setSession: (session: { user: TestAuthUser; token?: string | null }) => void;
  clearSession: () => void;
  markHydrated: () => void;
}

export const LEGACY_TEST_AUTH_STORAGE_KEY = 'qc-test-auth-session-v1';

export const useTestAuthStore = create<TestAuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,
  setSession: ({ user, token }) => set({ user, token: token ?? null, hydrated: true }),
  clearSession: () => set({ user: null, token: null, hydrated: true }),
  markHydrated: () => set({ hydrated: true }),
}));
