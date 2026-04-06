import type { QueryResult, Row } from '@/types/database';

interface CursorState {
  rows: Row[];
  position: number;
}

interface RuntimeState {
  vars: Map<string, unknown>;
  cursors: Map<string, string>;
  openCursors: Map<string, CursorState>;
  notFoundAssignments: Array<{ name: string; value: unknown }>;
  output: string[];
}

interface RuntimeContext {
  executeSql: (sql: string) => QueryResult;
}

interface ExceptionHandler {
  condition: string;
  body: string;
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function mergeCompoundStatements(statements: string[]): string[] {
  const merged: string[] = [];

  let i = 0;
  while (i < statements.length) {
    const current = statements[i].trim();
    if (!current) {
      i += 1;
      continue;
    }

    if (/^IF\b/i.test(current) && !/\bEND\s+IF\b/i.test(current)) {
      let chunk = current;
      let depth = countMatches(chunk, /\bIF\b/gi) - countMatches(chunk, /\bEND\s+IF\b/gi);
      i += 1;

      while (i < statements.length && depth > 0) {
        const next = statements[i].trim();
        chunk = `${chunk} ${next}`;
        depth += countMatches(next, /\bIF\b/gi) - countMatches(next, /\bEND\s+IF\b/gi);
        i += 1;
      }

      merged.push(chunk);
      continue;
    }

    if (/^FOR\b/i.test(current) && /\bLOOP\b/i.test(current) && !/\bEND\s+LOOP\b/i.test(current)) {
      let chunk = current;
      let depth = countMatches(chunk, /\bLOOP\b/gi) - countMatches(chunk, /\bEND\s+LOOP\b/gi);
      i += 1;

      while (i < statements.length && depth > 0) {
        const next = statements[i].trim();
        chunk = `${chunk} ${next}`;
        depth += countMatches(next, /\bLOOP\b/gi) - countMatches(next, /\bEND\s+LOOP\b/gi);
        i += 1;
      }

      merged.push(chunk);
      continue;
    }

    merged.push(current);
    i += 1;
  }

  return merged;
}

function splitRuntimeStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const ch = sql[index];
    const next = index + 1 < sql.length ? sql[index + 1] : '';

    if (inLineComment) {
      buffer += ch;
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      buffer += ch;
      if (ch === '*' && next === '/') {
        buffer += '/';
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '-' && next === '-') {
        buffer += ch;
        buffer += next;
        inLineComment = true;
        index += 1;
        continue;
      }

      if (ch === '/' && next === '*') {
        buffer += ch;
        buffer += next;
        inBlockComment = true;
        index += 1;
        continue;
      }
    }

    if (!inDouble && !inBacktick && ch === "'") {
      inSingle = !inSingle;
      buffer += ch;
      continue;
    }

    if (!inSingle && !inBacktick && ch === '"') {
      inDouble = !inDouble;
      buffer += ch;
      continue;
    }

    if (!inSingle && !inDouble && ch === '`') {
      inBacktick = !inBacktick;
      buffer += ch;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && ch === ';') {
      const statement = buffer.trim();
      if (statement) {
        statements.push(`${statement};`);
      }
      buffer = '';
      continue;
    }

    buffer += ch;
  }

  const tail = buffer.trim();
  if (tail) {
    statements.push(tail.endsWith(';') ? tail : `${tail};`);
  }

  return statements;
}

function key(name: string): string {
  return name.toLowerCase();
}

function normalizeVarName(name: string): string {
  return key(name.replace(/^[:@]/, ''));
}

function parseLiteral(raw: string, vars: Map<string, unknown>): unknown {
  const token = raw.trim();
  if (/^null$/i.test(token)) return null;
  if (/^true$/i.test(token)) return true;
  if (/^false$/i.test(token)) return false;
  if (/^'.*'$/.test(token)) return token.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);

  const varValue = vars.get(normalizeVarName(token));
  return varValue ?? token;
}

