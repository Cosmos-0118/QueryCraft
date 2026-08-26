-- Universal auth onboarding: profile metadata and first-login OTP verification.

ALTER TABLE test_module_accounts
  ADD COLUMN IF NOT EXISTS faculty_id text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS section text;

CREATE TABLE IF NOT EXISTS test_auth_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_lower text NOT NULL,
  otp_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('setup_password')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_auth_otps_email_purpose
  ON test_auth_otps (email_lower, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_auth_otps_expires_at
  ON test_auth_otps (expires_at);
