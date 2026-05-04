-- Phase 3, Step 14: relax test_questions_source_check.
--
-- Migration 0012 added a check constraint that required either
-- `question_bank_id` or `catalogue_question_id` to be non-null. That is
-- redundant: the real invariant for grading is that `question_snapshot` is
-- present, and `question_snapshot` already has a column-level NOT NULL
-- constraint. The redundant check prevents us from cleanly NULL-ing legacy
-- bank ids when wiping the old MCQ bank, so we drop it.

ALTER TABLE test_questions
  DROP CONSTRAINT IF EXISTS test_questions_source_check;
