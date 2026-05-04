-- Down migration for 0012_link_test_questions_to_catalogue.

DROP INDEX IF EXISTS idx_test_questions_catalogue_question_id;

ALTER TABLE test_questions
  DROP CONSTRAINT IF EXISTS test_questions_source_check;

ALTER TABLE test_questions
  DROP COLUMN IF EXISTS catalogue_question_id;

-- Note: re-instating the NOT NULL constraint requires that no rows currently
-- have a NULL question_bank_id. If catalogue-sourced rows exist they must be
-- removed manually before this migration is rolled back.
ALTER TABLE test_questions
  ALTER COLUMN question_bank_id SET NOT NULL;
