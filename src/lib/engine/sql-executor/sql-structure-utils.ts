import { replaceSqlIdentifiers } from './sql-lexer';

export interface ProcedureParam {
  name: string;
  mode: 'IN' | 'OUT' | 'INOUT';
}

export interface TableColumnMeta {
  name: string;
  definition: string;
}

export interface RebuildColumnSpec {
  name: string;
  definition: string;
  sourceName?: string;
}

export interface ParsedCreateTableMeta {
  columns: TableColumnMeta[];
  tableConstraints: string[];
  trailingClause: string;
}

export function extractRoutineBody(sql: string): { preamble: string; body: string } | null {
  const beginRegex = /\bBEGIN\b/gi;
  let beginMatch: RegExpExecArray | null;
  let beginIdx = -1;

  while ((beginMatch = beginRegex.exec(sql)) !== null) {
    const before = sql.slice(0, beginMatch.index);
    const singleQuotes = (before.match(/'/g) || []).length;
    if (singleQuotes % 2 === 0) {
      beginIdx = beginMatch.index;
      break;
    }
  }

  if (beginIdx === -1) return null;

  const preamble = sql.slice(0, beginIdx).trim();
  const afterBegin = beginIdx + 5;
  let depth = 1;
  let i = afterBegin;
  let inSingle = false;
  let inDouble = false;

  while (i < sql.length && depth > 0) {
    const ch = sql[i];

    if (ch === "'" && !inDouble) { inSingle = !inSingle; i += 1; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; i += 1; continue; }
    if (inSingle || inDouble) { i += 1; continue; }

    if (/[A-Za-z_]/.test(ch)) {
      let wordEnd = i;
      while (wordEnd < sql.length && /[A-Za-z0-9_]/.test(sql[wordEnd])) wordEnd += 1;
      const word = sql.slice(i, wordEnd).toUpperCase();

      if (word === 'BEGIN') {
        depth += 1;
      } else if (word === 'END') {
        let peek = wordEnd;
        while (peek < sql.length && /\s/.test(sql[peek])) peek += 1;
        let nextWordEnd = peek;
        while (nextWordEnd < sql.length && /[A-Za-z0-9_]/.test(sql[nextWordEnd])) nextWordEnd += 1;
        const nextWord = sql.slice(peek, nextWordEnd).toUpperCase();

        if (nextWord === 'IF' || nextWord === 'LOOP' || nextWord === 'CASE' || nextWord === 'WHILE') {
          i = nextWordEnd;
          continue;
        }

        depth -= 1;
        if (depth === 0) {
          const body = sql.slice(afterBegin, i).trim();
          return { preamble, body };
        }
      }
      i = wordEnd;
      continue;
    }

    i += 1;
  }

  return null;
}

export function splitCommaSafe(raw: string): string[] {
  const out: string[] = [];
  let current = '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) {
        const piece = current.trim();
        if (piece) out.push(piece);
        current = '';
        continue;
      }
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) out.push(tail);
  return out;
}

export function parseLeadingIdentifier(raw: string): { identifier: string; rest: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let match = trimmed.match(/^`([^`]+)`\s*([\s\S]*)$/);
  if (match) return { identifier: match[1], rest: match[2] ?? '' };

  match = trimmed.match(/^"([^"]+)"\s*([\s\S]*)$/);
  if (match) return { identifier: match[1], rest: match[2] ?? '' };

  match = trimmed.match(/^'([^']+)'\s*([\s\S]*)$/);
  if (match) return { identifier: match[1], rest: match[2] ?? '' };

  match = trimmed.match(/^([A-Za-z_][\w$]*)\s*([\s\S]*)$/);
  if (match) return { identifier: match[1], rest: match[2] ?? '' };

  return null;
}

export function splitTopLevelComma(raw: string): string[] {
  const out: string[] = [];
  let current = '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (ch === "'" && !inDouble && !inBacktick) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle && !inBacktick) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (ch === '`' && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) {
        const piece = current.trim();
        if (piece) out.push(piece);
        current = '';
        continue;
      }
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) out.push(tail);
  return out;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function quoteSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function isTableConstraintDefinition(definition: string): boolean {
  return /^(?:CONSTRAINT\b|PRIMARY\s+KEY\b|UNIQUE\b|CHECK\b|FOREIGN\s+KEY\b)/i.test(definition.trim());
}

