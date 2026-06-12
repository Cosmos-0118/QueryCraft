-- Rollback for Phase 2, Step 8 concurrency-focused indexes.

DROP INDEX IF EXISTS idx_attempts_test_started_at;
DROP INDEX IF EXISTS idx_attempts_test_student_profile;
DROP INDEX IF EXISTS idx_question_bank_status_type_difficulty;
DROP INDEX IF EXISTS idx_test_questions_test_bank;
DROP INDEX IF EXISTS idx_test_invites_test_active_created;
