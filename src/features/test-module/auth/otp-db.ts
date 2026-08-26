import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { sql } from '@/features/test-module/db';
import { ensureAuthSchemaExtensions } from '@/features/test-module/auth/accounts-db';

const OTP_PURPOSE = 'setup_password';
const OTP_TTL_MINUTES = 10;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashOtp(emailLower: string, otp: string) {
  const secret = process.env.TEST_AUTH_SECRET?.trim() || process.env.TEST_DB_URL?.trim() || 'querycraft-otp-dev-secret';
  return createHash('sha256')
    .update(`${emailLower}:${otp}:${secret}`)
    .digest('hex');
}

export function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function createSetupOtp(email: string) {
  await ensureAuthSchemaExtensions();
  const emailLower = normalizeEmail(email);
  const otp = generateOtp();
  const otpHash = hashOtp(emailLower, otp);

  await sql.raw(
    `
    INSERT INTO test_auth_otps (email_lower, otp_hash, purpose, expires_at)
    VALUES ($1, $2, $3, now() + ($4::text || ' minutes')::interval);
    `,
    [emailLower, otpHash, OTP_PURPOSE, String(OTP_TTL_MINUTES)],
  );

  return { otp, expiresInMinutes: OTP_TTL_MINUTES };
}

export async function verifyAndConsumeSetupOtp(email: string, otp: string) {
  await ensureAuthSchemaExtensions();
  const emailLower = normalizeEmail(email);
  const submittedHash = hashOtp(emailLower, otp.trim());

  const result = await sql.raw(
    `
    SELECT id, otp_hash
    FROM test_auth_otps
    WHERE email_lower = $1
      AND purpose = $2
      AND consumed_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;
    `,
    [emailLower, OTP_PURPOSE],
  );

  const row = result.rows[0] as { id: string; otp_hash: string } | undefined;
  if (!row) return false;

  const expected = Buffer.from(row.otp_hash, 'hex');
  const submitted = Buffer.from(submittedHash, 'hex');
  if (expected.length !== submitted.length || !timingSafeEqual(expected, submitted)) {
    return false;
  }

  await sql.raw(
    `
    UPDATE test_auth_otps
    SET consumed_at = now()
    WHERE id = $1;
    `,
    [row.id],
  );

  return true;
}
