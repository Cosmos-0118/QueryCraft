export interface SqlTableReference {
  database?: string;
  table: string;
}

export interface SqlPrivilegeTableTarget extends SqlTableReference {
  privilege: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
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

const DISALLOWED_ALIAS_WORDS = new Set([
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
  'FROM',
  'INTO',
  'BY',
  'OUTER',
  'LATERAL',
]);

function readAlias(tokens: SqlToken[], start: number): { alias?: string; nextIndex: number } {
  let i = start;
  if (isWordToken(tokens[i], 'AS')) {
    i += 1;
    if (!isIdentifierToken(tokens[i])) {
      return { nextIndex: i };
    }
    return { alias: tokens[i].value, nextIndex: i + 1 };
  }

  if (!isIdentifierToken(tokens[i])) {
    return { nextIndex: i };
  }

  if (DISALLOWED_ALIAS_WORDS.has(tokens[i].upper)) {
    return { nextIndex: i };
  }

  return { alias: tokens[i].value, nextIndex: i + 1 };
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

interface CteBodyRange {
  start: number;
  end: number;
}

interface CteMetadata {
  names: Set<string>;
  statementStart: number;
  bodyRanges: CteBodyRange[];
}

function collectCteMetadata(tokens: SqlToken[]): CteMetadata {
  const names = new Set<string>();
  const bodyRanges: CteBodyRange[] = [];
  if (!isWordToken(tokens[0], 'WITH')) {
    return { names, statementStart: 0, bodyRanges };
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

    const bodyStart = i + 1;
    const afterBody = skipParenthesized(tokens, i);
    const bodyEnd = afterBody - 1;
    if (bodyStart <= bodyEnd) {
      bodyRanges.push({ start: bodyStart, end: bodyEnd });
    }
    i = afterBody;

    if (tokens[i]?.type === 'symbol' && tokens[i]?.value === ',') {
      i += 1;
      continue;
    }

    break;
  }

  return { names, statementStart: i, bodyRanges };
}

interface ParsedTableReference {
  reference: SqlTableReference | null;
  alias?: string;
  nextIndex: number;
}

function readTableReferenceAtDetailed(
  tokens: SqlToken[],
  start: number,
  cteNames: Set<string>,
): ParsedTableReference {
  if (tokens[start]?.type === 'symbol' && tokens[start]?.value === '(') {
    const afterParen = skipParenthesized(tokens, start);
    const aliasRead = readAlias(tokens, afterParen);
    const nextIndex = skipTableHints(tokens, aliasRead.nextIndex);
    return { reference: null, alias: aliasRead.alias, nextIndex };
  }

  const read = readQualifiedName(tokens, start);
  if (!read) {
    return { reference: null, nextIndex: start + 1 };
  }

  const aliasRead = readAlias(tokens, read.nextIndex);
  const nextIndex = skipTableHints(tokens, aliasRead.nextIndex);

  if (!read.reference.database && cteNames.has(read.reference.table.toLowerCase())) {
    return { reference: null, alias: aliasRead.alias, nextIndex };
  }

  return { reference: read.reference, alias: aliasRead.alias, nextIndex };
}

function readTableReferenceAt(
  tokens: SqlToken[],
  start: number,
  cteNames: Set<string>,
): { reference: SqlTableReference | null; nextIndex: number } {
  const parsed = readTableReferenceAtDetailed(tokens, start, cteNames);
  return { reference: parsed.reference, nextIndex: parsed.nextIndex };
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
  'USING',
]);

const JOIN_MARKERS = new Set([
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'FULL',
  'CROSS',
  'NATURAL',
  'OUTER',
  'LATERAL',
  'STRAIGHT_JOIN',
]);

const READ_SOURCE_KEYWORDS = new Set(['FROM', 'JOIN', 'USING']);

interface SqlTableSource {
  reference: SqlTableReference;
  alias?: string;
}

const INSERT_MODIFIERS = new Set(['LOW_PRIORITY', 'DELAYED', 'HIGH_PRIORITY', 'IGNORE']);
const DELETE_MODIFIERS = new Set(['LOW_PRIORITY', 'QUICK', 'IGNORE']);

function tableRefKey(reference: SqlTableReference): string {
  return `${reference.database?.toLowerCase() ?? ''}.${reference.table.toLowerCase()}`;
}

function collectFromClauseTables(
  tokens: SqlToken[],
  start: number,
  cteNames: Set<string>,
  addReference: (reference: SqlTableReference) => void,
  stopIndex = tokens.length,
): number {
  return collectFromClauseSources(
    tokens,
    start,
    cteNames,
    (source) => addReference(source.reference),
    stopIndex,
  );
}

function collectFromClauseSources(
  tokens: SqlToken[],
  start: number,
  cteNames: Set<string>,
  addSource: (source: SqlTableSource) => void,
  stopIndex = tokens.length,
): number {
  let i = start;
  while (i < stopIndex) {
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

    if (token.type === 'symbol' && token.value === '(') {
      const afterParen = skipParenthesized(tokens, i);

      // Derived tables and grouped joins can hide nested reads. Walk the
      // parenthesized segment recursively so authorization sees those tables.
      collectReadReferences(tokens, i + 1, Math.min(afterParen, stopIndex), cteNames, (reference) => {
        addSource({ reference });
      });

      const aliasRead = readAlias(tokens, afterParen);
      i = skipTableHints(tokens, aliasRead.nextIndex);
      continue;
    }

    const parsed = readTableReferenceAtDetailed(tokens, i, cteNames);
    if (parsed.reference) {
      addSource({ reference: parsed.reference, alias: parsed.alias });
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
  stopIndex = tokens.length,
): number {
  let i = start;
  while (i < stopIndex) {
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

function collectReadReferences(
  tokens: SqlToken[],
  start: number,
  stopIndex: number,
  cteNames: Set<string>,
  addReference: (reference: SqlTableReference) => void,
): void {
  let i = start;
  while (i < stopIndex) {
    const token = tokens[i];
    if (!token || token.type !== 'word') {
      i += 1;
      continue;
    }

    if (READ_SOURCE_KEYWORDS.has(token.upper)) {
      i = collectFromClauseTables(tokens, i + 1, cteNames, addReference, stopIndex);
      continue;
    }

    i += 1;
  }
}

function collectCteBodyReadReferences(
  tokens: SqlToken[],
  bodyRanges: CteBodyRange[],
  cteNames: Set<string>,
  addReference: (reference: SqlTableReference) => void,
): void {
  for (const body of bodyRanges) {
    collectReadReferences(tokens, body.start, body.end + 1, cteNames, addReference);
  }
}

function collectInsertTarget(
  tokens: SqlToken[],
  statementStart: number,
  cteNames: Set<string>,
  addReference: (reference: SqlTableReference) => void,
): void {
  let i = statementStart + 1;
  while (tokens[i]?.type === 'word' && INSERT_MODIFIERS.has(tokens[i].upper)) {
    i += 1;
  }

  if (isWordToken(tokens[i], 'INTO')) {
    i += 1;
  }

  const parsed = readTableReferenceAt(tokens, i, cteNames);
  if (parsed.reference) {
    addReference(parsed.reference);
  }
}

function collectIdentifierTargets(tokens: SqlToken[], start: number, end: number): string[] {
  const targets: string[] = [];
  let i = start;
  while (i < end) {
    const token = tokens[i];
    if (!token) break;

    if (token.type === 'symbol' && token.value === ',') {
      i += 1;
      continue;
    }

    if (isIdentifierToken(token)) {
      targets.push(token.value.toLowerCase());
      i += 1;
      continue;
    }

    i += 1;
  }
  return targets;
}

function resolveIdentifierTargets(
  names: string[],
  sources: SqlTableSource[],
  addReference: (reference: SqlTableReference) => void,
): void {
  for (const name of names) {
    const matched = sources.find((source) => {
      const aliasMatches = source.alias?.toLowerCase() === name;
      const tableMatches = source.reference.table.toLowerCase() === name;
      return aliasMatches || tableMatches;
    });

    if (matched) {
      addReference(matched.reference);
    }
  }
}

function findWordTokenBeforeBoundaries(
  tokens: SqlToken[],
  start: number,
  word: string,
  boundaries: Set<string>,
): number {
  let i = start;
  while (i < tokens.length) {
    const token = tokens[i];
    if (!token || token.type !== 'word') {
      i += 1;
      continue;
    }

    if (token.upper === word) {
      return i;
    }

    if (boundaries.has(token.upper)) {
      return -1;
    }

    i += 1;
  }

  return -1;
}

function collectDeleteTargets(
  tokens: SqlToken[],
  statementStart: number,
  cteNames: Set<string>,
  addReference: (reference: SqlTableReference) => void,
): void {
  let i = statementStart + 1;
  while (tokens[i]?.type === 'word' && DELETE_MODIFIERS.has(tokens[i].upper)) {
    i += 1;
  }

  if (isWordToken(tokens[i], 'FROM')) {
    const usingIndex = findWordTokenBeforeBoundaries(
      tokens,
      i + 1,
      'USING',
      new Set(['WHERE', 'ORDER', 'LIMIT', 'RETURNING']),
    );

    if (usingIndex > i + 1) {
      const targetNames = collectIdentifierTargets(tokens, i + 1, usingIndex);
      if (targetNames.length > 0) {
        const sources: SqlTableSource[] = [];
        collectFromClauseSources(tokens, usingIndex + 1, cteNames, (source) => sources.push(source));
        resolveIdentifierTargets(targetNames, sources, addReference);
        if (sources.length > 0) {
          const anyResolved = targetNames.some((name) =>
            sources.some(
              (source) =>
                source.alias?.toLowerCase() === name || source.reference.table.toLowerCase() === name,
            ),
          );
          if (!anyResolved) {
            addReference(sources[0].reference);
          }
        }
        return;
      }
    }

    const parsed = readTableReferenceAt(tokens, i + 1, cteNames);
    if (parsed.reference) {
      addReference(parsed.reference);
    }
    return;
  }

  const fromIndex = findWordTokenBeforeBoundaries(
    tokens,
    i,
    'FROM',
    new Set(['WHERE', 'ORDER', 'LIMIT', 'RETURNING']),
  );
  if (fromIndex === -1) {
    return;
  }

  const targetNames = collectIdentifierTargets(tokens, i, fromIndex);
  if (targetNames.length === 0) {
    return;
  }

  const sources: SqlTableSource[] = [];
  collectFromClauseSources(tokens, fromIndex + 1, cteNames, (source) => sources.push(source));
  resolveIdentifierTargets(targetNames, sources, addReference);
  if (sources.length > 0) {
    const anyResolved = targetNames.some((name) =>
      sources.some(
        (source) => source.alias?.toLowerCase() === name || source.reference.table.toLowerCase() === name,
      ),
    );
    if (!anyResolved) {
      addReference(sources[0].reference);
    }
  }
}

function collectTruncateTarget(
  tokens: SqlToken[],
  statementStart: number,
  cteNames: Set<string>,
  addReference: (reference: SqlTableReference) => void,
): void {
  if (isWordToken(tokens[statementStart + 1], 'TABLE')) {
    const parsed = readTableReferenceAt(tokens, statementStart + 2, cteNames);
    if (parsed.reference) {
      addReference(parsed.reference);
    }
    return;
  }

  const parsed = readTableReferenceAt(tokens, statementStart + 1, cteNames);
  if (parsed.reference) {
    addReference(parsed.reference);
  }
}

export function extractLeadingSqlVerb(sql: string): string | null {
  const tokens = tokenizeSql(sql);
  if (tokens.length === 0) return null;

  const { statementStart } = collectCteMetadata(tokens);
  for (let i = statementStart; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === 'word') {
      return token.upper;
    }
  }

  return null;
}

export function extractPrivilegeTableTargets(sql: string): SqlPrivilegeTableTarget[] {
  const tokens = tokenizeSql(sql);
  if (tokens.length === 0) return [];

  const targets: SqlPrivilegeTableTarget[] = [];
  const seen = new Set<string>();

  const addTarget = (reference: SqlTableReference, privilege: SqlPrivilegeTableTarget['privilege']) => {
    const key = `${privilege}:${tableRefKey(reference)}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({ ...reference, privilege });
  };

  const { names: cteNames, statementStart, bodyRanges } = collectCteMetadata(tokens);

  let leadingVerb: string | null = null;
  for (let i = statementStart; i < tokens.length; i += 1) {
    if (tokens[i].type === 'word') {
      leadingVerb = tokens[i].upper;
      break;
    }
  }

  if (!leadingVerb) {
    return [];
  }

  if (['SELECT', 'SHOW', 'DESC', 'DESCRIBE', 'EXPLAIN'].includes(leadingVerb)) {
    collectCteBodyReadReferences(tokens, bodyRanges, cteNames, (reference) => {
      addTarget(reference, 'SELECT');
    });
    collectReadReferences(tokens, statementStart, tokens.length, cteNames, (reference) => {
      addTarget(reference, 'SELECT');
    });
    return targets;
  }

  if (leadingVerb === 'INSERT' || leadingVerb === 'REPLACE') {
    collectInsertTarget(tokens, statementStart, cteNames, (reference) => {
      addTarget(reference, 'INSERT');
    });
    collectCteBodyReadReferences(tokens, bodyRanges, cteNames, (reference) => {
      addTarget(reference, 'SELECT');
    });
    collectReadReferences(tokens, statementStart, tokens.length, cteNames, (reference) => {
      addTarget(reference, 'SELECT');
    });
    return targets;
  }

  if (leadingVerb === 'UPDATE') {
    collectUpdateTargets(tokens, statementStart + 1, cteNames, (reference) => {
      addTarget(reference, 'UPDATE');
    });
    collectCteBodyReadReferences(tokens, bodyRanges, cteNames, (reference) => {
      addTarget(reference, 'SELECT');
    });
    collectReadReferences(tokens, statementStart, tokens.length, cteNames, (reference) => {
      addTarget(reference, 'SELECT');
    });
    return targets;
  }

  if (leadingVerb === 'DELETE') {
    const deleteTargets: SqlTableReference[] = [];
    const deleteSeen = new Set<string>();
    collectDeleteTargets(tokens, statementStart, cteNames, (reference) => {
      const key = tableRefKey(reference);
      if (deleteSeen.has(key)) return;
      deleteSeen.add(key);
      deleteTargets.push(reference);
      addTarget(reference, 'DELETE');
    });

    collectCteBodyReadReferences(tokens, bodyRanges, cteNames, (reference) => {
      addTarget(reference, 'SELECT');
    });

    const deleteTargetKeys = new Set(deleteTargets.map((reference) => tableRefKey(reference)));
    collectReadReferences(tokens, statementStart, tokens.length, cteNames, (reference) => {
      if (deleteTargetKeys.has(tableRefKey(reference))) {
        return;
      }
      addTarget(reference, 'SELECT');
    });
    return targets;
  }

  if (leadingVerb === 'TRUNCATE') {
    collectTruncateTarget(tokens, statementStart, cteNames, (reference) => {
      addTarget(reference, 'DELETE');
    });
  }

  return targets;
}

export function extractReferencedTables(sql: string): SqlTableReference[] {
  const references: SqlTableReference[] = [];
  const seen = new Set<string>();

  for (const target of extractPrivilegeTableTargets(sql)) {
    const key = tableRefKey(target);
    if (seen.has(key)) continue;
    seen.add(key);
    references.push({ database: target.database, table: target.table });
  }

  return references;
}
