/**
 * View Manager
 *
 * Handles MySQL-compatible operations on views that SQLite does not natively
 * support (UPDATE on simple views, DELETE on simple views, INSERT into views).
 *
 * For simple single-table views, rewrites the DML to target the underlying
 * base table with the view's WHERE clause merged in.
 */

import type { SqlJsDatabase } from './types';

interface ViewDefinition {
  name: string;
  baseTable: string;
  selectColumns: string;
  whereClause: string | null;
  fullSql: string;
}

/**
 * Query sqlite_master to get the CREATE VIEW SQL for a given name.
 * Returns null if the name is not a view.
 */
function getViewSql(db: SqlJsDatabase, name: string): string | null {
  try {
    const result = db.exec(
      `SELECT sql FROM sqlite_master WHERE type='view' AND name='${name.replace(/'/g, "''")}'`,
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    return String(result[0].values[0][0]);
  } catch {
    return null;
  }
}

/**
 * Parse a simple CREATE VIEW statement to extract the base table and WHERE clause.
 *
 * Only handles single-table views of the form:
 *   CREATE VIEW name AS SELECT cols FROM table [WHERE condition]
 */
function parseSimpleView(sql: string): ViewDefinition | null {
  // Normalise whitespace for matching, but keep original for storage.
  const norm = sql.replace(/\s+/g, ' ').trim();

  const m = norm.match(
    /^CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?\s+AS\s+SELECT\s+([\s\S]+?)\s+FROM\s+["'`]?(\w+)["'`]?(?:\s+WHERE\s+([\s\S]+?))?(?:\s+(?:ORDER\s+BY|GROUP\s+BY|LIMIT|HAVING)\b[\s\S]*)?$/i,
  );

  if (!m) return null;

  // Ensure single table (no JOINs)
  const afterFrom = norm.slice(norm.toUpperCase().indexOf(' FROM ') + 6);
  if (/\bJOIN\b/i.test(afterFrom.split(/\bWHERE\b/i)[0])) return null;

  return {
    name: m[1],
    selectColumns: m[2].trim(),
    baseTable: m[3],
    whereClause: m[4]?.trim() || null,
    fullSql: sql,
  };
}

/**
 * Check if a given table name is actually a view in the database.
 */
export function isView(db: SqlJsDatabase, name: string): boolean {
  return getViewSql(db, name) !== null;
}

/**
 * Attempt to rewrite an UPDATE statement targeting a simple view into an
 * UPDATE on the base table.  Returns null if the view is too complex or
 * the name is not a view.
 *
 * UPDATE view SET col=val WHERE cond
 * →
 * UPDATE base_table SET col=val WHERE (view_where) AND (cond)
 */
export function rewriteViewUpdate(
  db: SqlJsDatabase,
  sql: string,
): string | null {
  const norm = sql.replace(/\s+/g, ' ').trim().replace(/;$/, '').trim();
  const m = norm.match(
    /^UPDATE\s+["'`]?(\w+)["'`]?\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i,
  );
  if (!m) return null;

  const viewName = m[1];
  const setClause = m[2].trim();
  const whereClause = m[3]?.trim() || null;

  const viewSql = getViewSql(db, viewName);
  if (!viewSql) return null; // Not a view

  const viewDef = parseSimpleView(viewSql);
  if (!viewDef) return null; // Too complex

  let combinedWhere = '';
  if (viewDef.whereClause && whereClause) {
    combinedWhere = ` WHERE (${viewDef.whereClause}) AND (${whereClause})`;
  } else if (viewDef.whereClause) {
    combinedWhere = ` WHERE ${viewDef.whereClause}`;
  } else if (whereClause) {
    combinedWhere = ` WHERE ${whereClause}`;
  }

  return `UPDATE "${viewDef.baseTable}" SET ${setClause}${combinedWhere}`;
}

/**
 * Attempt to rewrite a DELETE statement targeting a simple view.
 *
 * DELETE FROM view WHERE cond
 * →
 * DELETE FROM base_table WHERE (view_where) AND (cond)
 */
export function rewriteViewDelete(
  db: SqlJsDatabase,
  sql: string,
): string | null {
  const norm = sql.replace(/\s+/g, ' ').trim().replace(/;$/, '').trim();
  const m = norm.match(
    /^DELETE\s+FROM\s+["'`]?(\w+)["'`]?(?:\s+WHERE\s+([\s\S]+))?$/i,
  );
  if (!m) return null;

  const viewName = m[1];
  const whereClause = m[2]?.trim() || null;

  const viewSql = getViewSql(db, viewName);
  if (!viewSql) return null;

  const viewDef = parseSimpleView(viewSql);
  if (!viewDef) return null;

  let combinedWhere = '';
  if (viewDef.whereClause && whereClause) {
    combinedWhere = ` WHERE (${viewDef.whereClause}) AND (${whereClause})`;
  } else if (viewDef.whereClause) {
    combinedWhere = ` WHERE ${viewDef.whereClause}`;
  } else if (whereClause) {
    combinedWhere = ` WHERE ${whereClause}`;
  }

  return `DELETE FROM "${viewDef.baseTable}"${combinedWhere}`;
}

/**
 * Attempt to rewrite an INSERT targeting a simple view.
 *
 * INSERT INTO view (cols) VALUES (...)
 * →
 * INSERT INTO base_table (cols) VALUES (...)
 */
export function rewriteViewInsert(
  db: SqlJsDatabase,
  sql: string,
): string | null {
  const norm = sql.replace(/\s+/g, ' ').trim().replace(/;$/, '').trim();
  const m = norm.match(
    /^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+["'`]?(\w+)["'`]?(\s[\s\S]+)$/i,
  );
  if (!m) return null;

  const viewName = m[1];
  const rest = m[2];

  const viewSql = getViewSql(db, viewName);
  if (!viewSql) return null;

  const viewDef = parseSimpleView(viewSql);
  if (!viewDef) return null;

  // Rewrite: replace the view name with the base table name
  return `INSERT INTO "${viewDef.baseTable}"${rest}`;
}
