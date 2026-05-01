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
const MIN_TOKEN_SECRET_LENGTH = 32;

const TOKEN_ISSUER = 'querycraft.test-auth';
const TOKEN_AUDIENCE = 'querycraft.test-module';
const TOKEN_VERSION = 1;
const CLOCK_SKEW_SECONDS = 30;

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
  if (fromEnv && fromEnv.length >= MIN_TOKEN_SECRET_LENGTH) {
    return fromEnv;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `TEST_AUTH_SECRET must be configured with at least ${MIN_TOKEN_SECRET_LENGTH} characters in production.`,
    );
  }

  // Dev fallback only. Never rely on this in production.
  const fallbackSeed = process.env.TEST_DB_URL?.trim() ?? 'querycraft-test-auth-dev-fallback-secret';
  return createHmac('sha256', 'qc:test-auth:dev-fallback').update(fallbackSeed).digest('hex');
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
  iss: string;
  aud: string;
  iat: number;
  nbf: number;
  jti: string;
  v: number;
  /** seconds since epoch */
  exp: number;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function isValidRole(value: unknown): value is TestAuthTokenPayload['role'] {
  return value === 'admin' || value === 'teacher' || value === 'student';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

interface LegacyTokenPayload {
  sub?: unknown;
  email?: unknown;
  role?: unknown;
  displayName?: unknown;
  exp?: unknown;
  iss?: unknown;
  aud?: unknown;
  iat?: unknown;
  nbf?: unknown;
  jti?: unknown;
  v?: unknown;
}

function normalizeTokenPayload(raw: LegacyTokenPayload): TestAuthTokenPayload | null {
  if (
    !isNonEmptyString(raw.sub)
    || !isNonEmptyString(raw.email)
    || !isValidRole(raw.role)
    || !isNonEmptyString(raw.displayName)
    || typeof raw.exp !== 'number'
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  // Legacy token support: if modern claims are missing, normalize into v1 format.
  const iat = typeof raw.iat === 'number' ? raw.iat : Math.max(0, raw.exp - TOKEN_TTL_SECONDS);
  const nbf = typeof raw.nbf === 'number' ? raw.nbf : iat;
  const iss = typeof raw.iss === 'string' ? raw.iss : TOKEN_ISSUER;
  const aud = typeof raw.aud === 'string' ? raw.aud : TOKEN_AUDIENCE;
  const jti = typeof raw.jti === 'string' && raw.jti.trim()
    ? raw.jti
    : `legacy_${Math.max(0, raw.exp - now)}`;
  const v = typeof raw.v === 'number' ? raw.v : TOKEN_VERSION;

  if (iss !== TOKEN_ISSUER || aud !== TOKEN_AUDIENCE || v !== TOKEN_VERSION) {
    return null;
  }

  if (raw.exp <= now - CLOCK_SKEW_SECONDS) {
    return null;
  }

  if (iat > now + CLOCK_SKEW_SECONDS || nbf > now + CLOCK_SKEW_SECONDS) {
    return null;
  }

  if (raw.exp <= iat) {
    return null;
  }

  return {
    sub: raw.sub,
    email: raw.email.toLowerCase(),
    role: raw.role,
    displayName: raw.displayName,
    iss,
    aud,
    iat,
    nbf,
    jti,
    v,
    exp: raw.exp,
  };
}

export function signTestAuthToken(
  payload: Omit<TestAuthTokenPayload, 'exp' | 'iss' | 'aud' | 'iat' | 'nbf' | 'jti' | 'v'>,
  ttlSeconds = TOKEN_TTL_SECONDS,
): string {
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: TestAuthTokenPayload = {
    ...payload,
    email: payload.email.toLowerCase(),
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    iat: now,
    nbf: now,
    jti: randomBytes(16).toString('hex'),
    v: TOKEN_VERSION,
    exp: now + Math.max(60, Math.floor(ttlSeconds)),
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

  let payload: LegacyTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(body).toString('utf8'));
  } catch {
    return null;
  }

  return normalizeTokenPayload(payload);
}
