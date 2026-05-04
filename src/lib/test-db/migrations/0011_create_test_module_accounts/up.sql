-- Phase 3, Step 11: per-test-module account auth.
-- Test module access is gated by accounts that an admin pre-provisions by email.
-- Students/teachers set their own password the first time they log in.
-- The platform admin is configured via env vars (ADMIN_EMAIL / ADMIN_PASSWORD)
-- and is therefore not stored in this table.

CREATE TABLE test_module_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_lower text NOT NULL,
  role text NOT NULL CHECK (role IN ('teacher', 'student')),
  display_name text,
  password_hash text,
  password_set boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT test_module_accounts_email_lower_unique UNIQUE (email_lower)
);

CREATE INDEX IF NOT EXISTS idx_test_module_accounts_role
  ON test_module_accounts (role);

CREATE INDEX IF NOT EXISTS idx_test_module_accounts_active
  ON test_module_accounts (is_active);
