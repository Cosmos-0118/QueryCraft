import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, User, LocalAccount } from '@/types/auth';
import { clearAllUserData } from '@/lib/utils/user-storage';
import { AUTH_SESSION_STORAGE_KEY, AUTH_STORAGE_KEY } from '@/lib/auth/storage';

interface SessionPayload {
  user: User;
}

/* ── Simple password hashing (SHA-256, client-side only) ─────── */

async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadSessionUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionPayload;
    if (!parsed?.user?.id || !parsed.user.displayName || !parsed.user.createdAt) {
      return null;
    }
    return parsed.user;
  } catch {
    return null;
  }
}

function saveSessionUser(user: User) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({ user } satisfies SessionPayload),
    );
  } catch {
    // sessionStorage unavailable
  }
}

function clearSessionUser() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // sessionStorage unavailable
  }
}

/* ── Store ─────────────────────────────────────────────────── */

interface AuthStore extends AuthState {
  /** All accounts saved on this device */
  accounts: LocalAccount[];
  /** Add a new account to this device */
  addAccount: (name: string, password: string) => Promise<void>;
  /** Log in to an existing local account */
  login: (id: string, password: string) => Promise<void>;
  /** Log out the current user */
  logout: () => void;
  /** Update the display name of the current user */
  updateName: (newName: string) => void;
  /** Update role for current account */
  setRole: (role: 'student' | 'teacher') => void;
  /** Clear role selection for current account */
  clearRole: () => void;
  /** Change password for the current user */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Remove an account from the device */
  removeAccount: (id: string, password: string) => Promise<void>;
  /** Export an account as a portable code string */
  exportAccount: (id: string) => string;
  /** Import an account from a portable code string. Returns the imported account name. */
  importAccount: (code: string) => string;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: loadSessionUser(),
      isAuthenticated: !!loadSessionUser(),
      accounts: [],

      addAccount: async (name, password) => {
        const hash = await hashPassword(password);
        const account: LocalAccount = {
          id: crypto.randomUUID(),
          displayName: name.trim(),
          passwordHash: hash,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ accounts: [...s.accounts, account] }));
      },

      login: async (id, password) => {
        const account = get().accounts.find((a) => a.id === id);
        if (!account) throw new Error('Account not found');
        const hash = await hashPassword(password);
        if (hash !== account.passwordHash) throw new Error('Incorrect password');
        const user: User = {
          id: account.id,
          displayName: account.displayName,
          createdAt: account.createdAt,
        };
        set({ user, isAuthenticated: true });
        saveSessionUser(user);
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
        clearSessionUser();
      },

      updateName: (newName) => {
        const { user, accounts } = get();
        if (!user) return;
        const trimmed = newName.trim();
        const updatedUser: User = { ...user, displayName: trimmed };
        set({
          user: updatedUser,
          accounts: accounts.map((a) => (a.id === user.id ? { ...a, displayName: trimmed } : a)),
        });
        saveSessionUser(updatedUser);
      },

      setRole: (role) => {
        const { user } = get();
        if (!user) return;
        const updatedUser: User = { ...user, role };
        set({ user: updatedUser });
        saveSessionUser(updatedUser);
      },

      clearRole: () => {
        const { user } = get();
        if (!user) return;

        const updatedUser: User = { ...user };
        delete updatedUser.role;

        set({ user: updatedUser });
        saveSessionUser(updatedUser);
      },

      changePassword: async (currentPassword, newPassword) => {
        const { user, accounts } = get();
        if (!user) throw new Error('Not logged in');
        const account = accounts.find((a) => a.id === user.id);
        if (!account) throw new Error('Account not found');
        const currentHash = await hashPassword(currentPassword);
        if (currentHash !== account.passwordHash) throw new Error('Current password is incorrect');
        const newHash = await hashPassword(newPassword);
        set({
          accounts: accounts.map((a) => (a.id === user.id ? { ...a, passwordHash: newHash } : a)),
        });
      },

      removeAccount: async (id, password) => {
        const { user, accounts } = get();
        const account = accounts.find((a) => a.id === id);
        if (!account) throw new Error('Account not found');

        const passwordHash = await hashPassword(password);
        if (passwordHash !== account.passwordHash) throw new Error('Incorrect password');

        if (user?.id === id) {
          clearSessionUser();
        }

        // Remove all user-scoped localStorage data for this account
        clearAllUserData(id);

        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          ...(user?.id === id ? { user: null, isAuthenticated: false } : {}),
        }));
      },

      exportAccount: (id) => {
        const account = get().accounts.find((a) => a.id === id);
        if (!account) throw new Error('Account not found');
        const json = JSON.stringify({
          id: account.id,
          displayName: account.displayName,
          passwordHash: account.passwordHash,
          createdAt: account.createdAt,
        });
        return btoa(json);
      },

      importAccount: (code) => {
        let parsed: LocalAccount;
        try {
          const json = atob(code.trim());
          parsed = JSON.parse(json);
        } catch {
          throw new Error('Invalid account code');
        }
        if (!parsed.id || !parsed.displayName || !parsed.passwordHash || !parsed.createdAt) {
          throw new Error('Invalid account data');
        }
        const exists = get().accounts.some((a) => a.id === parsed.id);
        if (exists) throw new Error('This account already exists on this device');
        const account: LocalAccount = {
          id: parsed.id,
          displayName: parsed.displayName,
          passwordHash: parsed.passwordHash,
          createdAt: parsed.createdAt,
        };
        set((s) => ({ accounts: [...s.accounts, account] }));
        return account.displayName;
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      version: 2,
      partialize: (state) => ({ accounts: state.accounts }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<AuthStore> | undefined;
        return {
          accounts: Array.isArray(state?.accounts) ? state.accounts : [],
        };
      },
    },
  ),
);
