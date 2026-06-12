-- Rollback for 0015_drop_catalogue_artifacts.

ALTER TABLE test_questions
  ADD COLUMN IF NOT EXISTS catalogue_question_id text;

CREATE INDEX IF NOT EXISTS idx_test_questions_catalogue_question_id
  ON test_questions (catalogue_question_id)
  WHERE catalogue_question_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalogue_question_index (
  catalogue_id     text PRIMARY KEY,
  unit             smallint NOT NULL CHECK (unit BETWEEN 1 AND 99),
  difficulty       text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  marks            numeric(5, 2) NOT NULL DEFAULT 1.00,
  prompt_preview   text NOT NULL,
  option_count     smallint NOT NULL CHECK (option_count >= 2),
  correct_answer   text NOT NULL,
  has_explanation  boolean NOT NULL DEFAULT false,
  source_file      text NOT NULL,
  content_hash     text NOT NULL,
  imported_at      timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
