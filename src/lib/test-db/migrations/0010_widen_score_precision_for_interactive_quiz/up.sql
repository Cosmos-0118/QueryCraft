-- Interactive quiz totals can exceed 999.99 points, which overflows numeric(5,2).
-- Widen score precision on attempt/grade aggregates.

ALTER TABLE attempts
  ALTER COLUMN auto_score TYPE numeric(12,2),
  ALTER COLUMN manual_score TYPE numeric(12,2),
  ALTER COLUMN final_score TYPE numeric(12,2);

ALTER TABLE grades
  ALTER COLUMN auto_score TYPE numeric(12,2),
  ALTER COLUMN manual_adjustment TYPE numeric(12,2),
  ALTER COLUMN final_score TYPE numeric(12,2);
