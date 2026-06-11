export const APP_NAME = 'QueryCraft';
export const APP_DESCRIPTION =
  'An interactive, visual DBMS learning platform that teaches database concepts by showing — not just telling.';

export const UNITS = [
  { id: 1, title: 'Introduction to DBMS', slug: 'unit1' },
  { id: 2, title: 'Relational DBMS', slug: 'unit2' },
  { id: 3, title: 'SQL', slug: 'unit3' },
  { id: 4, title: 'Normalization', slug: 'unit4' },
  { id: 5, title: 'Concurrency Control & Advanced Topics', slug: 'unit5' },
] as const;

export const TOKEN_EXPIRY = {
  ACCESS: 15 * 60, // 15 minutes in seconds
  REFRESH: 7 * 24 * 60 * 60, // 7 days in seconds
} as const;

export const RATE_LIMITS = {
  LOGIN: { max: 5, windowMs: 15 * 60 * 1000 },
  REGISTER: { max: 3, windowMs: 60 * 60 * 1000 },
  SUBMIT: { max: 30, windowMs: 60 * 1000 },
  GENERAL: { max: 100, windowMs: 60 * 1000 },
} as const;
