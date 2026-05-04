-- Phase 2, Step 7: add more approved MCQ + short SQL syntax questions for mixed randomization.

WITH topic_seed (slug, name, description) AS (
  VALUES
    (
      'dbms-storage-hierarchy',
      'DBMS Storage Hierarchy',
      'Memory and disk hierarchy, indexing, and physical optimization basics.'
    ),
    (
      'plsql-cursors-exceptions',
      'PL/SQL Cursors and Exception Handling',
      'Cursor control flow and exception handling syntax for procedural SQL.'
    )
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
      'q7_mcq_dbms_begin_tx',
      'relational-model-fundamentals',
      'mcq',
      'Which SQL command starts an explicit transaction block in PostgreSQL?',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"A"}'::jsonb,
      NULL::jsonb,
      'BEGIN starts an explicit transaction block.',
      '{"seed":"phase2_step7","seed_key":"q7_mcq_dbms_begin_tx","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_mcq_norm_2nf',
      'normalization-functional-dependencies',
      'mcq',
      'Eliminating partial dependency is the main goal of which normal form?',
      'medium',
      1.00,
      75,
      '{"correctOptionKey":"B"}'::jsonb,
      NULL::jsonb,
      '2NF removes partial dependency on a composite key.',
      '{"seed":"phase2_step7","seed_key":"q7_mcq_norm_2nf","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_mcq_trigger_before',
      'indexing-views-triggers-procedures',
      'mcq',
      'A BEFORE UPDATE trigger executes at which point?',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"C"}'::jsonb,
      NULL::jsonb,
      'BEFORE triggers run before the modified row is written.',
      '{"seed":"phase2_step7","seed_key":"q7_mcq_trigger_before","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_mcq_function_returns',
      'indexing-views-triggers-procedures',
      'mcq',
      'Which clause specifies the output type of a SQL function?',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"D"}'::jsonb,
      NULL::jsonb,
      'RETURNS defines the function result type.',
      '{"seed":"phase2_step7","seed_key":"q7_mcq_function_returns","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_mcq_exception_block',
      'plsql-cursors-exceptions',
      'mcq',
      'In PL/pgSQL, which keyword begins the runtime error handling section?',
      'medium',
      1.00,
      75,
      '{"correctOptionKey":"B"}'::jsonb,
      NULL::jsonb,
      'EXCEPTION starts the error handling section in a block.',
      '{"seed":"phase2_step7","seed_key":"q7_mcq_exception_block","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_mcq_aggregate_having',
      'aggregation-subqueries',
      'mcq',
      'Which clause filters grouped results after GROUP BY?',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"A"}'::jsonb,
      NULL::jsonb,
      'HAVING filters group-level results.',
      '{"seed":"phase2_step7","seed_key":"q7_mcq_aggregate_having","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_mcq_cursor_fetch',
      'plsql-cursors-exceptions',
      'mcq',
      'Which statement reads the next row from an open cursor?',
      'medium',
      1.00,
      75,
      '{"correctOptionKey":"C"}'::jsonb,
      NULL::jsonb,
      'FETCH retrieves a row from an open cursor.',
      '{"seed":"phase2_step7","seed_key":"q7_mcq_cursor_fetch","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_mcq_constraint_fk',
      'sql-ddl-constraints',
      'mcq',
      'A FOREIGN KEY constraint ensures that child values:',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"D"}'::jsonb,
      NULL::jsonb,
      'Foreign keys enforce referential integrity to parent keys.',
      '{"seed":"phase2_step7","seed_key":"q7_mcq_constraint_fk","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_mcq_setop_union_all',
      'sql-dml-joins',
      'mcq',
      'UNION ALL differs from UNION because it:',
      'easy',
      1.00,
      60,
      '{"correctOptionKey":"B"}'::jsonb,
      NULL::jsonb,
      'UNION ALL keeps duplicate rows.',
      '{"seed":"phase2_step7","seed_key":"q7_mcq_setop_union_all","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_mcq_storage_index',
      'dbms-storage-hierarchy',
      'mcq',
      'Which DB object primarily reduces disk page reads for selective lookups?',
      'medium',
      1.00,
      75,
      '{"correctOptionKey":"A"}'::jsonb,
      NULL::jsonb,
      'Indexes reduce data page scans for selective predicates.',
      '{"seed":"phase2_step7","seed_key":"q7_mcq_storage_index","sample":true,"focus":"syntax"}'::jsonb
    ),

    (
      'q7_sql_create_dept_constraints',
      'sql-ddl-constraints',
      'sql_fill',
      'Write SQL to create table departments with id as primary key and name as UNIQUE NOT NULL.',
      'easy',
      1.00,
      120,
      '{"correctAnswer":"CREATE TABLE departments (id INT PRIMARY KEY, name TEXT UNIQUE NOT NULL);","expectedKeywords":["create table","primary key","unique","not null"]}'::jsonb,
      '{"mustInclude":["CREATE TABLE","PRIMARY KEY","UNIQUE","NOT NULL"],"forbidden":["DROP TABLE","TRUNCATE"]}'::jsonb,
      'Short syntax task for constraints and DDL.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_create_dept_constraints","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_add_fk_student',
      'sql-ddl-constraints',
      'sql_fill',
      'Write SQL to add a foreign key from enrollments(student_id) to students(id).',
      'easy',
      1.00,
      120,
      '{"correctAnswer":"ALTER TABLE enrollments ADD CONSTRAINT fk_enrollment_student FOREIGN KEY (student_id) REFERENCES students(id);","expectedKeywords":["alter table","foreign key","references students"]}'::jsonb,
      '{"mustInclude":["ALTER TABLE","FOREIGN KEY","REFERENCES"],"forbidden":["DROP TABLE","TRUNCATE"]}'::jsonb,
      'Short syntax task for referential integrity.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_add_fk_student","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_group_by_having',
      'aggregation-subqueries',
      'sql_fill',
      'Write SQL to show department_id and employee count where count is at least 5.',
      'easy',
      1.00,
      130,
      '{"correctAnswer":"SELECT department_id, COUNT(*) AS total_employees FROM employees GROUP BY department_id HAVING COUNT(*) >= 5;","expectedKeywords":["count","group by","having"]}'::jsonb,
      '{"mustInclude":["SELECT","COUNT","GROUP BY","HAVING"],"forbidden":["DELETE","DROP","TRUNCATE"]}'::jsonb,
      'Short syntax task for aggregate + HAVING.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_group_by_having","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_avg_salary',
      'aggregation-subqueries',
      'sql_fill',
      'Write SQL to show each department_id with average salary.',
      'easy',
      1.00,
      120,
      '{"correctAnswer":"SELECT department_id, AVG(salary) AS avg_salary FROM employees GROUP BY department_id;","expectedKeywords":["avg","group by","department_id"]}'::jsonb,
      '{"mustInclude":["SELECT","AVG","GROUP BY"],"forbidden":["DELETE","DROP","TRUNCATE"]}'::jsonb,
      'Short syntax task for aggregate functions.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_avg_salary","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_union_ids',
      'sql-dml-joins',
      'sql_fill',
      'Write SQL to combine ids from alumni and students using UNION.',
      'easy',
      1.00,
      120,
      '{"correctAnswer":"SELECT id FROM alumni UNION SELECT id FROM students;","expectedKeywords":["select id","union","from alumni"]}'::jsonb,
      '{"mustInclude":["SELECT","UNION"],"forbidden":["DELETE","DROP","TRUNCATE"]}'::jsonb,
      'Short syntax task for set operations.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_union_ids","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_intersect_courses',
      'sql-dml-joins',
      'sql_fill',
      'Write SQL to find common course_id values in enrollments_2023 and enrollments_2024.',
      'medium',
      1.00,
      135,
      '{"correctAnswer":"SELECT course_id FROM enrollments_2023 INTERSECT SELECT course_id FROM enrollments_2024;","expectedKeywords":["intersect","course_id"]}'::jsonb,
      '{"mustInclude":["SELECT","INTERSECT"],"forbidden":["DELETE","DROP","TRUNCATE"]}'::jsonb,
      'Short syntax task for INTERSECT set operation.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_intersect_courses","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_except_courses',
      'sql-dml-joins',
      'sql_fill',
      'Write SQL to find course_id values in enrollments_2024 that are not in enrollments_2023.',
      'medium',
      1.00,
      135,
      '{"correctAnswer":"SELECT course_id FROM enrollments_2024 EXCEPT SELECT course_id FROM enrollments_2023;","expectedKeywords":["except","course_id"]}'::jsonb,
      '{"mustInclude":["SELECT","EXCEPT"],"forbidden":["DELETE","DROP","TRUNCATE"]}'::jsonb,
      'Short syntax task for EXCEPT set operation.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_except_courses","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_create_function_tax',
      'indexing-views-triggers-procedures',
      'sql_fill',
      'Write SQL to create function add_tax(amount numeric) that returns amount * 1.12.',
      'medium',
      1.00,
      150,
      '{"correctAnswer":"CREATE OR REPLACE FUNCTION add_tax(amount numeric) RETURNS numeric AS $$ SELECT amount * 1.12; $$ LANGUAGE sql;","expectedKeywords":["create or replace function","returns numeric","language sql"]}'::jsonb,
      '{"mustInclude":["CREATE OR REPLACE FUNCTION","RETURNS","LANGUAGE"],"forbidden":["DROP FUNCTION"]}'::jsonb,
      'Short syntax task for SQL function creation.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_create_function_tax","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_call_function_tax',
      'indexing-views-triggers-procedures',
      'sql_fill',
      'Write SQL to call add_tax for the value 100.',
      'easy',
      1.00,
      90,
      '{"correctAnswer":"SELECT add_tax(100);","expectedKeywords":["select","add_tax"]}'::jsonb,
      '{"mustInclude":["SELECT","add_tax"],"forbidden":["DROP FUNCTION"]}'::jsonb,
      'Short syntax task for function usage.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_call_function_tax","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_create_trigger_function',
      'indexing-views-triggers-procedures',
      'sql_fill',
      'Write SQL to create trigger function set_updated_at() that updates NEW.updated_at with now().',
      'medium',
      1.00,
      165,
      '{"correctAnswer":"CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;","expectedKeywords":["returns trigger","new.updated_at","language plpgsql"]}'::jsonb,
      '{"mustInclude":["CREATE OR REPLACE FUNCTION","RETURNS trigger","LANGUAGE plpgsql"],"forbidden":["DROP TABLE"]}'::jsonb,
      'Short syntax task for trigger function body.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_create_trigger_function","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_create_trigger_students',
      'indexing-views-triggers-procedures',
      'sql_fill',
      'Write SQL to create BEFORE UPDATE trigger trg_set_updated_at on students using set_updated_at().',
      'medium',
      1.00,
      150,
      '{"correctAnswer":"CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION set_updated_at();","expectedKeywords":["create trigger","before update","execute function"]}'::jsonb,
      '{"mustInclude":["CREATE TRIGGER","BEFORE UPDATE","EXECUTE FUNCTION"],"forbidden":["DROP TABLE"]}'::jsonb,
      'Short syntax task for trigger definition.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_create_trigger_students","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_cursor_block',
      'plsql-cursors-exceptions',
      'sql_fill',
      'Write a PL/pgSQL DO block that declares cursor student_cur, opens it, fetches one row into v_id, then closes it.',
      'hard',
      1.00,
      180,
      '{"correctAnswer":"DO $$ DECLARE student_cur CURSOR FOR SELECT id FROM students; v_id INT; BEGIN OPEN student_cur; FETCH student_cur INTO v_id; CLOSE student_cur; END $$;","expectedKeywords":["cursor","open","fetch","close"]}'::jsonb,
      '{"mustInclude":["CURSOR","OPEN","FETCH","CLOSE"],"forbidden":["DROP TABLE"]}'::jsonb,
      'Short syntax task for cursor lifecycle commands.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_cursor_block","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_exception_block',
      'plsql-cursors-exceptions',
      'sql_fill',
      'Write a PL/pgSQL DO block that catches division_by_zero using an EXCEPTION section.',
      'hard',
      1.00,
      180,
      '{"correctAnswer":"DO $$ BEGIN PERFORM 1 / 0; EXCEPTION WHEN division_by_zero THEN NULL; END $$;","expectedKeywords":["exception","division_by_zero","perform"]}'::jsonb,
      '{"mustInclude":["DO $$","EXCEPTION","division_by_zero"],"forbidden":["DROP TABLE"]}'::jsonb,
      'Short syntax task for exception handling.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_exception_block","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_create_index_storage',
      'dbms-storage-hierarchy',
      'sql_fill',
      'Write SQL to create an index on orders(created_at).',
      'easy',
      1.00,
      90,
      '{"correctAnswer":"CREATE INDEX idx_orders_created_at ON orders(created_at);","expectedKeywords":["create index","orders","created_at"]}'::jsonb,
      '{"mustInclude":["CREATE INDEX","ON"],"forbidden":["DROP TABLE"]}'::jsonb,
      'Short syntax task tied to storage-level optimization.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_create_index_storage","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_explain_lookup',
      'dbms-storage-hierarchy',
      'sql_fill',
      'Write SQL to inspect execution plan for selecting recent orders by created_at.',
      'medium',
      1.00,
      120,
      '{"correctAnswer":"EXPLAIN ANALYZE SELECT * FROM orders WHERE created_at >= CURRENT_DATE - 7;","expectedKeywords":["explain analyze","where","created_at"]}'::jsonb,
      '{"mustInclude":["EXPLAIN","SELECT","WHERE"],"forbidden":["DROP TABLE"]}'::jsonb,
      'Short syntax task for plan analysis and storage access.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_explain_lookup","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_create_junction_table',
      'normalization-functional-dependencies',
      'sql_fill',
      'Write SQL to create junction table student_course with composite primary key (student_id, course_id).',
      'medium',
      1.00,
      140,
      '{"correctAnswer":"CREATE TABLE student_course (student_id INT, course_id INT, PRIMARY KEY (student_id, course_id));","expectedKeywords":["create table","primary key","student_id","course_id"]}'::jsonb,
      '{"mustInclude":["CREATE TABLE","PRIMARY KEY"],"forbidden":["DROP TABLE"]}'::jsonb,
      'Short syntax task for normalization-friendly schema design.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_create_junction_table","sample":true,"focus":"syntax"}'::jsonb
    ),
    (
      'q7_sql_count_distinct_students',
      'aggregation-subqueries',
      'sql_fill',
      'Write SQL to count distinct student_id values in enrollments.',
      'easy',
      1.00,
      100,
      '{"correctAnswer":"SELECT COUNT(DISTINCT student_id) AS distinct_students FROM enrollments;","expectedKeywords":["count","distinct","student_id"]}'::jsonb,
      '{"mustInclude":["COUNT","DISTINCT","FROM"],"forbidden":["DELETE","DROP","TRUNCATE"]}'::jsonb,
      'Short syntax task for aggregate distinct usage.',
      '{"seed":"phase2_step7","seed_key":"q7_sql_count_distinct_students","sample":true,"focus":"syntax"}'::jsonb
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
    ('q7_mcq_dbms_begin_tx', 'A', 'BEGIN', true, 1),
    ('q7_mcq_dbms_begin_tx', 'B', 'COMMIT', false, 2),
    ('q7_mcq_dbms_begin_tx', 'C', 'SAVEPOINT', false, 3),
    ('q7_mcq_dbms_begin_tx', 'D', 'ROLLBACK', false, 4),

    ('q7_mcq_norm_2nf', 'A', '1NF', false, 1),
    ('q7_mcq_norm_2nf', 'B', '2NF', true, 2),
    ('q7_mcq_norm_2nf', 'C', '3NF', false, 3),
    ('q7_mcq_norm_2nf', 'D', 'BCNF', false, 4),

    ('q7_mcq_trigger_before', 'A', 'After transaction commit', false, 1),
    ('q7_mcq_trigger_before', 'B', 'After statement execution finishes', false, 2),
    ('q7_mcq_trigger_before', 'C', 'Before the row update is applied', true, 3),
    ('q7_mcq_trigger_before', 'D', 'Only when rollback occurs', false, 4),

    ('q7_mcq_function_returns', 'A', 'DECLARE', false, 1),
    ('q7_mcq_function_returns', 'B', 'LANGUAGE', false, 2),
    ('q7_mcq_function_returns', 'C', 'PARAMETERS', false, 3),
    ('q7_mcq_function_returns', 'D', 'RETURNS', true, 4),

    ('q7_mcq_exception_block', 'A', 'IF', false, 1),
    ('q7_mcq_exception_block', 'B', 'EXCEPTION', true, 2),
    ('q7_mcq_exception_block', 'C', 'ASSERT', false, 3),
    ('q7_mcq_exception_block', 'D', 'CATCH', false, 4),

    ('q7_mcq_aggregate_having', 'A', 'HAVING', true, 1),
    ('q7_mcq_aggregate_having', 'B', 'ORDER BY', false, 2),
    ('q7_mcq_aggregate_having', 'C', 'WHERE', false, 3),
    ('q7_mcq_aggregate_having', 'D', 'LIMIT', false, 4),

    ('q7_mcq_cursor_fetch', 'A', 'OPEN', false, 1),
    ('q7_mcq_cursor_fetch', 'B', 'DECLARE', false, 2),
    ('q7_mcq_cursor_fetch', 'C', 'FETCH', true, 3),
    ('q7_mcq_cursor_fetch', 'D', 'CLOSE', false, 4),

    ('q7_mcq_constraint_fk', 'A', 'Must be alphabetically ordered', false, 1),
    ('q7_mcq_constraint_fk', 'B', 'Cannot be indexed', false, 2),
    ('q7_mcq_constraint_fk', 'C', 'Can reference only NULL values', false, 3),
    ('q7_mcq_constraint_fk', 'D', 'Must match an existing parent key value', true, 4),

    ('q7_mcq_setop_union_all', 'A', 'Removes duplicate rows', false, 1),
    ('q7_mcq_setop_union_all', 'B', 'Keeps duplicate rows', true, 2),
    ('q7_mcq_setop_union_all', 'C', 'Works only on numeric columns', false, 3),
    ('q7_mcq_setop_union_all', 'D', 'Sorts rows automatically by id', false, 4),

    ('q7_mcq_storage_index', 'A', 'B-tree index', true, 1),
    ('q7_mcq_storage_index', 'B', 'View definition only', false, 2),
    ('q7_mcq_storage_index', 'C', 'Transaction log table', false, 3),
    ('q7_mcq_storage_index', 'D', 'Temp schema name', false, 4)
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
