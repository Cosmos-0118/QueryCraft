-- Phase 3, Step 13: catalogue_question_index — DB-side mirror of the
-- file-backed MCQ catalogue.
--
-- The actual question content (prompt, options, correct answer) still lives
-- in /catalogue/unit{N}.json (source of truth). This table just gives us
-- queryable metadata so we can:
--   * filter / paginate the catalogue from the admin UI;
--   * gather analytics ("which question is used in the most tests");
--   * detect deletions when a question is removed from the JSON files.
--
-- It is rebuilt by `scripts/test-db/sync-catalogue.mjs`.

CREATE TABLE IF NOT EXISTS catalogue_question_index (
  catalogue_id     text PRIMARY KEY,                               -- e.g. "u1-q003"
  unit             smallint NOT NULL CHECK (unit BETWEEN 1 AND 99),
  difficulty       text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  marks            numeric(5, 2) NOT NULL DEFAULT 1.00,
  prompt_preview   text NOT NULL,                                  -- first ~240 chars of prompt
  option_count     smallint NOT NULL CHECK (option_count >= 2),
  correct_answer   text NOT NULL,                                  -- option key (A/B/C/D)
  has_explanation  boolean NOT NULL DEFAULT false,
  source_file      text NOT NULL,                                  -- e.g. "unit1.json"
  content_hash     text NOT NULL,                                  -- sha256 of normalized payload
  imported_at      timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalogue_question_index_unit
  ON catalogue_question_index (unit);

CREATE INDEX IF NOT EXISTS idx_catalogue_question_index_difficulty
  ON catalogue_question_index (difficulty);
