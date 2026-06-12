-- Phase 2, Step 6: Relax mixed-mode ratio constraints to support teacher-configurable splits.

ALTER TABLE tests
DROP CONSTRAINT IF EXISTS tests_mixed_mode_rules;

ALTER TABLE tests
ADD CONSTRAINT tests_mixed_mode_rules CHECK (
  (
    question_mode = 'mixed'
    AND mix_mcq_percent IS NOT NULL
    AND mix_sql_fill_percent IS NOT NULL
    AND mix_mcq_percent BETWEEN 10 AND 90
    AND mix_sql_fill_percent BETWEEN 10 AND 90
    AND (mix_mcq_percent + mix_sql_fill_percent) = 100
  )
  OR (
    question_mode <> 'mixed'
    AND mix_mcq_percent IS NULL
    AND mix_sql_fill_percent IS NULL
  )
);
