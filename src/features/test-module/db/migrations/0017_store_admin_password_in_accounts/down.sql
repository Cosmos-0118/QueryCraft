DELETE FROM test_module_accounts
WHERE role = 'admin';

ALTER TABLE test_module_accounts
  DROP CONSTRAINT IF EXISTS test_module_accounts_role_check;

ALTER TABLE test_module_accounts
  ADD CONSTRAINT test_module_accounts_role_check
  CHECK (role IN ('teacher', 'student'));
