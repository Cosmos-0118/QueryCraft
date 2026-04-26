import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;
const PASSWORD_HASH_FORMAT = 'scrypt';

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = await scrypt(password.normalize('NFKC'), salt, SCRYPT_KEYLEN);
  return `${PASSWORD_HASH_FORMAT}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, hashed: string | null | undefined): Promise<boolean> {
  if (!hashed) return false;

  const parts = hashed.split('$');
  if (parts.length !== 3 || parts[0] !== PASSWORD_HASH_FORMAT) return false;

  const salt = Buffer.from(parts[1], 'base64');
  const expected = Buffer.from(parts[2], 'base64');
  if (expected.length !== SCRYPT_KEYLEN) return false;

  const derived = await scrypt(password.normalize('NFKC'), salt, SCRYPT_KEYLEN);

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function getTokenSecret() {
  const fromEnv = process.env.TEST_AUTH_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  // Fall back to a deterministic secret derived from TEST_DB_URL so tokens
  // remain stable for a single deployment without forcing extra env config.
  const fallbackSeed = process.env.TEST_DB_URL?.trim() ?? 'querycraft-test-auth-fallback-secret';
  return `tas:${fallbackSeed}`;
}

function base64UrlEncode(input: Buffer | string) {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buffer
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + padding, 'base64');
}

export interface TestAuthTokenPayload {
  sub: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  displayName: string;
  /** seconds since epoch */
  exp: number;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export function signTestAuthToken(payload: Omit<TestAuthTokenPayload, 'exp'>, ttlSeconds = TOKEN_TTL_SECONDS): string {
  const fullPayload: TestAuthTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = base64UrlEncode(
    createHmac('sha256', getTokenSecret()).update(body).digest(),
  );
  return `${body}.${signature}`;
}

export function verifyTestAuthToken(token: string | null | undefined): TestAuthTokenPayload | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  const expected = base64UrlEncode(
    createHmac('sha256', getTokenSecret()).update(body).digest(),
  );

  if (expected.length !== signature.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  } catch {
    return null;
  }

  let payload: TestAuthTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(body).toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    return null;
  }

  if (payload.role !== 'admin' && payload.role !== 'teacher' && payload.role !== 'student') {
    return null;
  }

  return payload;
}
