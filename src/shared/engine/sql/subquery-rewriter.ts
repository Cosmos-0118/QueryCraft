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
 * String literals (single/double/backtick) and line/block comments are skipped.
 */
function findMatchingParen(sql: string, start: number): number {
  let depth = 1;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  for (let i = start + 1; i < sql.length; i++) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';
    if (!inDouble && !inBacktick && ch === "'") {
      if (inSingle && next === "'") {
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble && next === '"') {
        i += 1;
        continue;
      }
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      if (inBacktick && next === '`') {
        i += 1;
        continue;
      }
      inBacktick = !inBacktick;
      continue;
    }
    if (inSingle || inDouble || inBacktick) continue;
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Returns true when `index` lies inside a string literal or comment, so
 * operator matches in those regions are skipped.
 */
function isInsideLiteralOrComment(sql: string, index: number): boolean {
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < index && i < sql.length; i++) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '-' && next === '-' && (sql[i + 2] === undefined || /\s/.test(sql[i + 2]))) {
        inLineComment = true;
        i += 1;
        continue;
      }
      if (ch === '#') {
        inLineComment = true;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i += 1;
        continue;
      }
    }
    if (!inDouble && !inBacktick && ch === "'") {
      if (inSingle && next === "'") {
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble && next === '"') {
        i += 1;
        continue;
      }
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      if (inBacktick && next === '`') {
        i += 1;
        continue;
      }
      inBacktick = !inBacktick;
    }
  }
  return inSingle || inDouble || inBacktick || inLineComment || inBlockComment;
}

/**
 * Map comparison operator + quantifier to the aggregate function that should
 * wrap the subquery result, or to an IN / NOT IN rewrite.
 *
 *   >  ANY → > MIN    |  >  ALL → > MAX
 *   >= ANY → >= MIN   |  >= ALL → >= MAX
 *   <  ANY → < MAX    |  <  ALL → < MIN
 *   <= ANY → <= MAX   |  <= ALL → <= MIN
 *   =  ANY → IN       |  =  ALL → = MIN AND = MAX (needs left expr)
 *   != ANY → <> MIN OR <> MAX (needs left expr; else NOT IN approx) | != ALL → NOT IN
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

interface TwoSidedStrategy {
  kind: 'two-sided';
  fnMin: string;
  fnMax: string;
  op: string;
  joiner: 'AND' | 'OR';
}

type Strategy = RewriteStrategy | InRewriteStrategy | TwoSidedStrategy;

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
        // val <> ANY(subq) ⟺ val <> MIN(subq) OR val <> MAX(subq).
        // Needs the left operand; caller falls back to NOT IN when it cannot
        // be captured safely.
        return { kind: 'two-sided', fnMin: 'MIN', fnMax: 'MAX', op: '<>', joiner: 'OR' };
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
      // val = ALL(subq) ⟺ val = MIN(subq) AND val = MAX(subq). Exact, and
      // degrades correctly for empty subqueries only in the vacuous-true edge
      // (documented approximation).
      return { kind: 'two-sided', fnMin: 'MIN', fnMax: 'MAX', op: '=', joiner: 'AND' };
    case '!=':
    case '<>':
      return { kind: 'in', negated: true };
    default:
      return { kind: 'aggregate', fn: 'MAX', op: normalizedOp };
  }
}

/**
 * Split the SELECT list of a subquery from its FROM clause at the top level.
 * Returns the select-list text and the `FROM ...` remainder, or null when the
 * subquery is not a plain SELECT ... FROM.
 */
function splitSelectList(subquery: string): { selectList: string; fromRest: string } | null {
  const m = subquery.match(/^\s*SELECT\s+/i);
  if (!m) return null;
  let i = m[0].length;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  while (i < subquery.length) {
    const ch = subquery[i];
    const next = i + 1 < subquery.length ? subquery[i + 1] : '';
    if (!inDouble && !inBacktick && ch === "'") {
      if (inSingle && next === "'") {
        i += 2;
        continue;
      }
      inSingle = !inSingle;
      i += 1;
      continue;
    }
    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble && next === '"') {
        i += 2;
        continue;
      }
      inDouble = !inDouble;
      i += 1;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      if (inBacktick && next === '`') {
        i += 2;
        continue;
      }
      inBacktick = !inBacktick;
      i += 1;
      continue;
    }
    if (inSingle || inDouble || inBacktick) {
      i += 1;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /\bFROM\b/i.test(subquery.slice(i, i + 4)) && /(^|[\s()])FROM($|[\s()])/i.test(subquery.slice(Math.max(0, i - 1), i + 5))) {
      return { selectList: subquery.slice(m[0].length, i).trim(), fromRest: subquery.slice(i).trim() };
    }
    i += 1;
  }
  return null;
}

/**
 * Take the first top-level comma-separated expression of a SELECT list,
 * stripping DISTINCT/ALL. Returns null for `*` or empty lists.
 */
function extractFirstSelectExpression(selectList: string): string | null {
  const cleaned = selectList.trim().replace(/^(DISTINCT\s+|ALL\s+)/i, '').trim();
  if (!cleaned || cleaned === '*') return null;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = i + 1 < cleaned.length ? cleaned[i + 1] : '';
    if (!inDouble && !inBacktick && ch === "'") {
      if (inSingle && next === "'") {
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble && next === '"') {
        i += 1;
        continue;
      }
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      if (inBacktick && next === '`') {
        i += 1;
        continue;
      }
      inBacktick = !inBacktick;
      continue;
    }
    if (inSingle || inDouble || inBacktick) continue;
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const first = cleaned.slice(0, i).trim();
      return first && first !== '*' ? first : null;
    }
  }
  return cleaned || null;
}

