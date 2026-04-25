-- Rollback for Phase 2, Step 9 extra MCQ seed migration.

DELETE FROM question_options qo
USING question_bank qb
WHERE qo.question_id = qb.id
  AND qb.tags ->> 'seed' = 'phase2_step9';

DELETE FROM question_bank
WHERE tags ->> 'seed' = 'phase2_step9';

DELETE FROM topics t
WHERE t.slug = 'window-functions-analytics'
  AND NOT EXISTS (
    SELECT 1
    FROM question_bank qb
    WHERE qb.topic_id = t.id
  );
