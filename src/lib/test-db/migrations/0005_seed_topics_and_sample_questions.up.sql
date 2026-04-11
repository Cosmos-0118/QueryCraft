-- Phase 2, Step 4: baseline topics and sample question bank seed.

WITH topic_seed (slug, name, description) AS (
  VALUES
    ('relational-model-fundamentals', 'Relational Model Fundamentals', 'Core concepts of relations, tuples, keys, and integrity constraints.'),
    ('er-modeling', 'ER Modeling', 'Entity-relationship modeling, cardinality, and mapping concepts.'),
    ('relational-algebra', 'Relational Algebra', 'Operators and transformations in relational algebra expressions.'),
    ('tuple-relational-calculus', 'Tuple Relational Calculus', 'Predicate-based querying in tuple/domain relational calculus.'),
    ('sql-ddl-constraints', 'SQL DDL and Constraints', 'Schema design, constraints, and data definition commands.'),
    ('sql-dml-joins', 'SQL DML and Joins', 'Data manipulation, filtering, and join operations.'),
    ('aggregation-subqueries', 'Aggregation and Subqueries', 'Group functions, HAVING, and nested query patterns.'),
    ('normalization-functional-dependencies', 'Normalization and Functional Dependencies', 'Normal forms, dependency theory, and decomposition rules.'),
    ('transactions-concurrency-control', 'Transactions and Concurrency Control', 'ACID, isolation anomalies, and locking basics.'),
    ('indexing-views-triggers-procedures', 'Indexing, Views, Triggers, and Procedures', 'Performance and automation objects in relational systems.')
)
INSERT INTO topics (slug, name, description)
SELECT ts.slug, ts.name, ts.description
FROM topic_seed ts
ON CONFLICT (slug)
DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

