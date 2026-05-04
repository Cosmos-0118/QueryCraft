-- Development rollback for Phase 2, Step 3 index migration.
DROP INDEX IF EXISTS idx_audit_logs_resource_created_at;
DROP INDEX IF EXISTS idx_violation_events_attempt_occurred_at;
DROP INDEX IF EXISTS idx_answer_evaluations_attempt_evaltype_evaluatedat;
DROP INDEX IF EXISTS idx_question_bank_topic_difficulty_status;
DROP INDEX IF EXISTS idx_attempts_test_id_status;