export interface SqlTableReference {
  database?: string;
  table: string;
}

type SqlTokenType = 'word' | 'quoted' | 'symbol';

interface SqlToken {
  type: SqlTokenType;
  value: string;
  upper: string;
}

function isIdentifierStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isIdentifierChar(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch);
}

export function isMySqlLineCommentStart(sql: string, index: number): boolean {
  const ch = sql[index];
  if (ch === '#') return true;
  if (ch !== '-' || sql[index + 1] !== '-') return false;

  const third = sql[index + 2];
  if (third === undefined) return true;
  return /\s/.test(third) || third.charCodeAt(0) <= 31;
}

export function isEscapedByBackslash(sql: string, index: number): boolean {
  let slashCount = 0;
  let cursor = index - 1;
  while (cursor >= 0 && sql[cursor] === '\\') {
    slashCount += 1;
    cursor -= 1;
  }
  return slashCount % 2 === 1;
}

function consumeQuoted(sql: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < sql.length) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (quote !== '`' && ch === '\\') {
      i += 2;
      continue;
    }

    if (ch === quote) {
      if (next === quote) {
        i += 2;
        continue;
      }

      if (quote !== '`' && isEscapedByBackslash(sql, i)) {
        i += 1;
        continue;
      }

      return i + 1;
    }

    i += 1;
  }

  return sql.length;
}

function consumeLineComment(sql: string, start: number): number {
  let i = start;
  while (i < sql.length && sql[i] !== '\n') i += 1;
  return i;
}

function consumeBlockComment(sql: string, start: number): number {
  let i = start + 2;
  while (i < sql.length) {
    if (sql[i] === '*' && sql[i + 1] === '/') {
      return i + 2;
    }
    i += 1;
  }
  return sql.length;
}

export function stripSqlComments(sql: string): string {
  let out = '';
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    if (ch === "'" || ch === '"' || ch === '`') {
      const end = consumeQuoted(sql, i, ch);
      out += sql.slice(i, end);
      i = end;
      continue;
    }

    if (isMySqlLineCommentStart(sql, i)) {
      i = consumeLineComment(sql, i + (ch === '#' ? 1 : 2));
      continue;
    }

    if (ch === '/' && sql[i + 1] === '*') {
      const end = consumeBlockComment(sql, i);
      const block = sql.slice(i, end);
      for (const blockCh of block) {
        if (blockCh === '\n') out += '\n';
      }
      i = end;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out.trim();
}

export function transformSqlCodeSegments(
  sql: string,
  transformer: (segment: string) => string,
): string {
  let out = '';
  let cursor = 0;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    if (ch === "'" || ch === '"' || ch === '`') {
      if (i > cursor) {
        out += transformer(sql.slice(cursor, i));
      }
      const end = consumeQuoted(sql, i, ch);
      out += sql.slice(i, end);
      i = end;
      cursor = i;
      continue;
    }

    if (isMySqlLineCommentStart(sql, i)) {
      if (i > cursor) {
        out += transformer(sql.slice(cursor, i));
      }
      const end = consumeLineComment(sql, i + (ch === '#' ? 1 : 2));
      const prefixLen = ch === '#' ? 1 : 2;
      out += sql.slice(i, i + prefixLen);
      out += sql.slice(i + prefixLen, end);
      i = end;
      cursor = i;
      continue;
    }

    if (ch === '/' && sql[i + 1] === '*') {
      if (i > cursor) {
        out += transformer(sql.slice(cursor, i));
      }
      const end = consumeBlockComment(sql, i);
      out += sql.slice(i, end);
      i = end;
      cursor = i;
      continue;
    }

    i += 1;
  }

  if (cursor < sql.length) {
    out += transformer(sql.slice(cursor));
  }

  return out;
}

export function replaceSqlIdentifiers(
  sql: string,
  replacements: ReadonlyMap<string, string>,
): string {
  if (replacements.size === 0) return sql;

  return transformSqlCodeSegments(sql, (segment) =>
    segment.replace(/[A-Za-z_][A-Za-z0-9_$]*/g, (word, offset: number) => {
      const prev = offset > 0 ? segment[offset - 1] : '';
      if (prev === '.' || prev === '@' || prev === ':') return word;

      const replacement = replacements.get(word.toLowerCase());
      return replacement ?? word;
    }),
  );
}

