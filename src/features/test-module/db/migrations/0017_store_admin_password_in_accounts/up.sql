-- Store the configured admin email as a normal account so the password is
-- created through OTP setup instead of kept in environment variables.

ALTER TABLE test_module_accounts
  DROP CONSTRAINT IF EXISTS test_module_accounts_role_check;

ALTER TABLE test_module_accounts
  ADD CONSTRAINT test_module_accounts_role_check
  CHECK (role IN ('admin', 'teacher', 'student'));