WITH question_seed (
  seed_key,
  topic_slug,
  question_type_value,
  prompt,
  difficulty,
  marks,
  expected_time_sec,
  answer_key,
  syntax_rules,
  explanation,
  tags
) AS (
  VALUES
    (
      'q_rmf_pk',
      'relational-model-fundamentals',
      'mcq',
      'In a relation, which key guarantees tuple uniqueness and disallows NULL values?',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"B"}'::jsonb,
      NULL::jsonb,
      'A primary key uniquely identifies each row and cannot be NULL.',
      '{"seed":"phase2_step4","seed_key":"q_rmf_pk","sample":true}'::jsonb
    ),
    (
      'q_er_cardinality',
      'er-modeling',
      'mcq',
      'Which cardinality best represents one department having many employees?',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"A"}'::jsonb,
      NULL::jsonb,
      'One-to-many maps one department to multiple employee rows.',
      '{"seed":"phase2_step4","seed_key":"q_er_cardinality","sample":true}'::jsonb
    ),
    (
      'q_ra_selection',
      'relational-algebra',
      'mcq',
      'Which relational algebra operator filters rows based on a predicate?',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"C"}'::jsonb,
      NULL::jsonb,
      'Selection (sigma) keeps tuples that satisfy a condition.',
      '{"seed":"phase2_step4","seed_key":"q_ra_selection","sample":true}'::jsonb
    ),
    (
      'q_trc_free_var',
      'tuple-relational-calculus',
      'mcq',
      'In tuple relational calculus, what does a free variable represent?',
      'medium',
      1.00,
      75,
      '{"correctOptionKey":"D"}'::jsonb,
      NULL::jsonb,
      'Free variables correspond to values returned in query results.',
      '{"seed":"phase2_step4","seed_key":"q_trc_free_var","sample":true}'::jsonb
    ),
    (
      'q_sql_ddl_not_null',
      'sql-ddl-constraints',
      'mcq',
      'Which constraint prevents NULL values from being stored in a column?',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"B"}'::jsonb,
      NULL::jsonb,
      'NOT NULL enforces non-null values for the target column.',
      '{"seed":"phase2_step4","seed_key":"q_sql_ddl_not_null","sample":true}'::jsonb
    ),
    (
      'q_sql_dml_left_join',
      'sql-dml-joins',
      'mcq',
      'What does a LEFT JOIN always preserve from the left table?',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"A"}'::jsonb,
      NULL::jsonb,
      'LEFT JOIN retains all rows from the left relation.',
      '{"seed":"phase2_step4","seed_key":"q_sql_dml_left_join","sample":true}'::jsonb
    ),
    (
      'q_agg_groupby',
      'aggregation-subqueries',
      'mcq',
      'Which clause groups rows before aggregate functions are applied?',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"C"}'::jsonb,
      NULL::jsonb,
      'GROUP BY forms groups used by aggregate functions like COUNT and SUM.',
      '{"seed":"phase2_step4","seed_key":"q_agg_groupby","sample":true}'::jsonb
    ),
    (
      'q_norm_3nf',
      'normalization-functional-dependencies',
      'mcq',
      'A table is in 3NF when it is in 2NF and what additional condition holds?',
      'medium',
      1.00,
      90,
      '{"correctOptionKey":"D"}'::jsonb,
      NULL::jsonb,
      '3NF removes transitive dependencies of non-key attributes.',
      '{"seed":"phase2_step4","seed_key":"q_norm_3nf","sample":true}'::jsonb
    ),
    (
      'q_tx_isolation',
      'transactions-concurrency-control',
      'mcq',
      'Which isolation anomaly occurs when one transaction reads uncommitted data from another?',
      'medium',
      1.00,
      90,
      '{"correctOptionKey":"B"}'::jsonb,
      NULL::jsonb,
      'Dirty read means data is observed before commit.',
      '{"seed":"phase2_step4","seed_key":"q_tx_isolation","sample":true}'::jsonb
    ),
    (
      'q_idx_covering',
      'indexing-views-triggers-procedures',
      'mcq',
      'A covering index can improve performance primarily because it:',
      'medium',
      1.00,
      90,
      '{"correctOptionKey":"A"}'::jsonb,
      NULL::jsonb,
      'A covering index can satisfy query columns without extra table lookups.',
      '{"seed":"phase2_step4","seed_key":"q_idx_covering","sample":true}'::jsonb
    ),
    (
      'q_sql_fill_students_over_80',
      'sql-dml-joins',
      'sql_fill',
      'Write a query to return name from students where marks are greater than 80.',
      'easy',
      1.00,
      120,
      '{"type":"syntax_only","reference":"SELECT name FROM students WHERE marks > 80;"}'::jsonb,
      '{"mustInclude":["SELECT","FROM","WHERE"],"forbidden":["DELETE","DROP","TRUNCATE"]}'::jsonb,
      'Expected shape: SELECT name FROM students WHERE marks > 80;',
      '{"seed":"phase2_step4","seed_key":"q_sql_fill_students_over_80","sample":true}'::jsonb
    ),
    (
      'q_sql_fill_department_count',
      'aggregation-subqueries',
      'sql_fill',
      'Write a query to show each department_id with employee count from employees.',
      'medium',
      1.00,
      150,
      '{"type":"syntax_only","reference":"SELECT department_id, COUNT(*) AS employee_count FROM employees GROUP BY department_id;"}'::jsonb,
      '{"mustInclude":["SELECT","COUNT","FROM","GROUP BY"],"forbidden":["DELETE","DROP","TRUNCATE"]}'::jsonb,
      'Expected shape: SELECT department_id, COUNT(*) ... GROUP BY department_id.',
      '{"seed":"phase2_step4","seed_key":"q_sql_fill_department_count","sample":true}'::jsonb
    ),
    (
      'q_sql_fill_create_courses',
      'sql-ddl-constraints',
      'sql_fill',
      'Write SQL to create table courses with id as primary key and title as NOT NULL text.',
      'medium',
      1.00,
      150,
      '{"type":"syntax_only","reference":"CREATE TABLE courses (id INT PRIMARY KEY, title TEXT NOT NULL);"}'::jsonb,
      '{"mustInclude":["CREATE TABLE","PRIMARY KEY","NOT NULL"],"forbidden":["DROP TABLE"]}'::jsonb,
      'Expected shape: CREATE TABLE courses (... id ... PRIMARY KEY ... title ... NOT NULL ...).',
      '{"seed":"phase2_step4","seed_key":"q_sql_fill_create_courses","sample":true}'::jsonb
    ),
    (
      'q_sql_fill_commit_transfer',
      'transactions-concurrency-control',
      'sql_fill',
      'Write SQL statements to start a transaction, update account balance, and commit.',
      'medium',
      1.00,
      180,
      '{"type":"syntax_only","reference":"BEGIN; UPDATE accounts SET balance = balance - 100 WHERE id = 1; COMMIT;"}'::jsonb,
      '{"mustInclude":["BEGIN","UPDATE","COMMIT"],"forbidden":["DROP","TRUNCATE"]}'::jsonb,
      'Expected shape includes BEGIN, UPDATE accounts ..., and COMMIT.',
      '{"seed":"phase2_step4","seed_key":"q_sql_fill_commit_transfer","sample":true}'::jsonb
    )
)
INSERT INTO question_bank (
  topic_id,
  question_type,
  prompt,
  difficulty,
  marks,
  expected_time_sec,
  answer_key,
  syntax_rules,
  explanation,
  tags,
  status,
  version,
  created_by
)
SELECT
  t.id,
  qs.question_type_value::question_type,
  qs.prompt,
  qs.difficulty,
  qs.marks::numeric(5,2),
  qs.expected_time_sec,
  qs.answer_key,
  qs.syntax_rules,
  qs.explanation,
  qs.tags,
  'approved'::question_status,
  1,
  NULL
