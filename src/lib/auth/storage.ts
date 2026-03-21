export const AUTH_STORAGE_KEY = 'querycraft-auth';
export const AUTH_SESSION_STORAGE_KEY = 'querycraft-session';

interface SessionPayload {
  user?: {
    id?: string;
  };
}

function readUserIdFromStorage(raw: string | null): string | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SessionPayload & { state?: SessionPayload };
    const state = parsed?.state ?? parsed;
    const userId = state?.user?.id;
    return typeof userId === 'string' && userId.trim() ? userId : null;
  } catch {
    return null;
  }
}

export function readCurrentBrowserUserId(): string | null {
  if (typeof window === 'undefined') return null;

  const sessionUserId = readUserIdFromStorage(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY));
  if (sessionUserId) {
    return sessionUserId;
  }

  return readUserIdFromStorage(localStorage.getItem(AUTH_STORAGE_KEY));
}