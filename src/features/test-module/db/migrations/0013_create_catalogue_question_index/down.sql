-- Down migration for 0013_create_catalogue_question_index.

DROP INDEX IF EXISTS idx_catalogue_question_index_difficulty;
DROP INDEX IF EXISTS idx_catalogue_question_index_unit;
DROP TABLE IF EXISTS catalogue_question_index;