FROM question_seed qs
JOIN topics t ON t.slug = qs.topic_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM question_bank qb
  WHERE qb.tags ->> 'seed_key' = qs.seed_key
);

WITH option_seed (seed_key, option_key, option_text, is_correct, display_order) AS (
  VALUES
    ('q_rmf_pk', 'A', 'Foreign key', false, 1),
    ('q_rmf_pk', 'B', 'Primary key', true, 2),
    ('q_rmf_pk', 'C', 'Candidate key with NULL values', false, 3),
    ('q_rmf_pk', 'D', 'Composite attribute', false, 4),

    ('q_er_cardinality', 'A', 'One-to-many', true, 1),
    ('q_er_cardinality', 'B', 'Many-to-many only', false, 2),
    ('q_er_cardinality', 'C', 'One-to-one mandatory', false, 3),
    ('q_er_cardinality', 'D', 'Zero-to-one only', false, 4),

    ('q_ra_selection', 'A', 'Projection (pi)', false, 1),
    ('q_ra_selection', 'B', 'Join (bowtie)', false, 2),
    ('q_ra_selection', 'C', 'Selection (sigma)', true, 3),
    ('q_ra_selection', 'D', 'Union (union)', false, 4),

    ('q_trc_free_var', 'A', 'A variable scoped only inside an existential quantifier', false, 1),
    ('q_trc_free_var', 'B', 'A relation name in the schema', false, 2),
    ('q_trc_free_var', 'C', 'A reserved SQL keyword', false, 3),
    ('q_trc_free_var', 'D', 'A value-binding variable used in the output condition', true, 4),

    ('q_sql_ddl_not_null', 'A', 'UNIQUE', false, 1),
    ('q_sql_ddl_not_null', 'B', 'NOT NULL', true, 2),
    ('q_sql_ddl_not_null', 'C', 'DEFAULT', false, 3),
    ('q_sql_ddl_not_null', 'D', 'CHECK', false, 4),

    ('q_sql_dml_left_join', 'A', 'All rows from the left table', true, 1),
    ('q_sql_dml_left_join', 'B', 'Only matched rows from both tables', false, 2),
    ('q_sql_dml_left_join', 'C', 'All rows from the right table', false, 3),
    ('q_sql_dml_left_join', 'D', 'Only rows with NULL in join key', false, 4),

    ('q_agg_groupby', 'A', 'ORDER BY', false, 1),
    ('q_agg_groupby', 'B', 'WHERE', false, 2),
    ('q_agg_groupby', 'C', 'GROUP BY', true, 3),
    ('q_agg_groupby', 'D', 'LIMIT', false, 4),

    ('q_norm_3nf', 'A', 'Every non-key must be indexed', false, 1),
    ('q_norm_3nf', 'B', 'Every key must be composite', false, 2),
    ('q_norm_3nf', 'C', 'Every table must have exactly three columns', false, 3),
    ('q_norm_3nf', 'D', 'No transitive dependency of non-key attributes', true, 4),

    ('q_tx_isolation', 'A', 'Phantom read', false, 1),
    ('q_tx_isolation', 'B', 'Dirty read', true, 2),
    ('q_tx_isolation', 'C', 'Write skew', false, 3),
    ('q_tx_isolation', 'D', 'Lost update only', false, 4),

    ('q_idx_covering', 'A', 'Avoids extra heap lookups for selected columns', true, 1),
    ('q_idx_covering', 'B', 'Guarantees serializable isolation', false, 2),
    ('q_idx_covering', 'C', 'Automatically partitions tables', false, 3),
    ('q_idx_covering', 'D', 'Eliminates all write costs', false, 4)
)
INSERT INTO question_options (question_id, option_key, option_text, is_correct, display_order)
SELECT
  qb.id,
  os.option_key,
  os.option_text,
  os.is_correct,
  os.display_order
FROM option_seed os
JOIN question_bank qb ON qb.tags ->> 'seed_key' = os.seed_key
WHERE NOT EXISTS (
  SELECT 1
  FROM question_options qo
  WHERE qo.question_id = qb.id
    AND qo.option_key = os.option_key
);