export function parseCreateTableMeta(createTableSql: string): ParsedCreateTableMeta | null {
  const normalized = createTableSql.trim().replace(/;\s*$/, '');
  const openParen = normalized.indexOf('(');
  if (openParen === -1) return null;

  let closeParen = -1;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  for (let i = openParen; i < normalized.length; i += 1) {
    const ch = normalized[i];
    const next = i + 1 < normalized.length ? normalized[i + 1] : '';
    const prev = i > 0 ? normalized[i - 1] : '';

    if (inSingle) {
      if (ch === "'" && next === "'") {
        i += 1;
        continue;
      }
      if (ch === "'" && prev !== '\\') inSingle = false;
      continue;
    }

    if (inDouble) {
      if (ch === '"' && next === '"') {
        i += 1;
        continue;
      }
      if (ch === '"') inDouble = false;
      continue;
    }

    if (inBacktick) {
      if (ch === '`' && next === '`') {
        i += 1;
        continue;
      }
      if (ch === '`') inBacktick = false;
      continue;
    }

    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '`') { inBacktick = true; continue; }
    if (ch === '(') { depth += 1; continue; }
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        closeParen = i;
        break;
      }
    }
  }

  if (closeParen <= openParen) return null;

  const body = normalized.slice(openParen + 1, closeParen).trim();
  const trailingClause = normalized.slice(closeParen + 1).trim();
  const pieces = splitTopLevelComma(body);
  if (pieces.length === 0) return null;

  const columns: TableColumnMeta[] = [];
  const tableConstraints: string[] = [];
  for (const piece of pieces) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    if (isTableConstraintDefinition(trimmed)) {
      tableConstraints.push(trimmed);
      continue;
    }
    const parsed = parseLeadingIdentifier(trimmed);
    if (!parsed) {
      tableConstraints.push(trimmed);
      continue;
    }
    columns.push({ name: parsed.identifier, definition: trimmed });
  }

  return { columns, tableConstraints, trailingClause };
}

export function rewriteSchemaSqlIdentifiers(sql: string, replacements: ReadonlyMap<string, string>): string {
  if (replacements.size === 0) return sql;

  let rewritten = sql;
  for (const [from, to] of replacements) {
    const escaped = escapeRegex(from);
    rewritten = rewritten
      .replace(new RegExp(`\\\`${escaped}\\\``, 'gi'), `\`${to}\``)
      .replace(new RegExp(`"${escaped}"`, 'gi'), `"${to}"`);
  }

  return replaceSqlIdentifiers(rewritten, replacements);
}

export function sqlReferencesIdentifier(sql: string, identifier: string): boolean {
  const escaped = escapeRegex(identifier);
  if (new RegExp(`\\\`${escaped}\\\``, 'i').test(sql)) return true;
  if (new RegExp(`"${escaped}"`, 'i').test(sql)) return true;
  if (new RegExp(`(^|[^A-Za-z0-9_$])${escaped}([^A-Za-z0-9_$]|$)`, 'i').test(sql)) return true;
  return false;
}

export function replaceLeadingIdentifier(
  definition: string,
  nextName: string,
  quoteIdentifier: (identifier: string) => string,
): string {
  const parsed = parseLeadingIdentifier(definition);
  if (!parsed) return definition;
  return `${quoteIdentifier(nextName)} ${parsed.rest.trim()}`.trim();
}

export function parseProcedureParams(raw: string): ProcedureParam[] {
  const source = raw.trim();
  if (!source) return [];

  return splitCommaSafe(source)
    .map((token) => {
      const normalized = token.trim().replace(/\s+/g, ' ');
      if (!normalized) return null;

      const match = normalized.match(/^(?:(IN|OUT|INOUT)\s+)?([A-Za-z_][\w$]*)(?:\s+.+)?$/i);
      if (!match) return null;

      const mode = (match[1]?.toUpperCase() ?? 'IN') as 'IN' | 'OUT' | 'INOUT';
      const name = match[2];
      return { name, mode } satisfies ProcedureParam;
    })
    .filter((param): param is ProcedureParam => param !== null);
}

export function toSqlLiteral(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'NULL';
  if (/^null$/i.test(trimmed)) return 'NULL';
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^'.*'$/.test(trimmed)) return trimmed;
  if (/^".*"$/.test(trimmed)) return `'${trimmed.slice(1, -1).replace(/'/g, "''")}'`;
  return `'${trimmed.replace(/'/g, "''")}'`;
}
