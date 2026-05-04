-- Phase 2, Step 9: extend the MCQ question bank with more questions covering
-- joins, subqueries, window functions, indexing, and normalization.

WITH topic_seed (slug, name, description) AS (
  VALUES
    (
      'window-functions-analytics',
      'Window Functions and Analytics',
      'OVER, PARTITION BY, ranking, framing, and analytic SQL functions.'
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
    -- ============ JOINS ============
    (
      'q9_mcq_inner_join',
      'sql-dml-joins',
      'mcq',
      'Which join returns only rows that have matching values in both tables?',
      'easy', 1.00, 60,
      '{"correctOptionKey":"B"}'::jsonb, NULL::jsonb,
      'INNER JOIN keeps rows that satisfy the join condition in both tables.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_inner_join","sample":true,"focus":"joins"}'::jsonb
    ),
    (
      'q9_mcq_full_outer',
      'sql-dml-joins',
      'mcq',
      'A FULL OUTER JOIN returns:',
      'medium', 1.00, 75,
      '{"correctOptionKey":"D"}'::jsonb, NULL::jsonb,
      'FULL OUTER JOIN includes matched rows plus unmatched rows from both sides (with NULLs).',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_full_outer","sample":true,"focus":"joins"}'::jsonb
    ),
    (
      'q9_mcq_self_join',
      'sql-dml-joins',
      'mcq',
      'A self join is most useful when you need to:',
      'medium', 1.00, 75,
      '{"correctOptionKey":"A"}'::jsonb, NULL::jsonb,
      'A self join compares rows of the same table (e.g., employee-manager).',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_self_join","sample":true,"focus":"joins"}'::jsonb
    ),
    (
      'q9_mcq_cross_join',
      'sql-dml-joins',
      'mcq',
      'A CROSS JOIN between tables of n and m rows produces:',
      'easy', 1.00, 60,
      '{"correctOptionKey":"C"}'::jsonb, NULL::jsonb,
      'CROSS JOIN produces the Cartesian product of rows.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_cross_join","sample":true,"focus":"joins"}'::jsonb
    ),
    (
      'q9_mcq_natural_join',
      'sql-dml-joins',
      'mcq',
      'A NATURAL JOIN joins two tables on:',
      'medium', 1.00, 75,
      '{"correctOptionKey":"B"}'::jsonb, NULL::jsonb,
      'NATURAL JOIN uses all columns with matching names in both tables as the join condition.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_natural_join","sample":true,"focus":"joins"}'::jsonb
    ),
    (
      'q9_mcq_right_join',
      'sql-dml-joins',
      'mcq',
      'A RIGHT JOIN guarantees that:',
      'easy', 1.00, 60,
      '{"correctOptionKey":"A"}'::jsonb, NULL::jsonb,
      'RIGHT JOIN preserves all rows from the right table even when no match exists on the left.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_right_join","sample":true,"focus":"joins"}'::jsonb
    ),

    -- ============ SUBQUERIES ============
    (
      'q9_mcq_subq_correlated',
      'aggregation-subqueries',
      'mcq',
      'A correlated subquery is one that:',
      'medium', 1.00, 90,
      '{"correctOptionKey":"C"}'::jsonb, NULL::jsonb,
      'Correlated subqueries reference a column from the outer query and execute per outer row.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_subq_correlated","sample":true,"focus":"subqueries"}'::jsonb
    ),
    (
      'q9_mcq_subq_exists',
      'aggregation-subqueries',
      'mcq',
      'EXISTS in a subquery returns true when:',
      'easy', 1.00, 60,
      '{"correctOptionKey":"B"}'::jsonb, NULL::jsonb,
      'EXISTS is true if the subquery returns at least one row.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_subq_exists","sample":true,"focus":"subqueries"}'::jsonb
    ),
    (
      'q9_mcq_subq_scalar',
      'aggregation-subqueries',
      'mcq',
      'A scalar subquery must return:',
      'easy', 1.00, 60,
      '{"correctOptionKey":"A"}'::jsonb, NULL::jsonb,
      'A scalar subquery must return at most one row and one column.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_subq_scalar","sample":true,"focus":"subqueries"}'::jsonb
    ),
    (
      'q9_mcq_subq_in_vs_join',
      'aggregation-subqueries',
      'mcq',
      'Which technique is generally preferred for filtering by a list of distinct ids returned from another table?',
      'medium', 1.00, 90,
      '{"correctOptionKey":"D"}'::jsonb, NULL::jsonb,
      'IN-subquery and EXISTS / semi-join are typical choices; WHERE id IN (SELECT ...) is concise and clear.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_subq_in_vs_join","sample":true,"focus":"subqueries"}'::jsonb
    ),
    (
      'q9_mcq_subq_any_all',
      'aggregation-subqueries',
      'mcq',
      'WHERE salary > ALL (SELECT salary FROM employees WHERE dept = ''HR'') returns rows with salary that is:',
      'hard', 1.00, 105,
      '{"correctOptionKey":"C"}'::jsonb, NULL::jsonb,
      '> ALL means greater than every value returned by the subquery (i.e., greater than the max).',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_subq_any_all","sample":true,"focus":"subqueries"}'::jsonb
    ),

    -- ============ WINDOW FUNCTIONS ============
    (
      'q9_mcq_win_row_number',
      'window-functions-analytics',
      'mcq',
      'ROW_NUMBER() OVER (ORDER BY salary DESC) assigns:',
      'easy', 1.00, 75,
      '{"correctOptionKey":"A"}'::jsonb, NULL::jsonb,
      'ROW_NUMBER assigns a unique sequential integer to each row in the ordered window.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_win_row_number","sample":true,"focus":"window-functions"}'::jsonb
    ),
    (
      'q9_mcq_win_rank_vs_dense',
      'window-functions-analytics',
      'mcq',
      'When ties occur, RANK() and DENSE_RANK() differ in that:',
      'medium', 1.00, 90,
      '{"correctOptionKey":"B"}'::jsonb, NULL::jsonb,
      'RANK skips rank numbers after ties; DENSE_RANK keeps consecutive ranks.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_win_rank_vs_dense","sample":true,"focus":"window-functions"}'::jsonb
    ),
    (
      'q9_mcq_win_partition_by',
      'window-functions-analytics',
      'mcq',
      'PARTITION BY in a window function:',
      'medium', 1.00, 90,
      '{"correctOptionKey":"C"}'::jsonb, NULL::jsonb,
      'PARTITION BY divides the rows into independent groups for the window function to compute over.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_win_partition_by","sample":true,"focus":"window-functions"}'::jsonb
    ),
    (
      'q9_mcq_win_lag',
      'window-functions-analytics',
      'mcq',
      'LAG(amount, 1) OVER (ORDER BY order_date) returns:',
      'medium', 1.00, 90,
      '{"correctOptionKey":"A"}'::jsonb, NULL::jsonb,
      'LAG returns the value from the previous row in the ordered window.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_win_lag","sample":true,"focus":"window-functions"}'::jsonb
    ),
    (
      'q9_mcq_win_running_total',
      'window-functions-analytics',
      'mcq',
      'Which expression computes a running total of amount ordered by order_date?',
      'hard', 1.00, 120,
      '{"correctOptionKey":"D"}'::jsonb, NULL::jsonb,
      'SUM(amount) OVER (ORDER BY order_date) gives a cumulative sum up to the current row.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_win_running_total","sample":true,"focus":"window-functions"}'::jsonb
    ),
    (
      'q9_mcq_win_ntile',
      'window-functions-analytics',
      'mcq',
      'NTILE(4) splits ordered rows into:',
      'medium', 1.00, 90,
      '{"correctOptionKey":"B"}'::jsonb, NULL::jsonb,
      'NTILE(n) divides ordered rows into n approximately equal buckets and labels them 1..n.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_win_ntile","sample":true,"focus":"window-functions"}'::jsonb
    ),

    -- ============ INDEXING ============
    (
      'q9_mcq_idx_btree_use',
      'indexing-views-triggers-procedures',
      'mcq',
      'A B-tree index is most effective for:',
      'easy', 1.00, 75,
      '{"correctOptionKey":"A"}'::jsonb, NULL::jsonb,
      'B-tree indexes excel at equality and range predicates on ordered data.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_idx_btree_use","sample":true,"focus":"indexing"}'::jsonb
    ),
    (
      'q9_mcq_idx_unique',
      'indexing-views-triggers-procedures',
      'mcq',
      'A UNIQUE index primarily provides:',
      'easy', 1.00, 60,
      '{"correctOptionKey":"C"}'::jsonb, NULL::jsonb,
      'A UNIQUE index enforces value uniqueness while accelerating equality lookups.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_idx_unique","sample":true,"focus":"indexing"}'::jsonb
    ),
    (
      'q9_mcq_idx_composite_order',
      'indexing-views-triggers-procedures',
      'mcq',
      'A composite index on (a, b, c) is most useful for predicates that:',
      'medium', 1.00, 90,
      '{"correctOptionKey":"B"}'::jsonb, NULL::jsonb,
      'Composite indexes are usable when the leading prefix of the key is referenced by the query.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_idx_composite_order","sample":true,"focus":"indexing"}'::jsonb
    ),
    (
      'q9_mcq_idx_writes_cost',
      'indexing-views-triggers-procedures',
      'mcq',
      'Adding many indexes to a table primarily increases the cost of:',
      'medium', 1.00, 90,
      '{"correctOptionKey":"D"}'::jsonb, NULL::jsonb,
      'Each additional index must be maintained on INSERT, UPDATE (of indexed columns), and DELETE.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_idx_writes_cost","sample":true,"focus":"indexing"}'::jsonb
    ),
    (
      'q9_mcq_idx_hash_use',
      'indexing-views-triggers-procedures',
      'mcq',
      'A hash index is best suited for:',
      'medium', 1.00, 90,
      '{"correctOptionKey":"A"}'::jsonb, NULL::jsonb,
      'Hash indexes shine on equality lookups but cannot serve range queries.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_idx_hash_use","sample":true,"focus":"indexing"}'::jsonb
    ),
    (
      'q9_mcq_idx_partial',
      'indexing-views-triggers-procedures',
      'mcq',
      'A partial index in PostgreSQL is created by adding which clause?',
      'medium', 1.00, 90,
      '{"correctOptionKey":"B"}'::jsonb, NULL::jsonb,
      'A partial index uses a WHERE clause to index only a subset of rows.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_idx_partial","sample":true,"focus":"indexing"}'::jsonb
    ),

    -- ============ NORMALIZATION ============
    (
      'q9_mcq_norm_1nf',
      'normalization-functional-dependencies',
      'mcq',
      'A relation is in 1NF when:',
      'easy', 1.00, 75,
      '{"correctOptionKey":"C"}'::jsonb, NULL::jsonb,
      '1NF requires atomic values and no repeating groups in any cell.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_norm_1nf","sample":true,"focus":"normalization"}'::jsonb
    ),
    (
      'q9_mcq_norm_partial_dep',
      'normalization-functional-dependencies',
      'mcq',
      'Removing partial functional dependencies from a 1NF relation produces:',
      'medium', 1.00, 90,
      '{"correctOptionKey":"B"}'::jsonb, NULL::jsonb,
      'Removing partial dependencies on a composite key yields 2NF.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_norm_partial_dep","sample":true,"focus":"normalization"}'::jsonb
    ),
    (
      'q9_mcq_norm_bcnf',
      'normalization-functional-dependencies',
      'mcq',
      'A relation is in BCNF if for every non-trivial functional dependency X -> Y:',
      'hard', 1.00, 120,
      '{"correctOptionKey":"A"}'::jsonb, NULL::jsonb,
      'BCNF requires X to be a superkey for every non-trivial FD X -> Y.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_norm_bcnf","sample":true,"focus":"normalization"}'::jsonb
    ),
    (
      'q9_mcq_norm_lossless',
      'normalization-functional-dependencies',
      'mcq',
      'A decomposition is lossless-join when:',
      'medium', 1.00, 90,
      '{"correctOptionKey":"C"}'::jsonb, NULL::jsonb,
      'Lossless-join means the natural join of decomposed relations reconstructs the original relation exactly.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_norm_lossless","sample":true,"focus":"normalization"}'::jsonb
    ),
    (
      'q9_mcq_norm_4nf',
      'normalization-functional-dependencies',
      'mcq',
      '4NF specifically eliminates which kind of dependency?',
      'hard', 1.00, 120,
      '{"correctOptionKey":"D"}'::jsonb, NULL::jsonb,
      '4NF removes non-trivial multivalued dependencies that are not implied by a superkey.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_norm_4nf","sample":true,"focus":"normalization"}'::jsonb
    ),
    (
      'q9_mcq_norm_anomaly',
      'normalization-functional-dependencies',
      'mcq',
      'Which anomaly does normalization most directly address?',
      'easy', 1.00, 60,
      '{"correctOptionKey":"A"}'::jsonb, NULL::jsonb,
      'Normalization reduces redundancy and the resulting update/insert/delete anomalies.',
      '{"seed":"phase2_step9","seed_key":"q9_mcq_norm_anomaly","sample":true,"focus":"normalization"}'::jsonb
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
    -- INNER JOIN
    ('q9_mcq_inner_join', 'A', 'All rows from the left table only', false, 1),
    ('q9_mcq_inner_join', 'B', 'Only rows that match in both tables', true, 2),
    ('q9_mcq_inner_join', 'C', 'All rows from both tables', false, 3),
    ('q9_mcq_inner_join', 'D', 'No rows when nothing matches', false, 4),

    -- FULL OUTER JOIN
    ('q9_mcq_full_outer', 'A', 'Only matched rows from both tables', false, 1),
    ('q9_mcq_full_outer', 'B', 'Only unmatched rows from both tables', false, 2),
    ('q9_mcq_full_outer', 'C', 'All rows from the left table only', false, 3),
    ('q9_mcq_full_outer', 'D', 'Matched rows plus unmatched rows from both tables (with NULLs)', true, 4),

    -- SELF JOIN
    ('q9_mcq_self_join', 'A', 'Compare rows of the same table to each other', true, 1),
    ('q9_mcq_self_join', 'B', 'Combine two unrelated tables', false, 2),
    ('q9_mcq_self_join', 'C', 'Aggregate rows by a single column', false, 3),
    ('q9_mcq_self_join', 'D', 'Replace UNION ALL', false, 4),

    -- CROSS JOIN
    ('q9_mcq_cross_join', 'A', 'Exactly n rows', false, 1),
    ('q9_mcq_cross_join', 'B', 'Exactly m rows', false, 2),
    ('q9_mcq_cross_join', 'C', 'n * m rows (Cartesian product)', true, 3),
    ('q9_mcq_cross_join', 'D', 'n + m rows', false, 4),

    -- NATURAL JOIN
    ('q9_mcq_natural_join', 'A', 'All primary keys only', false, 1),
    ('q9_mcq_natural_join', 'B', 'All columns with matching names', true, 2),
    ('q9_mcq_natural_join', 'C', 'A user-specified column list', false, 3),
    ('q9_mcq_natural_join', 'D', 'No columns; it returns the Cartesian product', false, 4),

    -- RIGHT JOIN
    ('q9_mcq_right_join', 'A', 'All rows from the right table are kept', true, 1),
    ('q9_mcq_right_join', 'B', 'Only rows with NULL keys are returned', false, 2),
    ('q9_mcq_right_join', 'C', 'Only matched rows from the right table', false, 3),
    ('q9_mcq_right_join', 'D', 'Only the first 10 rows from the right table', false, 4),

    -- CORRELATED SUBQUERY
    ('q9_mcq_subq_correlated', 'A', 'Always runs once before the outer query', false, 1),
    ('q9_mcq_subq_correlated', 'B', 'Cannot reference outer query columns', false, 2),
    ('q9_mcq_subq_correlated', 'C', 'References an outer query column and is evaluated per outer row', true, 3),
    ('q9_mcq_subq_correlated', 'D', 'Must always return more than one row', false, 4),

    -- EXISTS
    ('q9_mcq_subq_exists', 'A', 'The subquery returns NULL', false, 1),
    ('q9_mcq_subq_exists', 'B', 'The subquery returns at least one row', true, 2),
    ('q9_mcq_subq_exists', 'C', 'The subquery returns no rows', false, 3),
    ('q9_mcq_subq_exists', 'D', 'The subquery returns exactly one row', false, 4),

    -- SCALAR SUBQUERY
    ('q9_mcq_subq_scalar', 'A', 'At most one row and one column', true, 1),
    ('q9_mcq_subq_scalar', 'B', 'Multiple rows and a single column', false, 2),
    ('q9_mcq_subq_scalar', 'C', 'Multiple columns and a single row', false, 3),
    ('q9_mcq_subq_scalar', 'D', 'Always exactly zero rows', false, 4),

    -- IN vs JOIN
    ('q9_mcq_subq_in_vs_join', 'A', 'GROUP BY with HAVING COUNT(*) = 1', false, 1),
    ('q9_mcq_subq_in_vs_join', 'B', 'A CROSS JOIN with WHERE', false, 2),
    ('q9_mcq_subq_in_vs_join', 'C', 'A LEFT JOIN with IS NULL', false, 3),
    ('q9_mcq_subq_in_vs_join', 'D', 'WHERE id IN (SELECT id FROM other_table)', true, 4),

    -- ANY / ALL
    ('q9_mcq_subq_any_all', 'A', 'Greater than the average HR salary', false, 1),
    ('q9_mcq_subq_any_all', 'B', 'Greater than the minimum HR salary', false, 2),
    ('q9_mcq_subq_any_all', 'C', 'Greater than the maximum HR salary', true, 3),
    ('q9_mcq_subq_any_all', 'D', 'Equal to any HR salary', false, 4),

    -- ROW_NUMBER
    ('q9_mcq_win_row_number', 'A', 'A unique sequential integer to each row in the ordered window', true, 1),
    ('q9_mcq_win_row_number', 'B', 'The same number to tied rows', false, 2),
    ('q9_mcq_win_row_number', 'C', 'A random number to each row', false, 3),
    ('q9_mcq_win_row_number', 'D', 'NULL when ORDER BY is omitted', false, 4),

    -- RANK vs DENSE_RANK
    ('q9_mcq_win_rank_vs_dense', 'A', 'RANK keeps consecutive ranks; DENSE_RANK skips numbers', false, 1),
    ('q9_mcq_win_rank_vs_dense', 'B', 'RANK skips numbers after ties; DENSE_RANK keeps them consecutive', true, 2),
    ('q9_mcq_win_rank_vs_dense', 'C', 'They are identical', false, 3),
    ('q9_mcq_win_rank_vs_dense', 'D', 'RANK requires PARTITION BY; DENSE_RANK does not', false, 4),

    -- PARTITION BY
    ('q9_mcq_win_partition_by', 'A', 'Sorts the result set globally', false, 1),
    ('q9_mcq_win_partition_by', 'B', 'Removes duplicate rows', false, 2),
    ('q9_mcq_win_partition_by', 'C', 'Splits rows into independent groups for the window function', true, 3),
    ('q9_mcq_win_partition_by', 'D', 'Replaces GROUP BY in aggregate queries', false, 4),

    -- LAG
    ('q9_mcq_win_lag', 'A', 'The value from the previous row in the ordered window', true, 1),
    ('q9_mcq_win_lag', 'B', 'The value from the next row', false, 2),
    ('q9_mcq_win_lag', 'C', 'The first value in the partition', false, 3),
    ('q9_mcq_win_lag', 'D', 'NULL for every row', false, 4),

    -- Running total
    ('q9_mcq_win_running_total', 'A', 'COUNT(amount) OVER ()', false, 1),
    ('q9_mcq_win_running_total', 'B', 'SUM(amount) GROUP BY order_date', false, 2),
    ('q9_mcq_win_running_total', 'C', 'AVG(amount) OVER (ORDER BY order_date)', false, 3),
    ('q9_mcq_win_running_total', 'D', 'SUM(amount) OVER (ORDER BY order_date)', true, 4),

    -- NTILE
    ('q9_mcq_win_ntile', 'A', '4 partitions of arbitrary size', false, 1),
    ('q9_mcq_win_ntile', 'B', '4 approximately equal buckets labelled 1..4', true, 2),
    ('q9_mcq_win_ntile', 'C', 'A single 4-row sample', false, 3),
    ('q9_mcq_win_ntile', 'D', 'Top 4 rows by ORDER BY', false, 4),

    -- B-tree
    ('q9_mcq_idx_btree_use', 'A', 'Equality and range queries on ordered data', true, 1),
    ('q9_mcq_idx_btree_use', 'B', 'Full-text search on long documents', false, 2),
    ('q9_mcq_idx_btree_use', 'C', 'Spatial range queries', false, 3),
    ('q9_mcq_idx_btree_use', 'D', 'Bitmap intersection only', false, 4),

    -- UNIQUE INDEX
    ('q9_mcq_idx_unique', 'A', 'A guarantee of physical row order', false, 1),
    ('q9_mcq_idx_unique', 'B', 'Automatic data compression', false, 2),
    ('q9_mcq_idx_unique', 'C', 'Value uniqueness plus equality lookup speed', true, 3),
    ('q9_mcq_idx_unique', 'D', 'Foreign key cascading', false, 4),

    -- COMPOSITE INDEX
    ('q9_mcq_idx_composite_order', 'A', 'Reference c only', false, 1),
    ('q9_mcq_idx_composite_order', 'B', 'Reference the leading prefix (a, or a+b, or a+b+c)', true, 2),
    ('q9_mcq_idx_composite_order', 'C', 'Reference any column in any order', false, 3),
    ('q9_mcq_idx_composite_order', 'D', 'Reference b only', false, 4),

    -- WRITES COST
    ('q9_mcq_idx_writes_cost', 'A', 'Sequential scans only', false, 1),
    ('q9_mcq_idx_writes_cost', 'B', 'Connection setup', false, 2),
    ('q9_mcq_idx_writes_cost', 'C', 'Pure read queries with no predicates', false, 3),
    ('q9_mcq_idx_writes_cost', 'D', 'INSERT/UPDATE/DELETE due to extra index maintenance', true, 4),

    -- HASH INDEX
    ('q9_mcq_idx_hash_use', 'A', 'Equality lookups but not range queries', true, 1),
    ('q9_mcq_idx_hash_use', 'B', 'Range queries only', false, 2),
    ('q9_mcq_idx_hash_use', 'C', 'Pattern matching with LIKE prefixes', false, 3),
    ('q9_mcq_idx_hash_use', 'D', 'Sorting query results', false, 4),

    -- PARTIAL INDEX
    ('q9_mcq_idx_partial', 'A', 'PARTIAL', false, 1),
    ('q9_mcq_idx_partial', 'B', 'WHERE', true, 2),
    ('q9_mcq_idx_partial', 'C', 'INCLUDE', false, 3),
    ('q9_mcq_idx_partial', 'D', 'FILTER', false, 4),

    -- 1NF
    ('q9_mcq_norm_1nf', 'A', 'There are no foreign keys', false, 1),
    ('q9_mcq_norm_1nf', 'B', 'Every column has a UNIQUE constraint', false, 2),
    ('q9_mcq_norm_1nf', 'C', 'All attribute values are atomic with no repeating groups', true, 3),
    ('q9_mcq_norm_1nf', 'D', 'There are at least three tables', false, 4),

    -- 2NF
    ('q9_mcq_norm_partial_dep', 'A', '1NF', false, 1),
    ('q9_mcq_norm_partial_dep', 'B', '2NF', true, 2),
    ('q9_mcq_norm_partial_dep', 'C', '3NF', false, 3),
    ('q9_mcq_norm_partial_dep', 'D', 'BCNF', false, 4),

    -- BCNF
    ('q9_mcq_norm_bcnf', 'A', 'X is a superkey of the relation', true, 1),
    ('q9_mcq_norm_bcnf', 'B', 'X is a foreign key', false, 2),
    ('q9_mcq_norm_bcnf', 'C', 'Y is a primary key', false, 3),
    ('q9_mcq_norm_bcnf', 'D', 'Y depends transitively on X', false, 4),

    -- LOSSLESS
    ('q9_mcq_norm_lossless', 'A', 'No relation has duplicate rows', false, 1),
    ('q9_mcq_norm_lossless', 'B', 'Each decomposed relation has a primary key', false, 2),
    ('q9_mcq_norm_lossless', 'C', 'Joining the decomposed relations reconstructs the original relation exactly', true, 3),
    ('q9_mcq_norm_lossless', 'D', 'No functional dependency is preserved', false, 4),

    -- 4NF
    ('q9_mcq_norm_4nf', 'A', 'Transitive functional dependencies', false, 1),
    ('q9_mcq_norm_4nf', 'B', 'Join dependencies', false, 2),
    ('q9_mcq_norm_4nf', 'C', 'Primary key dependencies', false, 3),
    ('q9_mcq_norm_4nf', 'D', 'Non-trivial multivalued dependencies not implied by a superkey', true, 4),

    -- ANOMALY
    ('q9_mcq_norm_anomaly', 'A', 'Update, insertion, and deletion anomalies caused by redundancy', true, 1),
    ('q9_mcq_norm_anomaly', 'B', 'Network latency', false, 2),
    ('q9_mcq_norm_anomaly', 'C', 'Index fragmentation', false, 3),
    ('q9_mcq_norm_anomaly', 'D', 'Buffer pool eviction', false, 4)
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
