import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, User, LocalAccount } from '@/types/auth';

/* ── Simple password hashing (SHA-256, client-side only) ─────── */

async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
  /** Change password for the current user */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Remove an account from the device */
  removeAccount: (id: string) => void;
  /** Export an account as a portable code string */
  exportAccount: (id: string) => string;
  /** Import an account from a portable code string. Returns the imported account name. */
  importAccount: (code: string) => string;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
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
      },

      logout: () => set({ user: null, isAuthenticated: false }),

      updateName: (newName) => {
        const { user, accounts } = get();
        if (!user) return;
        const trimmed = newName.trim();
        set({
          user: { ...user, displayName: trimmed },
          accounts: accounts.map((a) => (a.id === user.id ? { ...a, displayName: trimmed } : a)),
        });
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

      removeAccount: (id) => {
        const { user } = get();
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
    { name: 'querycraft-auth' },
  ),
);
