-- Phase 3, Step 12: link test_questions to file-based catalogue.
-- The catalogue/ JSON files are the new source-of-truth for MCQ content.
-- test_questions still owns the per-test snapshot (question_snapshot) so that
-- already-published tests grade consistently even if a catalogue file is later
-- edited. The legacy question_bank_id is kept (now nullable) for backward
-- compatibility with manually authored questions and existing seeded data.

-- Step 1: allow rows to be sourced from the catalogue without a question_bank entry.
ALTER TABLE test_questions
  ALTER COLUMN question_bank_id DROP NOT NULL;

-- Step 2: store the stable catalogue identifier (e.g. "u1-q003").
ALTER TABLE test_questions
  ADD COLUMN IF NOT EXISTS catalogue_question_id text;

-- Step 3: enforce that every test_questions row is anchored to either the
-- legacy bank or the new catalogue.
ALTER TABLE test_questions
  ADD CONSTRAINT test_questions_source_check
  CHECK (
    question_bank_id IS NOT NULL
    OR catalogue_question_id IS NOT NULL
  );

-- Step 4: speed up lookups by catalogue id (e.g. analytics or dedup).
CREATE INDEX IF NOT EXISTS idx_test_questions_catalogue_question_id
  ON test_questions (catalogue_question_id)
  WHERE catalogue_question_id IS NOT NULL;
