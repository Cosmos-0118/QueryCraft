/**
 * User-scoped localStorage helper.
 *
 * Every feature store and the SQL-engine persistence layer call `getUserKey(baseKey)`
 * to produce a key like `querycraft:<userId>:sandbox`.  This ensures that data
 * belonging to one user account never leaks into another.
 *
 * When no user is logged in the fallback prefix is `querycraft:guest:`.
 */

const AUTH_STORAGE_KEY = 'querycraft-auth';

/** Read the current user id from the auth store's persisted state. */
function readCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Zustand persist wraps state – the shape is { state: { ... }, version: … }
    const state = parsed?.state ?? parsed;
    const user = state?.user;
    return typeof user?.id === 'string' && user.id ? user.id : null;
  } catch {
    return null;
  }
}

/** Prefix that scopes all localStorage keys to the current user session. */
export function getUserStoragePrefix(): string {
  const userId = readCurrentUserId();
  return `querycraft:${userId ?? 'guest'}:`;
}

/** Build a user-scoped localStorage key from a base name. */
export function getUserKey(baseKey: string): string {
  return `${getUserStoragePrefix()}${baseKey}`;
}

/** Build a user-scoped localStorage key for a specific user id. */
export function getUserKeyForId(userId: string, baseKey: string): string {
  return `querycraft:${userId}:${baseKey}`;
}

/**
 * Remove **all** localStorage entries scoped to a specific user id.
 * Called on account deletion to guarantee no data is left behind.
 */
export function clearAllUserData(userId: string): void {
  if (typeof window === 'undefined') return;
  const prefix = `querycraft:${userId}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

/**
 * Remove all localStorage entries scoped to the currently logged-in user.
 * Called on logout to prevent data from bleeding into the next session.
 */
export function clearCurrentUserData(): void {
  const userId = readCurrentUserId();
  if (userId) {
    clearAllUserData(userId);
  }
  // Also clear guest data
  clearAllUserData('guest');
}

/**
 * All base key names used across the app.  Centralised here so that
 * `clearAllUserData` doesn't need to know about individual stores.
 */
export const STORAGE_BASE_KEYS = {
  sandbox: 'sandbox',
  algebra: 'algebra',
  trc: 'trc',
  er: 'er',
  normalizer: 'normalizer',
  generator: 'generator',
  session: 'session',
  engineState: 'engine-state',
  activeDatabase: 'active-database',
  activeUser: 'active-user',
} as const;

/**
 * Zustand-compatible StateStorage that scopes keys to the current user.
 *
 * Zustand's `createJSONStorage` wraps a `StateStorage` (which deals with raw
 * strings) into a full `PersistStorage` (which wraps values in `StorageValue`).
 * We provide a custom `StateStorage` that rewrites keys to include the user prefix.
 */
export const userScopedStateStorage = {
  getItem(name: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(getUserKey(name));
    } catch {
      return null;
    }
  },

  setItem(name: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(getUserKey(name), value);
    } catch {
      // localStorage unavailable or quota exceeded
    }
  },

  removeItem(name: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(getUserKey(name));
    } catch {
      // localStorage unavailable
    }
  },
};
