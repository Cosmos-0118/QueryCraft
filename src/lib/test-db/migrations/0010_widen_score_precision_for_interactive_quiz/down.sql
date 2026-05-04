-- Rollback precision widening for attempt/grade score columns.
-- Clamp values to the numeric(5,2) range so type conversion cannot fail.

ALTER TABLE attempts
  ALTER COLUMN auto_score TYPE numeric(5,2)
    USING CASE
      WHEN auto_score IS NULL THEN NULL
      ELSE LEAST(GREATEST(auto_score, -999.99), 999.99)
    END,
  ALTER COLUMN manual_score TYPE numeric(5,2)
    USING CASE
      WHEN manual_score IS NULL THEN NULL
      ELSE LEAST(GREATEST(manual_score, -999.99), 999.99)
    END,
  ALTER COLUMN final_score TYPE numeric(5,2)
    USING CASE
      WHEN final_score IS NULL THEN NULL
      ELSE LEAST(GREATEST(final_score, -999.99), 999.99)
    END;

ALTER TABLE grades
  ALTER COLUMN auto_score TYPE numeric(5,2)
    USING LEAST(GREATEST(auto_score, -999.99), 999.99),
  ALTER COLUMN manual_adjustment TYPE numeric(5,2)
    USING LEAST(GREATEST(manual_adjustment, -999.99), 999.99),
  ALTER COLUMN final_score TYPE numeric(5,2)
    USING LEAST(GREATEST(final_score, -999.99), 999.99);