function evalConcatExpr(expr: string, vars: Map<string, unknown>): unknown {
  const parts = expr.split(/\|\|/g).map((part) => part.trim());
  if (parts.length <= 1) return parseLiteral(expr, vars);
  return parts
    .map((part) => {
      const value = parseLiteral(part, vars);
      return value === null || value === undefined ? '' : String(value);
    })
    .join('');
}

function evalCondition(cond: string, vars: Map<string, unknown>): boolean {
  const text = cond.trim();

  const isNull = text.match(/^(\w+)\s+IS\s+(NOT\s+)?NULL$/i);
  if (isNull) {
    const value = vars.get(normalizeVarName(isNull[1]));
    const wantNot = Boolean(isNull[2]);
    return wantNot ? value !== null && value !== undefined : value === null || value === undefined;
  }

  const cmp = text.match(/^([@]?\w+)\s*(=|<>|!=|>=|<=|>|<)\s*(.+)$/i);
  if (cmp) {
    const left = vars.get(normalizeVarName(cmp[1]));
    const right = parseLiteral(cmp[3], vars);
    switch (cmp[2]) {
      case '=':
        return left === right;
      case '<>':
      case '!=':
        return left !== right;
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
      default:
        return false;
    }
  }

  const direct = vars.get(normalizeVarName(text));
  return Boolean(direct);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function substituteBindVars(sql: string, vars: Map<string, unknown>): string {
  let result = sql.replace(/:(\w+)/g, (_m, name: string) => {
    const value = vars.get(key(name));
    return formatValue(value);
  });

  result = result.replace(/@(\w+)/g, (_m, name: string) => {
    const normalized = key(name);
    if (vars.has(normalized)) {
      return formatValue(vars.get(normalized));
    }
    return _m;
  });

  return result;
}

function runStatement(
  statement: string,
  state: RuntimeState,
  context: RuntimeContext,
  options?: { allowDeclarations?: boolean },
): QueryResult {
  const stmt = statement.trim().replace(/;$/, '').trim();
  if (!stmt || /^NULL$/i.test(stmt)) {
    return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
  }

  if (options?.allowDeclarations) {
    const cursorDecl =
      stmt.match(/^CURSOR\s+(\w+)\s+IS\s+([\s\S]+)$/i) ??
      stmt.match(/^DECLARE\s+(\w+)\s+CURSOR\s+FOR\s+([\s\S]+)$/i);
    if (cursorDecl) {
      state.cursors.set(key(cursorDecl[1]), cursorDecl[2].trim());
      return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
    }

    const notFoundHandler = stmt.match(
      /^DECLARE\s+CONTINUE\s+HANDLER\s+FOR\s+NOT\s+FOUND\s+SET\s+(\w+)\s*=\s*([\s\S]+)$/i,
    );
    if (notFoundHandler) {
      state.notFoundAssignments.push({
        name: normalizeVarName(notFoundHandler[1]),
        value: evalConcatExpr(notFoundHandler[2], state.vars),
      });
      return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
    }

    const varDecl =
      stmt.match(/^(?:DECLARE\s+)?(\w+)\s+[^:;]+(?::=|DEFAULT)\s+([\s\S]+)$/i) ??
      stmt.match(/^(?:DECLARE\s+)?(\w+)\s+[^:;]+$/i);
    if (
      varDecl &&
      !/^(SELECT|OPEN|FETCH|CLOSE|IF|FOR|WHILE|SET|UPDATE|INSERT|DELETE|CALL|DBMS_OUTPUT|RAISE_APPLICATION_ERROR)\b/i.test(
        stmt,
      )
    ) {
      const varName = varDecl[1];
      const initExpr = varDecl[2];
      state.vars.set(normalizeVarName(varName), initExpr ? evalConcatExpr(initExpr, state.vars) : null);
      return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
    }
  }

  const openCursor = stmt.match(/^OPEN\s+(\w+)$/i);
  if (openCursor) {
    const cursorName = key(openCursor[1]);
    const cursorSql = state.cursors.get(cursorName);
    if (!cursorSql) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        error: `Cursor '${openCursor[1]}' not declared`,
      };
    }
    const result = context.executeSql(substituteBindVars(cursorSql, state.vars));
    if (result.error) return result;
    state.openCursors.set(cursorName, { rows: result.rows, position: 0 });
      state.vars.set(`${cursorName}%notfound`, result.rows.length === 0);
    return { columns: [], rows: [], rowCount: 0, executionTimeMs: result.executionTimeMs };
  }

  const fetchCursor = stmt.match(/^FETCH\s+(\w+)\s+INTO\s+([@\w\s,]+)$/i);
  if (fetchCursor) {
    const cursorName = key(fetchCursor[1]);
    const opened = state.openCursors.get(cursorName);
    if (!opened) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        error: `Cursor '${fetchCursor[1]}' is not open`,
      };
    }

    const vars = fetchCursor[2]
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const row = opened.rows[opened.position];
    if (!row) {
      vars.forEach((name) => state.vars.set(normalizeVarName(name), null));
      state.vars.set(`${cursorName}%notfound`, true);
      state.notFoundAssignments.forEach((assignment) => {
        state.vars.set(assignment.name, assignment.value);
      });
      return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
    }

    const values = Object.values(row);
    vars.forEach((name, idx) => {
      state.vars.set(normalizeVarName(name), values[idx] ?? null);
    });
    opened.position += 1;
    state.vars.set(`${cursorName}%notfound`, opened.position > opened.rows.length);
    return { columns: [], rows: [], rowCount: 1, executionTimeMs: 0 };
  }

  const closeCursor = stmt.match(/^CLOSE\s+(\w+)$/i);
  if (closeCursor) {
    state.openCursors.delete(key(closeCursor[1]));
    return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
  }

  const ifStmt = stmt.match(
    /^IF\s+([\s\S]+?)\s+THEN\s+([\s\S]+?)(?:\s+ELSE\s+([\s\S]+?))?\s*END\s+IF$/i,
  );
  if (ifStmt) {
    const branch = evalCondition(ifStmt[1], state.vars) ? ifStmt[2] : (ifStmt[3] ?? 'NULL');
    const branchStatements = splitRuntimeStatements(branch);
    let last: QueryResult = { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
    for (const inner of branchStatements) {
      last = runStatement(inner, state, context);
      if (last.error) return last;
    }
    return last;
  }

  const forLoop = stmt.match(/^FOR\s+(\w+)\s+IN\s*\(([\s\S]+)\)\s+LOOP\s+([\s\S]+)\s+END\s+LOOP$/i);
  if (forLoop) {
    const iterator = key(forLoop[1]);
    const selectSql = substituteBindVars(forLoop[2], state.vars);
    const body = forLoop[3];
    const selectRes = context.executeSql(selectSql);
    if (selectRes.error) return selectRes;

    let last: QueryResult = { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
    const bodyStatements = splitRuntimeStatements(body);
    for (const row of selectRes.rows) {
      Object.entries(row).forEach(([col, value]) => {
        state.vars.set(`${iterator}.${key(col)}`, value);
      });
      for (const inner of bodyStatements) {
        last = runStatement(inner, state, context);
        if (last.error) return last;
      }
    }
    return last;
  }

  const assignStmt = stmt.match(/^([@]?\w+)\s*:=\s*([\s\S]+)$/i);
  if (assignStmt) {
    state.vars.set(normalizeVarName(assignStmt[1]), evalConcatExpr(assignStmt[2], state.vars));
    return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
  }

  const setStmt = stmt.match(/^SET\s+([@]?\w+)\s*=\s*([\s\S]+)$/i);
  if (setStmt) {
    state.vars.set(normalizeVarName(setStmt[1]), evalConcatExpr(setStmt[2], state.vars));
    return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
  }

  const outputStmt = stmt.match(/^DBMS_OUTPUT\.PUT_LINE\((.*)\)$/i);
  if (outputStmt) {
    const text = evalConcatExpr(outputStmt[1], state.vars);
    state.output.push(text === null || text === undefined ? '' : String(text));
    return { columns: [], rows: [], rowCount: 1, executionTimeMs: 0 };
  }

  const appErrorStmt = stmt.match(
    /^RAISE_APPLICATION_ERROR\s*\(\s*(-?\d+)\s*,\s*'([\s\S]*)'\s*\)$/i,
  );
  if (appErrorStmt) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
      error: `ORA-${Math.abs(Number(appErrorStmt[1]))}: ${appErrorStmt[2].replace(/''/g, "'")}`,
    };
  }

  const selectInto = stmt.match(/^SELECT\s+([\s\S]+?)\s+INTO\s+([@\w\s,]+)\s+FROM\s+([\s\S]+)$/i);
  if (selectInto) {
    const projection = selectInto[1].trim();
    const intoVars = selectInto[2]
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const fromSql = substituteBindVars(`SELECT ${projection} FROM ${selectInto[3]}`, state.vars);
    const res = context.executeSql(fromSql);
    if (res.error) return res;
    const row = res.rows[0];
    if (!row) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: res.executionTimeMs,
        error: 'NO_DATA_FOUND',
      };
    }
    const values = Object.values(row);
    intoVars.forEach((name, idx) => state.vars.set(normalizeVarName(name), values[idx] ?? null));
    return { columns: [], rows: [], rowCount: 1, executionTimeMs: res.executionTimeMs };
  }

  // For SELECT without FROM, resolve bare variable names from procedure scope
  const selectNoFrom = stmt.match(/^SELECT\s+([\s\S]+)$/i);
  if (selectNoFrom && !/\bFROM\b/i.test(selectNoFrom[1])) {
    const exprs = selectNoFrom[1].split(',').map((e) => e.trim());
    const hasVarRef = exprs.some((expr) => {
      const raw = expr.replace(/\s+AS\s+\w+$/i, '').trim();
      return state.vars.has(normalizeVarName(raw));
    });
    if (hasVarRef) {
      const columns: string[] = [];
      const values: unknown[] = [];
      for (const expr of exprs) {
        const aliasMatch = expr.match(/^([\s\S]+?)\s+AS\s+(\w+)$/i);
        const raw = aliasMatch ? aliasMatch[1].trim() : expr;
        const alias = aliasMatch ? aliasMatch[2] : raw;
        const varName = normalizeVarName(raw);
        if (state.vars.has(varName)) {
          columns.push(alias);
          values.push(state.vars.get(varName));
        } else {
          columns.push(alias);
          values.push(evalConcatExpr(raw, state.vars));
        }
      }
      const row: Record<string, unknown> = {};
      columns.forEach((col, idx) => { row[col] = values[idx]; });
      return {
        columns,
        rows: [row],
        rowCount: 1,
        executionTimeMs: 0,
      };
    }
  }

  return context.executeSql(substituteBindVars(stmt, state.vars));
}

