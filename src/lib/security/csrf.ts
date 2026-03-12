import { randomBytes, createHmac } from 'crypto';

const getSecret = () => {
  const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('CSRF_SECRET or JWT_SECRET is not set');
  return secret;
};

export function generateCsrfToken(): string {
  const nonce = randomBytes(32).toString('hex');
  const hmac = createHmac('sha256', getSecret()).update(nonce).digest('hex');
  return `${nonce}.${hmac}`;
}

export function validateCsrfToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [nonce, hmac] = parts;
  const expected = createHmac('sha256', getSecret()).update(nonce).digest('hex');
  // Constant-time comparison
  if (expected.length !== hmac.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ hmac.charCodeAt(i);
  }
  return mismatch === 0;
}
