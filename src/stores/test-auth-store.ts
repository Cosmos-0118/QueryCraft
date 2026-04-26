import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Auth scoped to the test module only. Independent from the global useAuthStore
 * so that the rest of the app (sandbox, algebra, etc.) keeps working with the
 * existing local accounts. Sessions live in localStorage via zustand persist.
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
  setSession: (session: { user: TestAuthUser; token: string }) => void;
  clearSession: () => void;
  markHydrated: () => void;
}

export const TEST_AUTH_STORAGE_KEY = 'qc-test-auth-session-v1';

export const useTestAuthStore = create<TestAuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      hydrated: false,
      setSession: ({ user, token }) => set({ user, token }),
      clearSession: () => set({ user: null, token: null }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: TEST_AUTH_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
