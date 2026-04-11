-- Development rollback for Phase 2, Step 4 seed migration.

DELETE FROM question_options qo
USING question_bank qb
WHERE qo.question_id = qb.id
  AND qb.tags ->> 'seed' = 'phase2_step4';

DELETE FROM question_bank
WHERE tags ->> 'seed' = 'phase2_step4';

DELETE FROM topics t
WHERE t.slug IN (
  'relational-model-fundamentals',
  'er-modeling',
  'relational-algebra',
  'tuple-relational-calculus',
  'sql-ddl-constraints',
  'sql-dml-joins',
  'aggregation-subqueries',
  'normalization-functional-dependencies',
  'transactions-concurrency-control',
  'indexing-views-triggers-procedures'
)
AND NOT EXISTS (
  SELECT 1
  FROM question_bank qb
  WHERE qb.topic_id = t.id
);