function parseExceptionHandlers(section: string): ExceptionHandler[] {
  const handlers: ExceptionHandler[] = [];
  const regex = /WHEN\s+([\s\S]+?)\s+THEN\s+([\s\S]*?)(?=(?:\bWHEN\b[\s\S]+?\bTHEN\b)|$)/gi;

  let match = regex.exec(section);
  while (match) {
    handlers.push({
      condition: match[1].trim(),
      body: match[2].trim(),
    });
    match = regex.exec(section);
  }

  return handlers;
}

function matchesException(condition: string, error: string): boolean {
  const normalized = condition.trim().toUpperCase();
  const errUpper = error.trim().toUpperCase();

  if (normalized === 'OTHERS') return true;
  if (normalized === 'NO_DATA_FOUND') {
    return errUpper.includes('NO_DATA_FOUND') || errUpper.includes('NO DATA FOUND');
  }
  if (normalized.startsWith('ORA-')) {
    return errUpper.includes(normalized);
  }
  return errUpper.includes(normalized.replace(/\s+/g, '_'));
}

function handleException(
  error: string,
  section: string,
  state: RuntimeState,
  context: RuntimeContext,
): QueryResult {
  const handlers = parseExceptionHandlers(section);
  if (handlers.length === 0) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
      error,
    };
  }

  const match = handlers.find((handler) => matchesException(handler.condition, error));
  if (!match) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
      error,
    };
  }

  let last: QueryResult = { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
  const handlerStatements = mergeCompoundStatements(splitRuntimeStatements(match.body));
  for (const statement of handlerStatements) {
    last = runStatement(statement, state, context);
    if (last.error) return last;
  }

  return last;
}