function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (isMySqlLineCommentStart(sql, i)) {
      i = consumeLineComment(sql, i + (ch === '#' ? 1 : 2));
      continue;
    }

    if (ch === '/' && sql[i + 1] === '*') {
      i = consumeBlockComment(sql, i);
      continue;
    }

    if (ch === "'") {
      i = consumeQuoted(sql, i, ch);
      continue;
    }

    if (ch === '"' || ch === '`') {
      const end = consumeQuoted(sql, i, ch);
      const raw = sql.slice(i + 1, Math.max(i + 1, end - 1));
      const unescaped = raw.replace(new RegExp(`${ch}${ch}`, 'g'), ch);
      tokens.push({
        type: 'quoted',
        value: unescaped,
        upper: unescaped.toUpperCase(),
      });
      i = end;
      continue;
    }

    if (isIdentifierStart(ch)) {
      let end = i + 1;
      while (end < sql.length && isIdentifierChar(sql[end])) end += 1;
      const value = sql.slice(i, end);
      tokens.push({ type: 'word', value, upper: value.toUpperCase() });
      i = end;
      continue;
    }

    tokens.push({ type: 'symbol', value: ch, upper: ch });
    i += 1;
  }

  return tokens;
}

function isIdentifierToken(token: SqlToken | undefined): boolean {
  if (!token) return false;
  return token.type === 'word' || token.type === 'quoted';
}

function isWordToken(token: SqlToken | undefined, value: string): boolean {
  return Boolean(token && token.type === 'word' && token.upper === value);
}

function skipParenthesized(tokens: SqlToken[], start: number): number {
  if (tokens[start]?.type !== 'symbol' || tokens[start]?.value !== '(') {
    return start;
  }

  let depth = 0;
  let i = start;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === 'symbol' && token.value === '(') {
      depth += 1;
    } else if (token.type === 'symbol' && token.value === ')') {
      depth -= 1;
      if (depth === 0) {
        return i + 1;
      }
    }
    i += 1;
  }

  return tokens.length;
}

function readQualifiedName(
  tokens: SqlToken[],
  start: number,
): { reference: SqlTableReference; nextIndex: number } | null {
  const first = tokens[start];
  if (!isIdentifierToken(first)) return null;

  const segments: string[] = [first.value];
  let i = start + 1;

  while (
    tokens[i]?.type === 'symbol' &&
    tokens[i]?.value === '.' &&
    isIdentifierToken(tokens[i + 1])
  ) {
    segments.push(tokens[i + 1].value);
    i += 2;
  }

  if (segments.length === 1) {
    return { reference: { table: segments[0] }, nextIndex: i };
  }

  const table = segments[segments.length - 1];
  const database = segments[segments.length - 2];
  return { reference: { database, table }, nextIndex: i };
}

function skipAlias(tokens: SqlToken[], start: number): number {
  let i = start;
  if (isWordToken(tokens[i], 'AS')) {
    i += 1;
    if (isIdentifierToken(tokens[i])) i += 1;
    return i;
  }

  if (isIdentifierToken(tokens[i])) {
    const upper = tokens[i].upper;
    const disallowed = new Set([
      'ON',
      'USING',
      'WHERE',
      'GROUP',
      'ORDER',
      'LIMIT',
      'HAVING',
      'UNION',
      'EXCEPT',
      'INTERSECT',
      'JOIN',
      'INNER',
      'LEFT',
      'RIGHT',
      'FULL',
      'CROSS',
      'NATURAL',
      'SET',
      'VALUES',
      'RETURNING',
    ]);
    if (!disallowed.has(upper)) {
      i += 1;
    }
  }

  return i;
}

function skipTableHints(tokens: SqlToken[], start: number): number {
  let i = start;
  while (
    isWordToken(tokens[i], 'USE') ||
    isWordToken(tokens[i], 'FORCE') ||
    isWordToken(tokens[i], 'IGNORE')
  ) {
    if (!isWordToken(tokens[i + 1], 'INDEX') && !isWordToken(tokens[i + 1], 'KEY')) {
      return i;
    }
    i += 2;
    if (tokens[i]?.type === 'symbol' && tokens[i]?.value === '(') {
      i = skipParenthesized(tokens, i);
    }
  }
  return i;
}

function collectCteNames(tokens: SqlToken[]): { names: Set<string>; statementStart: number } {
  const names = new Set<string>();
  if (!isWordToken(tokens[0], 'WITH')) {
    return { names, statementStart: 0 };
  }

  let i = 1;
  if (isWordToken(tokens[i], 'RECURSIVE')) {
    i += 1;
  }

  while (i < tokens.length) {
    if (!isIdentifierToken(tokens[i])) break;
    names.add(tokens[i].value.toLowerCase());
    i += 1;

    if (tokens[i]?.type === 'symbol' && tokens[i]?.value === '(') {
      i = skipParenthesized(tokens, i);
    }

    if (isWordToken(tokens[i], 'AS')) {
      i += 1;
    }

    if (tokens[i]?.type !== 'symbol' || tokens[i]?.value !== '(') {
      break;
    }
    i = skipParenthesized(tokens, i);

    if (tokens[i]?.type === 'symbol' && tokens[i]?.value === ',') {
      i += 1;
      continue;
    }

    break;
  }

  return { names, statementStart: i };
}

