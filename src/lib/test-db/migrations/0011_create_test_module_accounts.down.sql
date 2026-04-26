-- Reverse migration 0011: drop test module account auth table.

DROP INDEX IF EXISTS idx_test_module_accounts_active;
DROP INDEX IF EXISTS idx_test_module_accounts_role;
DROP TABLE IF EXISTS test_module_accounts;