export function isPlSqlBlock(sql: string): boolean {
  const src = sql.trim();
  if (/^(DECLARE\b|BEGIN\b)/i.test(src) && /END\s*;?\s*\/?\s*$/i.test(src)) {
    return true;
  }

  return /^(DECLARE\b|CURSOR\b|OPEN\b|FETCH\b|CLOSE\b|IF\b|DBMS_OUTPUT\.PUT_LINE\b|RAISE_APPLICATION_ERROR\b)/i.test(src);
}

export function runPlSqlBlock(sql: string, context: RuntimeContext): QueryResult {
  const trimmed = sql.trim().replace(/\/$/, '').trim();
  const bodyMatch = trimmed.match(
    /^(?:DECLARE\s+([\s\S]*?)\s+)?BEGIN\s+([\s\S]*?)(?:\s+EXCEPTION\s+([\s\S]*?))?\s+END\s*;?$/i,
  );
  if (!bodyMatch) {
    const state: RuntimeState = {
      vars: new Map<string, unknown>(),
      cursors: new Map<string, string>(),
      openCursors: new Map<string, CursorState>(),
      notFoundAssignments: [],
      output: [],
    };

    let last: QueryResult = { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
    const statements = mergeCompoundStatements(splitRuntimeStatements(trimmed));
    for (const statement of statements) {
      last = runStatement(statement, state, context, { allowDeclarations: true });
      if (last.error) return last;
    }

    if (state.output.length > 0) {
      return {
        columns: ['output'],
        rows: state.output.map((line) => ({ output: line })),
        rowCount: state.output.length,
        executionTimeMs: last.executionTimeMs,
      };
    }

    return last;
  }

  const declareSection = bodyMatch[1] ?? '';
  const beginSection = bodyMatch[2] ?? '';
  const exceptionSection = bodyMatch[3] ?? '';

  const state: RuntimeState = {
    vars: new Map<string, unknown>(),
    cursors: new Map<string, string>(),
    openCursors: new Map<string, CursorState>(),
    notFoundAssignments: [],
    output: [],
  };

  let last: QueryResult = { columns: [], rows: [], rowCount: 0, executionTimeMs: 0 };
  const declareStatements = splitRuntimeStatements(declareSection);
  for (const statement of declareStatements) {
    last = runStatement(statement, state, context, { allowDeclarations: true });
    if (last.error) return last;
  }

  const bodyStatements = mergeCompoundStatements(splitRuntimeStatements(beginSection));
  for (const statement of bodyStatements) {
    last = runStatement(statement, state, context, { allowDeclarations: true });
    if (last.error) {
      if (!exceptionSection.trim()) return last;
      last = handleException(last.error, exceptionSection, state, context);
      if (last.error) return last;
      break;
    }
  }

  if (state.output.length > 0) {
    return {
      columns: ['output'],
      rows: state.output.map((line) => ({ output: line })),
      rowCount: state.output.length,
      executionTimeMs: last.executionTimeMs,
    };
  }

  return last;
}
