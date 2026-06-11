export interface AttemptNavigationLock {
  attemptPath: string;
  setAt: number;
}

const STORAGE_KEY = 'querycraft:test_attempt_nav_lock';
const LOCK_EVENT_NAME = 'querycraft:test-attempt-lock-changed';
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours safety cutoff

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function setAttemptNavigationLock(attemptPath: string) {
  if (!canUseStorage()) return;
  const normalizedPath = attemptPath.trim();
  if (!normalizedPath) return;

  const payload: AttemptNavigationLock = {
    attemptPath: normalizedPath,
    setAt: Date.now(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(LOCK_EVENT_NAME));
}

export function clearAttemptNavigationLock() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(LOCK_EVENT_NAME));
}

export function readAttemptNavigationLock(): AttemptNavigationLock | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AttemptNavigationLock>;
    const attemptPath = typeof parsed.attemptPath === 'string' ? parsed.attemptPath.trim() : '';
    const setAt = typeof parsed.setAt === 'number' ? parsed.setAt : 0;
    if (!attemptPath || !setAt) {
      clearAttemptNavigationLock();
      return null;
    }

    if (Date.now() - setAt > MAX_AGE_MS) {
      clearAttemptNavigationLock();
      return null;
    }

    return { attemptPath, setAt };
  } catch {
    clearAttemptNavigationLock();
    return null;
  }
}

export function getAttemptNavigationLockEventName() {
  return LOCK_EVENT_NAME;
}
