DROP INDEX IF EXISTS idx_test_auth_otps_expires_at;
DROP INDEX IF EXISTS idx_test_auth_otps_email_purpose;
DROP TABLE IF EXISTS test_auth_otps;

ALTER TABLE test_module_accounts
  DROP COLUMN IF EXISTS section,
  DROP COLUMN IF EXISTS registration_number,
  DROP COLUMN IF EXISTS faculty_id;