function readTableReferenceAt(
  tokens: SqlToken[],
  start: number,
  cteNames: Set<string>,
): { reference: SqlTableReference | null; nextIndex: number } {
  if (tokens[start]?.type === 'symbol' && tokens[start]?.value === '(') {
    const afterParen = skipParenthesized(tokens, start);
    const afterAlias = skipAlias(tokens, afterParen);
    return { reference: null, nextIndex: afterAlias };
  }

  const read = readQualifiedName(tokens, start);
  if (!read) {
    return { reference: null, nextIndex: start + 1 };
  }

  let nextIndex = skipAlias(tokens, read.nextIndex);
  nextIndex = skipTableHints(tokens, nextIndex);

  if (!read.reference.database && cteNames.has(read.reference.table.toLowerCase())) {
    return { reference: null, nextIndex };
  }

  return { reference: read.reference, nextIndex };
}

const CLAUSE_BOUNDARIES = new Set([
  'WHERE',
  'GROUP',
  'ORDER',
  'HAVING',
  'LIMIT',
  'UNION',
  'EXCEPT',
  'INTERSECT',
  'WINDOW',
  'QUALIFY',
  'RETURNING',
  'FOR',
  'LOCK',
  'SET',
  'VALUES',
  'ON',
  'WHEN',
]);

const JOIN_MARKERS = new Set(['JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL']);

function collectFromClauseTables(
  tokens: SqlToken[],
  start: number,
  cteNames: Set<string>,
  addReference: (reference: SqlTableReference) => void,
): number {
  let i = start;
  while (i < tokens.length) {
    const token = tokens[i];
    if (!token) break;

    if (token.type === 'symbol' && (token.value === ')' || token.value === ';')) {
      return i;
    }

    if (token.type === 'word' && CLAUSE_BOUNDARIES.has(token.upper)) {
      return i;
    }

    if (token.type === 'symbol' && token.value === ',') {
      i += 1;
      continue;
    }

    if (token.type === 'word' && JOIN_MARKERS.has(token.upper)) {
      i += 1;
      continue;
    }

    const parsed = readTableReferenceAt(tokens, i, cteNames);
    if (parsed.reference) {
      addReference(parsed.reference);
    }
    i = parsed.nextIndex > i ? parsed.nextIndex : i + 1;
  }

  return i;
}

function collectUpdateTargets(
  tokens: SqlToken[],
  start: number,
  cteNames: Set<string>,
  addReference: (reference: SqlTableReference) => void,
): number {
  let i = start;
  while (i < tokens.length) {
    const token = tokens[i];
    if (!token) break;

    if (token.type === 'word' && token.upper === 'SET') {
      return i;
    }

    if (token.type === 'symbol' && token.value === ',') {
      i += 1;
      continue;
    }

    if (token.type === 'word' && JOIN_MARKERS.has(token.upper)) {
      i += 1;
      continue;
    }

    const parsed = readTableReferenceAt(tokens, i, cteNames);
    if (parsed.reference) {
      addReference(parsed.reference);
    }
    i = parsed.nextIndex > i ? parsed.nextIndex : i + 1;
  }

  return i;
}

export function extractReferencedTables(sql: string): SqlTableReference[] {
  const tokens = tokenizeSql(sql);
  if (tokens.length === 0) return [];

  const references: SqlTableReference[] = [];
  const seen = new Set<string>();

  const addReference = (reference: SqlTableReference) => {
    const key = `${reference.database?.toLowerCase() ?? ''}.${reference.table.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    references.push(reference);
  };

  const { names: cteNames, statementStart } = collectCteNames(tokens);

  let i = statementStart;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type !== 'word') {
      i += 1;
      continue;
    }

    if (token.upper === 'FROM') {
      i = collectFromClauseTables(tokens, i + 1, cteNames, addReference);
      continue;
    }

    if (token.upper === 'JOIN') {
      const parsed = readTableReferenceAt(tokens, i + 1, cteNames);
      if (parsed.reference) {
        addReference(parsed.reference);
      }
      i = parsed.nextIndex;
      continue;
    }

    if (token.upper === 'UPDATE') {
      i = collectUpdateTargets(tokens, i + 1, cteNames, addReference);
      continue;
    }

    if (token.upper === 'INTO') {
      const parsed = readTableReferenceAt(tokens, i + 1, cteNames);
      if (parsed.reference) {
        addReference(parsed.reference);
      }
      i = parsed.nextIndex;
      continue;
    }

    if (token.upper === 'TRUNCATE') {
      if (isWordToken(tokens[i + 1], 'TABLE')) {
        const parsed = readTableReferenceAt(tokens, i + 2, cteNames);
        if (parsed.reference) {
          addReference(parsed.reference);
        }
        i = parsed.nextIndex;
        continue;
      }

      const parsed = readTableReferenceAt(tokens, i + 1, cteNames);
      if (parsed.reference) {
        addReference(parsed.reference);
      }
      i = parsed.nextIndex;
      continue;
    }

    i += 1;
  }

  return references;
}
