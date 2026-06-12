-- Phase 2, Step 3: index layer from Section 14.5.
-- Unique indexes for invite_code, attempt uniqueness, test question ordering,
-- attempt answers uniqueness, and grades.attempt_id are already provided by
-- table-level UNIQUE constraints in migration 0003.

CREATE INDEX IF NOT EXISTS idx_attempts_test_id_status
  ON attempts (test_id, status);

CREATE INDEX IF NOT EXISTS idx_question_bank_topic_difficulty_status
  ON question_bank (topic_id, difficulty, status);

CREATE INDEX IF NOT EXISTS idx_answer_evaluations_attempt_evaltype_evaluatedat
  ON answer_evaluations (attempt_answer_id, evaluation_type, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_violation_events_attempt_occurred_at
  ON violation_events (attempt_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_created_at
  ON audit_logs (resource_type, resource_id, created_at);