/**
 * Build `SELECT FN(first_expr) FROM ...` from a plain SELECT subquery.
 * Returns null when the projection cannot be aggregated safely.
 */
function buildAggregateSubquery(subquery: string, fn: string): string | null {
  const split = splitSelectList(subquery);
  if (!split) return null;
  const first = extractFirstSelectExpression(split.selectList);
  if (!first) return null;
  return `SELECT ${fn}(${first}) ${split.fromRest}`;
}

/**
 * Capture a simple left-hand operand immediately before `opIndex`
 * (end of the text preceding the comparison operator). Handles identifiers,
 * string/number literals, function calls and parenthesized expressions.
 * Returns the operand text or null when it cannot be captured safely.
 */
function captureLeftOperand(sql: string, opIndex: number): string | null {
  let i = opIndex - 1;
  while (i >= 0 && /\s/.test(sql[i])) i -= 1;
  if (i < 0) return null;
  const end = i + 1;
  const ch = sql[i];
  if (ch === ')') {
    let depth = 1;
    i -= 1;
    let inSingle = false;
    let inDouble = false;
    while (i >= 0 && depth > 0) {
      const c = sql[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (!inSingle && !inDouble) {
        if (c === ')') depth += 1;
        if (c === '(') depth -= 1;
      }
      i -= 1;
    }
    if (depth !== 0) return null;
    // Include a possible function/call name or keyword prefix (e.g. CAST (...)).
    let start = i + 1;
    const prefix = sql.slice(0, start).match(/[A-Za-z_][A-Za-z0-9_$.]*\s*$/)?.[0] ?? '';
    start -= prefix.length;
    return sql.slice(start, end).trim() || null;
  }
  if (ch === "'" || ch === '"' || ch === '`') {
    const quote = ch;
    i -= 1;
    while (i >= 0) {
      if (sql[i] === quote) {
        if (sql[i + 1] === quote || sql[i - 1] === quote) {
          i -= 1;
          continue;
        }
        break;
      }
      i -= 1;
    }
    if (i < 0) return null;
    return sql.slice(i, end).trim() || null;
  }
  const wordMatch = sql.slice(0, end).match(/([A-Za-z_][A-Za-z0-9_$.]*|'[^']*'|"[^"]*"|-?\d+(?:\.\d+)?)\s*$/);
  return wordMatch?.[1]?.trim() || null;
}

/**
 * Rewrite `expr op ANY/SOME/ALL (subquery)` patterns in a SQL string.
 */
export function rewriteSubqueryOperators(sql: string): string {
  // Pattern matches:  <comparison_op> <whitespace> ANY|SOME|ALL <whitespace>? (
  const pattern = /([><=!]+)\s+(ANY|SOME|ALL)\s*\(/gi;
  let output = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(sql)) !== null) {
    const op = match[1];
    const quantifier = match[2].toUpperCase() === 'SOME' ? 'ANY' : match[2].toUpperCase();
    const parenStart = match.index + match[0].length - 1; // index of '('

    if (isInsideLiteralOrComment(sql, match.index)) {
      continue; // Inside a string literal or comment, skip
    }

    const parenEnd = findMatchingParen(sql, parenStart);
    if (parenEnd < 0) continue; // Unmatched parens, skip

    const subquery = sql.slice(parenStart + 1, parenEnd).trim();
    const strategy = resolveStrategy(op, quantifier as 'ANY' | 'ALL');

    if (strategy.kind === 'in') {
      output += sql.slice(cursor, match.index);
      output += `${strategy.negated ? 'NOT IN' : 'IN'} (${subquery})`;
      cursor = parenEnd + 1;
      pattern.lastIndex = cursor;
      continue;
    }

    if (strategy.kind === 'two-sided') {
      const prefixUpToOp = sql.slice(0, match.index);
      const left = captureLeftOperand(prefixUpToOp, match.index);
      const minSub = buildAggregateSubquery(subquery, strategy.fnMin);
      const maxSub = buildAggregateSubquery(subquery, strategy.fnMax);
      if (left && minSub && maxSub) {
        const window = sql.slice(cursor, match.index);
        const trimmedWindow = window.replace(/\s+$/, '');
        if (trimmedWindow.endsWith(left)) {
          output += trimmedWindow.slice(0, trimmedWindow.length - left.length);
          output += `(${left} ${strategy.op} (${minSub}) ${strategy.joiner} ${left} ${strategy.op} (${maxSub}))`;
          cursor = parenEnd + 1;
          pattern.lastIndex = cursor;
          continue;
        }
      }
      // Fall through to single-sided approximation when the operand or
      // projection cannot be analyzed safely.
      const approx = buildAggregateSubquery(subquery, strategy.fnMin);
      output += sql.slice(cursor, match.index);
      if (approx) {
        output += `${strategy.op} (${approx})`;
      } else {
        output += `${strategy.op} (${subquery})`;
      }
      cursor = parenEnd + 1;
      pattern.lastIndex = cursor;
      continue;
    }

    output += sql.slice(cursor, match.index);

    const aggSub = buildAggregateSubquery(subquery, strategy.fn);
    if (aggSub) {
      output += `${strategy.op} (${aggSub})`;
    } else {
      // Projection too complex to aggregate safely — leave the subquery intact
      // so SQLite reports a clear error instead of invalid generated SQL.
      output += `${strategy.op} (${subquery})`;
    }

    cursor = parenEnd + 1;
    pattern.lastIndex = cursor;
  }

  return output + sql.slice(cursor);
}
