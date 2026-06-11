-- Phase 3, Step 15: remove legacy catalogue artifacts.
-- Question selection now runs entirely from question_bank + faculty uploads.

DROP TABLE IF EXISTS catalogue_question_index;

DROP INDEX IF EXISTS idx_test_questions_catalogue_question_id;

ALTER TABLE test_questions
  DROP COLUMN IF EXISTS catalogue_question_id;
