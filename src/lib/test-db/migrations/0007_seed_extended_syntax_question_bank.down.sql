-- Development rollback for Phase 2, Step 7 extended syntax-focused seed migration.

DELETE FROM question_options qo
USING question_bank qb
WHERE qo.question_id = qb.id
  AND qb.tags ->> 'seed' = 'phase2_step7';

DELETE FROM question_bank
WHERE tags ->> 'seed' = 'phase2_step7';

DELETE FROM topics t
WHERE t.slug IN (
  'dbms-storage-hierarchy',
  'plsql-cursors-exceptions'
)
AND NOT EXISTS (
  SELECT 1
  FROM question_bank qb
  WHERE qb.topic_id = t.id
);
