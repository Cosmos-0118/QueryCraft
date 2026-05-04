-- Down migration for 0014_relax_test_questions_source_check.
--
-- Re-instating the check is only safe if no rows currently have
-- BOTH question_bank_id and catalogue_question_id NULL. Re-create
-- the original constraint conditionally; it will fail loudly if data
-- has drifted.

ALTER TABLE test_questions
  ADD CONSTRAINT test_questions_source_check
  CHECK (
    question_bank_id IS NOT NULL
    OR catalogue_question_id IS NOT NULL
  );
