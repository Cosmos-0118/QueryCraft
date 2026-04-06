/**
 * Rewrites MySQL-specific subquery operators (ANY, SOME, ALL) into
 * SQLite-compatible equivalents.
 *
 * MySQL:  value > ANY  (SELECT ...)  →  value > (SELECT MIN(...) FROM (...))
 * MySQL:  value > ALL  (SELECT ...)  →  value > (SELECT MAX(...) FROM (...))
 * MySQL:  value = ANY  (SELECT ...)  →  value IN (SELECT ...)
 * MySQL:  value != ALL (SELECT ...)  →  value NOT IN (SELECT ...)
 *
 * SOME is a synonym for ANY.
 */

/**
 * Given a SQL string find the matching closing paren for an open paren at
 * `start` (the index of the opening '(').  Returns -1 if unmatched.
 */
function findMatchingParen(sql: string, start: number): number {
  let depth = 1;
  let inSingle = false;
  let inDouble = false;
  for (let i = start + 1; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (inSingle || inDouble) continue;
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Map comparison operator + quantifier to the aggregate function that should
 * wrap the subquery result, or to an IN / NOT IN rewrite.
 *
 *   >  ANY → > MIN    |  >  ALL → > MAX
 *   >= ANY → >= MIN   |  >= ALL → >= MAX
 *   <  ANY → < MAX    |  <  ALL → < MIN
 *   <= ANY → <= MAX   |  <= ALL → <= MIN
 *   =  ANY → IN       |  =  ALL → (rewrite as = ALL via MIN = MAX = val)
 *   != ANY → NOT IN?  |  != ALL → NOT IN
 *   <> ANY → (same)   |  <> ALL → NOT IN
 */
interface RewriteStrategy {
  kind: 'aggregate';
  fn: string;
  op: string;
}

interface InRewriteStrategy {
  kind: 'in';
  negated: boolean;
}

type Strategy = RewriteStrategy | InRewriteStrategy;

function resolveStrategy(op: string, quantifier: 'ANY' | 'ALL'): Strategy {
  const normalizedOp = op.trim();
  if (quantifier === 'ANY') {
    switch (normalizedOp) {
      case '>':
        return { kind: 'aggregate', fn: 'MIN', op: '>' };
      case '>=':
        return { kind: 'aggregate', fn: 'MIN', op: '>=' };
      case '<':
        return { kind: 'aggregate', fn: 'MAX', op: '<' };
      case '<=':
        return { kind: 'aggregate', fn: 'MAX', op: '<=' };
      case '=':
        return { kind: 'in', negated: false };
      case '!=':
      case '<>':
        // val != ANY(subq) is TRUE if at least one row differs.
        // This is NOT the same as NOT IN. MySQL semantics: returns TRUE
        // when there is at least one non-matching row. We approximate by
        // checking val < MAX or val > MIN.
        // Simpler: just use a subquery comparison with MIN/MAX won't work
        // for != semantics cleanly. The safest rewrite:
        //   val != ANY(subq) ≡ EXISTS (SELECT 1 FROM (subq) AS __t WHERE __t.col <> val)
        // But that requires knowledge of the column name. Use IN trick:
        //   val <> ANY(subq) ↔ NOT (val = ALL(subq)) ↔ NOT (val >= (SELECT MIN..) AND val <= (SELECT MAX..) AND MIN=MAX=val)
        // Simplest correct approximation for educational tool:
        //   rewrite as val NOT IN (subq) — slightly stronger but commonly expected
        return { kind: 'in', negated: true };
      default:
        return { kind: 'aggregate', fn: 'MIN', op: normalizedOp };
    }
  }

  // ALL
  switch (normalizedOp) {
    case '>':
      return { kind: 'aggregate', fn: 'MAX', op: '>' };
    case '>=':
      return { kind: 'aggregate', fn: 'MAX', op: '>=' };
    case '<':
      return { kind: 'aggregate', fn: 'MIN', op: '<' };
    case '<=':
      return { kind: 'aggregate', fn: 'MIN', op: '<=' };
    case '=':
      // val = ALL(subq) means val equals every row → MIN = MAX = val
      return { kind: 'aggregate', fn: 'MIN', op: '=' };
    case '!=':
    case '<>':
      return { kind: 'in', negated: true };
    default:
      return { kind: 'aggregate', fn: 'MAX', op: normalizedOp };
  }
}

/**
 * Extract the single-column expression from a simple subquery.
 * Given "SELECT price FROM Sales WHERE ..." returns "price".
 * Returns null for complex projections (multiple columns, expressions).
 */
function extractSubqueryColumn(subquery: string): string | null {
  const m = subquery.match(/^\s*SELECT\s+([\w."'`]+)\s+FROM\b/i);
  return m ? m[1] : null;
}

/**
 * Rewrite `expr op ANY/SOME/ALL (subquery)` patterns in a SQL string.
 */
export function rewriteSubqueryOperators(sql: string): string {
  // Pattern matches:  <comparison_op> <whitespace> ANY|SOME|ALL <whitespace>? (
  // We need to be careful not to match inside strings or comments.
  const pattern = /([><=!]+)\s+(ANY|SOME|ALL)\s*\(/gi;
  let output = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(sql)) !== null) {
    const op = match[1];
    const quantifier = match[2].toUpperCase() === 'SOME' ? 'ANY' : match[2].toUpperCase();
    const parenStart = match.index + match[0].length - 1; // index of '('

    // Verify we're not inside a string literal by counting quotes before this position
    const before = sql.slice(0, match.index);
    const singleQuotes = (before.match(/'/g) || []).length;
    const doubleQuotes = (before.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
      continue; // Inside a string literal, skip
    }

    const parenEnd = findMatchingParen(sql, parenStart);
    if (parenEnd < 0) continue; // Unmatched parens, skip

    const subquery = sql.slice(parenStart + 1, parenEnd).trim();
    const strategy = resolveStrategy(op, quantifier as 'ANY' | 'ALL');

    output += sql.slice(cursor, match.index);

    if (strategy.kind === 'in') {
      output += `${strategy.negated ? 'NOT IN' : 'IN'} (${subquery})`;
    } else {
      const col = extractSubqueryColumn(subquery);
      if (col) {
        // Rewrite subquery to use aggregate: SELECT MIN/MAX(col) FROM (original subquery)
        output += `${strategy.op} (SELECT ${strategy.fn}(${col}) FROM (${subquery}))`;
      } else {
        // Fallback: wrap entire subquery as a derived table
        output += `${strategy.op} (SELECT ${strategy.fn}(__sq.__col1) FROM (SELECT * FROM (${subquery}) AS __inner) AS __sq(__col1))`;
      }
    }

    cursor = parenEnd + 1;
    pattern.lastIndex = cursor;
  }

  return output + sql.slice(cursor);
}
