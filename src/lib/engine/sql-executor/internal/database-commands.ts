import type { QueryResult, Row } from '@/types/database';
import { sqlErrorEngine } from '@/lib/engine/sql-error-engine';
import { extractCursorDefinitions, normalizeMySqlTriggerDefinition } from '../mysql-compat';
import { stripComments } from '../utils';
import type { SqlJs, SqlJsDatabase, SupportedPrivilege, DbUser, GrantEntry } from '../types';

interface ProcedureParam {
  name: string;
  mode: 'IN' | 'OUT' | 'INOUT';
}

interface StoredProcedure {
  database: string;
  name: string;
  params: ProcedureParam[];
  body: string;
  definition: string;
}

interface StoredTrigger {
  database: string;
  name: string;
  table: string;
  definition: string;
  sqliteDefinition: string;
}

interface StoredCursor {
  database: string;
  procedureName: string;
  name: string;
  query: string;
  definition: string;
}

interface StoredFunction {
  database: string;
  name: string;
  params: ProcedureParam[];
  body: string;
  definition: string;
}

function escapeRegexFragment(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSqlLikeMatcher(pattern?: string): (value: string) => boolean {
  if (!pattern) {
    return () => true;
  }

  let regex = '^';
  let escaping = false;

  for (const ch of pattern) {
    if (escaping) {
      regex += escapeRegexFragment(ch);
      escaping = false;
      continue;
    }

    if (ch === '\\') {
      escaping = true;
      continue;
    }

    if (ch === '%') {
      regex += '.*';
      continue;
    }

    if (ch === '_') {
      regex += '.';
      continue;
    }

    regex += escapeRegexFragment(ch);
  }

  if (escaping) {
    regex += '\\\\';
  }

  regex += '$';
  const compiled = new RegExp(regex, 'i');
  return (value: string) => compiled.test(value);
}

export interface DatabaseCommandContext {
  sqlModule: SqlJs | null;
  databases: Map<string, SqlJsDatabase>;
  procedures: Map<string, StoredProcedure>;
  functions: Map<string, StoredFunction>;
  triggers: Map<string, StoredTrigger>;
  cursors: Map<string, StoredCursor>;
  activeDatabase: string;
  users: Map<string, DbUser>;
  grants: Map<string, GrantEntry[]>;
  currentUserKey: string;

  clearProcedureMetadata(database: string, procedureName: string): void;
  cursorKey(database: string, procedureName: string, cursorName: string): string;
  displayUser(user: { username: string; host: string }): string;
  executeStoredProcedure(
    procedure: StoredProcedure,
    argsRaw: string,
    startTime: number,
    rawSql: string,
  ): QueryResult;
  extractRoutineBody(sql: string): { preamble: string; body: string } | null;
  formatUser(user: { username: string; host: string }): string;
  functionKey(database: string, name: string): string;
  getCurrentUser(): DbUser;
  getCurrentUserDisplay(): string;
  getGrantEntries(userKey: string): GrantEntry[];
  hasPrivilege(privilege: SupportedPrivilege, database: string, table?: string): boolean;
  isCurrentUserAdmin(): boolean;
  listDatabases(): string[];
  normalizePrivilegeToken(raw: string): SupportedPrivilege | null;
  parseCursorReference(
    raw: string,
  ): { database?: string; procedureName?: string; name: string } | null;
  parseGrantScope(raw: string): { database: string; table: string } | null;
  parseProcedureParams(raw: string): ProcedureParam[];
  parseQualifiedName(raw: string): { database?: string; name: string } | null;
  parseUserSpec(raw: string): { username: string; host: string } | null;
  procedureKey(database: string, name: string): string;
  quoteIdentifier(identifier: string): string;
  resolveDatabaseName(name: string): string | undefined;
  revokeGrant(
    userKey: string,
    scope: { database: string; table: string },
    privileges: SupportedPrivilege[],
  ): void;
  splitCommaSeparated(raw: string): string[];
  triggerKey(database: string, name: string): string;
  upsertGrant(
    userKey: string,
    scope: { database: string; table: string },
    privileges: SupportedPrivilege[],
    withGrantOption: boolean,
  ): void;
  userKey(username: string, host?: string): string;
}

export function handleDatabaseCommand(
  this: DatabaseCommandContext,
  rawSql: string,
  startTime: number,
): QueryResult | null {
  const cleaned = stripComments(rawSql);
  if (!cleaned) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: performance.now() - startTime,
    };
  }

  const norm = cleaned.replace(/\s+/g, ' ').trim();

  if (/^SHOW\s+USERS\s*;?$/i.test(norm)) {
    const rows = Array.from(this.users.values())
      .sort((a, b) => this.displayUser(a).localeCompare(this.displayUser(b)))
      .map((user) => ({
        User: this.displayUser(user),
        Host: user.host,
        Current: this.userKey(user.username, user.host) === this.currentUserKey ? 'YES' : 'NO',
      }));

    return {
      columns: ['User', 'Host', 'Current'],
      rows,
      rowCount: rows.length,
      executionTimeMs: performance.now() - startTime,
    };
  }

  {
    const m = norm.match(/^SHOW\s+GRANTS(?:\s+FOR\s+(.+))?\s*;?$/i);
    if (m) {
      const requested = m[1]?.trim();
      const targetUser = requested ? this.parseUserSpec(requested) : this.getCurrentUser();
      if (!targetUser) {
        return sqlErrorEngine.fromMessage('Invalid user in SHOW GRANTS', {
          sql: rawSql,
          startTime,
        });
      }

      const targetKey = this.userKey(targetUser.username, targetUser.host);
      const isSelf = targetKey === this.currentUserKey;
      if (!isSelf && !this.isCurrentUserAdmin()) {
        return sqlErrorEngine.fromMessage(
          'Access denied. Only admin can inspect grants for other users.',
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const grants = this.getGrantEntries(targetKey);
      const columnName = `Grants for ${this.formatUser(targetUser)}`;
      const rows: Row[] = grants.map((grant) => ({
        [columnName]: `GRANT ${Array.from(grant.privileges).join(', ')} ON ${grant.database}.${grant.table} TO ${this.formatUser(targetUser)}${grant.withGrantOption ? ' WITH GRANT OPTION' : ''}`,
      }));

      if (rows.length === 0) {
        rows.push({ [columnName]: `GRANT USAGE ON *.* TO ${this.formatUser(targetUser)}` });
      }

      return {
        columns: [columnName],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^CREATE\s+USER(?:\s+IF\s+NOT\s+EXISTS)?\s+(.+)$/i);
    if (m) {
      if (!this.isCurrentUserAdmin()) {
        return sqlErrorEngine.fromMessage('Access denied. Only admin can create users.', {
          sql: rawSql,
          startTime,
        });
      }

      const hasIfNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(norm);
      const userParts = this.splitCommaSeparated(m[1].replace(/;$/, ''));

      for (const userPart of userParts) {
        const identifiedMatch = userPart.match(/\bIDENTIFIED\s+BY\s+'([^']*)'\s*$/i);
        const specToken = userPart.replace(/\bIDENTIFIED\s+BY\s+'[^']*'\s*$/i, '').trim();
        const parsed = this.parseUserSpec(specToken);
        if (!parsed) {
          return sqlErrorEngine.fromMessage(`Invalid user specification '${userPart}'`, {
            sql: rawSql,
            startTime,
          });
        }

        const key = this.userKey(parsed.username, parsed.host);
        if (this.users.has(key)) {
          if (hasIfNotExists) continue;
          return sqlErrorEngine.fromMessage(
            `Operation CREATE USER failed for ${this.formatUser(parsed)}`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        this.users.set(key, {
          username: parsed.username,
          host: parsed.host,
          password: identifiedMatch?.[1],
        });
        this.grants.set(key, []);
      }

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^DROP\s+USER(?:\s+IF\s+EXISTS)?\s+(.+)$/i);
    if (m) {
      if (!this.isCurrentUserAdmin()) {
        return sqlErrorEngine.fromMessage('Access denied. Only admin can drop users.', {
          sql: rawSql,
          startTime,
        });
      }

      const hasIfExists = /\bIF\s+EXISTS\b/i.test(norm);
      const userParts = this.splitCommaSeparated(m[1].replace(/;$/, ''));

      for (const userPart of userParts) {
        const parsed = this.parseUserSpec(userPart);
        if (!parsed) {
          return sqlErrorEngine.fromMessage(`Invalid user specification '${userPart}'`, {
            sql: rawSql,
            startTime,
          });
        }

        const key = this.userKey(parsed.username, parsed.host);
        if (parsed.username.toLowerCase() === 'admin') {
          return sqlErrorEngine.fromMessage('Cannot drop default admin user.', {
            sql: rawSql,
            startTime,
          });
        }

        if (!this.users.has(key)) {
          if (hasIfExists) continue;
          return sqlErrorEngine.fromMessage(
            `Operation DROP USER failed for ${this.formatUser(parsed)}`,
            {
              sql: rawSql,
              startTime,
            },
          );
        }

        this.users.delete(key);
        this.grants.delete(key);
        if (this.currentUserKey === key) {
          this.currentUserKey = this.userKey('admin', 'localhost');
        }
      }

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^ALTER\s+USER\s+(.+?)\s+IDENTIFIED\s+BY\s+'([^']*)'\s*;?$/i);
    if (m) {
      if (!this.isCurrentUserAdmin()) {
        return sqlErrorEngine.fromMessage('Access denied. Only admin can alter users.', {
          sql: rawSql,
          startTime,
        });
      }

      const parsed = this.parseUserSpec(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid user specification in ALTER USER', {
          sql: rawSql,
          startTime,
        });
      }

      const key = this.userKey(parsed.username, parsed.host);
      const user = this.users.get(key);
      if (!user) {
        return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(parsed)}`, {
          sql: rawSql,
          startTime,
        });
      }

      user.password = m[2];
      this.users.set(key, user);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^RENAME\s+USER\s+(.+)$/i);
    if (m) {
      if (!this.isCurrentUserAdmin()) {
        return sqlErrorEngine.fromMessage('Access denied. Only admin can rename users.', {
          sql: rawSql,
          startTime,
        });
      }

      const pairs = this.splitCommaSeparated(m[1].replace(/;$/, ''));
      for (const pair of pairs) {
        const pairMatch = pair.match(/^(.+?)\s+TO\s+(.+)$/i);
        if (!pairMatch) {
          return sqlErrorEngine.fromMessage(`Invalid RENAME USER segment '${pair}'`, {
            sql: rawSql,
            startTime,
          });
        }

        const fromUser = this.parseUserSpec(pairMatch[1]);
        const toUser = this.parseUserSpec(pairMatch[2]);
        if (!fromUser || !toUser) {
          return sqlErrorEngine.fromMessage(`Invalid RENAME USER segment '${pair}'`, {
            sql: rawSql,
            startTime,
          });
        }

        const fromKey = this.userKey(fromUser.username, fromUser.host);
        const toKey = this.userKey(toUser.username, toUser.host);
        const existing = this.users.get(fromKey);
        if (!existing) {
          return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(fromUser)}`, {
            sql: rawSql,
            startTime,
          });
        }
        if (this.users.has(toKey)) {
          return sqlErrorEngine.fromMessage(`User ${this.formatUser(toUser)} already exists`, {
            sql: rawSql,
            startTime,
          });
        }

        this.users.delete(fromKey);
        this.users.set(toKey, {
          username: toUser.username,
          host: toUser.host,
          password: existing.password,
        });

        const grantEntries = this.grants.get(fromKey) ?? [];
        this.grants.delete(fromKey);
        this.grants.set(toKey, grantEntries);

        if (this.currentUserKey === fromKey) {
          this.currentUserKey = toKey;
        }
      }

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^SET\s+PASSWORD\s+FOR\s+(.+?)\s*=\s*'?([^';]+)'?\s*;?$/i);
    if (m) {
      if (!this.isCurrentUserAdmin()) {
        return sqlErrorEngine.fromMessage('Access denied. Only admin can set passwords.', {
          sql: rawSql,
          startTime,
        });
      }

      const parsed = this.parseUserSpec(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid user specification in SET PASSWORD', {
          sql: rawSql,
          startTime,
        });
      }

      const key = this.userKey(parsed.username, parsed.host);
      const user = this.users.get(key);
      if (!user) {
        return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(parsed)}`, {
          sql: rawSql,
          startTime,
        });
      }

      user.password = m[2];
      this.users.set(key, user);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(
      /^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+(.+?)(?:\s+WITH\s+GRANT\s+OPTION)?\s*;?$/i,
    );
    if (m) {
      if (!this.isCurrentUserAdmin()) {
        return sqlErrorEngine.fromMessage('Access denied. Only admin can grant privileges.', {
          sql: rawSql,
          startTime,
        });
      }

      const privileges = this.splitCommaSeparated(m[1])
        .map((token) => this.normalizePrivilegeToken(token))
        .filter((token): token is SupportedPrivilege => token !== null);

      if (privileges.length === 0) {
        return sqlErrorEngine.fromMessage('No supported privileges specified in GRANT', {
          sql: rawSql,
          startTime,
        });
      }

      const scope = this.parseGrantScope(m[2]);
      if (!scope) {
        return sqlErrorEngine.fromMessage(
          'Invalid privilege scope in GRANT. Use db.table form.',
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const usersRaw = this.splitCommaSeparated(m[3]);
      const withGrantOption = /\bWITH\s+GRANT\s+OPTION\b/i.test(norm);
      for (const userRaw of usersRaw) {
        const parsed = this.parseUserSpec(userRaw);
        if (!parsed) {
          return sqlErrorEngine.fromMessage(`Invalid user specification '${userRaw}'`, {
            sql: rawSql,
            startTime,
          });
        }

        const key = this.userKey(parsed.username, parsed.host);
        if (!this.users.has(key)) {
          return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(parsed)}`, {
            sql: rawSql,
            startTime,
          });
        }

        this.upsertGrant(key, scope, privileges, withGrantOption);
      }

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^REVOKE\s+(.+?)\s+ON\s+(.+?)\s+FROM\s+(.+)\s*;?$/i);
    if (m) {
      if (!this.isCurrentUserAdmin()) {
        return sqlErrorEngine.fromMessage('Access denied. Only admin can revoke privileges.', {
          sql: rawSql,
          startTime,
        });
      }

      const privileges = this.splitCommaSeparated(m[1])
        .map((token) => this.normalizePrivilegeToken(token))
        .filter((token): token is SupportedPrivilege => token !== null);

      if (privileges.length === 0) {
        return sqlErrorEngine.fromMessage('No supported privileges specified in REVOKE', {
          sql: rawSql,
          startTime,
        });
      }

      const scope = this.parseGrantScope(m[2]);
      if (!scope) {
        return sqlErrorEngine.fromMessage(
          'Invalid privilege scope in REVOKE. Use db.table form.',
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const usersRaw = this.splitCommaSeparated(m[3]);
      for (const userRaw of usersRaw) {
        const parsed = this.parseUserSpec(userRaw);
        if (!parsed) {
          return sqlErrorEngine.fromMessage(`Invalid user specification '${userRaw}'`, {
            sql: rawSql,
            startTime,
          });
        }

        const key = this.userKey(parsed.username, parsed.host);
        if (!this.users.has(key)) {
          return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(parsed)}`, {
            sql: rawSql,
            startTime,
          });
        }

        this.revokeGrant(key, scope, privileges);
      }

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^(?:SET\s+(?:SESSION\s+)?USER(?:\s*=)?|CHANGE\s+USER)\s+(.+)\s*;?$/i);
    if (m) {
      const target = this.parseUserSpec(m[1]);
      if (!target) {
        return sqlErrorEngine.fromMessage('Invalid user specification in SET USER/CHANGE USER', {
          sql: rawSql,
          startTime,
        });
      }

      const key = this.userKey(target.username, target.host);
      if (!this.users.has(key)) {
        return sqlErrorEngine.fromMessage(`Unknown user ${this.formatUser(target)}`, {
          sql: rawSql,
          startTime,
        });
      }

      this.currentUserKey = key;
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  if (/^FLUSH\s+PRIVILEGES\s*;?$/i.test(norm)) {
    if (!this.isCurrentUserAdmin()) {
      return sqlErrorEngine.fromMessage('Access denied. Only admin can flush privileges.', {
        sql: rawSql,
        startTime,
      });
    }

    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: performance.now() - startTime,
    };
  }

  if (/^SHOW\s+DATABASES\s*;?$/i.test(norm)) {
    const rows = this.listDatabases()
      .filter((name) => this.hasPrivilege('SELECT', name))
      .map((name) => ({ Database: name }));
    return {
      columns: ['Database'],
      rows,
      rowCount: rows.length,
      executionTimeMs: performance.now() - startTime,
    };
  }

  {
    const m = norm.match(/^SHOW\s+CREATE\s+DATABASE\s+[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      if (!this.isCurrentUserAdmin()) {
        return sqlErrorEngine.fromMessage('Access denied. Only admin can create databases.', {
          sql: rawSql,
          startTime,
        });
      }

      const requestedName = m[1];
      const dbName = this.resolveDatabaseName(requestedName);
      if (!dbName) {
        return sqlErrorEngine.fromMessage(`Unknown database '${requestedName}'`, {
          sql: rawSql,
          startTime,
        });
      }
      return {
        columns: ['Database', 'Create Database'],
        rows: [{ Database: dbName, 'Create Database': `CREATE DATABASE \"${dbName}\"` }],
        rowCount: 1,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(
      /^SHOW\s+(FULL\s+)?TABLES(?:\s+(?:FROM|IN)\s+[`"']?(\w+)[`"']?)?(?:\s+LIKE\s+'((?:''|[^'])*)')?\s*;?$/i,
    );
    if (m) {
      const isFull = Boolean(m[1]);
      const requestedName = m[2];
      const likePattern = m[3]?.replace(/''/g, "'");
      const likeMatcher = buildSqlLikeMatcher(likePattern);

      const dbName = requestedName
        ? this.resolveDatabaseName(requestedName)
        : this.activeDatabase;
      if (!dbName) {
        return sqlErrorEngine.fromMessage(`Unknown database '${requestedName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      if (!this.hasPrivilege('SELECT', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to SHOW TABLES on database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const db = this.databases.get(dbName);
      if (!db) return null;

      const result = db.exec(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
      );
      const key = `Tables_in_${dbName}`;
      const rows: Row[] =
        result.length > 0
          ? result[0].values
              .filter(([tableName]) => likeMatcher(String(tableName)))
              .map(([tableName, tableType]) =>
                isFull
                  ? {
                      [key]: String(tableName),
                      Table_type: String(tableType).toLowerCase() === 'view' ? 'VIEW' : 'BASE TABLE',
                    }
                  : { [key]: String(tableName) },
              )
          : [];

      return {
        columns: isFull ? [key, 'Table_type'] : [key],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(
      /^SHOW\s+OPEN\s+TABLES(?:\s+(?:FROM|IN)\s+[`"']?(\w+)[`"']?)?(?:\s+LIKE\s+'((?:''|[^'])*)')?\s*;?$/i,
    );
    if (m) {
      const requestedName = m[1];
      const likePattern = m[2]?.replace(/''/g, "'");
      const likeMatcher = buildSqlLikeMatcher(likePattern);
      const dbName = requestedName
        ? this.resolveDatabaseName(requestedName)
        : this.activeDatabase;

      if (!dbName) {
        return sqlErrorEngine.fromMessage(`Unknown database '${requestedName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      if (!this.hasPrivilege('SELECT', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to SHOW OPEN TABLES on database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const db = this.databases.get(dbName);
      if (!db) return null;

      const result = db.exec(
        "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
      );
      const rows: Row[] =
        result.length > 0
          ? result[0].values
              .map(([tableName]) => String(tableName))
              .filter((tableName) => likeMatcher(tableName))
              .map((tableName) => ({
                Database: dbName,
                Table: tableName,
                In_use: 0,
                Name_locked: 0,
              }))
          : [];

      return {
        columns: ['Database', 'Table', 'In_use', 'Name_locked'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(
      /^SHOW\s+TABLE\s+STATUS(?:\s+(?:FROM|IN)\s+[`"']?(\w+)[`"']?)?(?:\s+LIKE\s+'((?:''|[^'])*)')?\s*;?$/i,
    );
    if (m) {
      const requestedName = m[1];
      const likePattern = m[2]?.replace(/''/g, "'");
      const likeMatcher = buildSqlLikeMatcher(likePattern);
      const dbName = requestedName
        ? this.resolveDatabaseName(requestedName)
        : this.activeDatabase;

      if (!dbName) {
        return sqlErrorEngine.fromMessage(`Unknown database '${requestedName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      if (!this.hasPrivilege('SELECT', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to SHOW TABLE STATUS on database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const db = this.databases.get(dbName);
      if (!db) return null;

      const result = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      );

      const rows: Row[] =
        result.length > 0
          ? result[0].values
              .map(([tableName]) => String(tableName))
              .filter((tableName) => likeMatcher(tableName))
              .map((tableName) => {
                let rowCount = 0;
                try {
                  const countResult = db.exec(`SELECT COUNT(*) FROM \"${tableName}\"`);
                  if (countResult.length > 0) {
                    rowCount = Number(countResult[0].values[0]?.[0] ?? 0);
                  }
                } catch {
                  // Keep metadata listing resilient even when row count probing fails.
                }

                return {
                  Name: tableName,
                  Engine: 'SQLite',
                  Rows: rowCount,
                };
              })
          : [];

      return {
        columns: ['Name', 'Engine', 'Rows'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(
      /^SHOW\s+(?:CHARACTER\s+SET|CHARSET)(?:\s+LIKE\s+'((?:''|[^'])*)')?\s*;?$/i,
    );
    if (m) {
      const likePattern = m[1]?.replace(/''/g, "'");
      const likeMatcher = buildSqlLikeMatcher(likePattern);
      const rows: Row[] = [
        {
          Charset: 'utf8mb4',
          Description: 'UTF-8 Unicode',
          'Default collation': 'utf8mb4_general_ci',
          Maxlen: 4,
        },
        {
          Charset: 'utf8',
          Description: 'UTF-8 Unicode',
          'Default collation': 'utf8_general_ci',
          Maxlen: 3,
        },
        {
          Charset: 'latin1',
          Description: 'cp1252 West European',
          'Default collation': 'latin1_swedish_ci',
          Maxlen: 1,
        },
      ].filter((row) => likeMatcher(String(row.Charset)));

      return {
        columns: ['Charset', 'Description', 'Default collation', 'Maxlen'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^SHOW\s+COLLATION(?:\s+LIKE\s+'((?:''|[^'])*)')?\s*;?$/i);
    if (m) {
      const likePattern = m[1]?.replace(/''/g, "'");
      const likeMatcher = buildSqlLikeMatcher(likePattern);
      const rows: Row[] = [
        {
          Collation: 'utf8mb4_general_ci',
          Charset: 'utf8mb4',
          Id: 45,
          Default: 'Yes',
          Compiled: 'Yes',
          Sortlen: 1,
        },
        {
          Collation: 'utf8_general_ci',
          Charset: 'utf8',
          Id: 33,
          Default: 'Yes',
          Compiled: 'Yes',
          Sortlen: 1,
        },
        {
          Collation: 'latin1_swedish_ci',
          Charset: 'latin1',
          Id: 8,
          Default: 'Yes',
          Compiled: 'Yes',
          Sortlen: 1,
        },
      ].filter((row) => likeMatcher(String(row.Collation)));

      return {
        columns: ['Collation', 'Charset', 'Id', 'Default', 'Compiled', 'Sortlen'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^SHOW\s+CREATE\s+TABLE\s+(.+)\s*;?$/i);
    if (m) {
      const parsed = this.parseQualifiedName(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid table name in SHOW CREATE TABLE', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = parsed.database
        ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
        : this.activeDatabase;
      const db = this.databases.get(dbName);
      if (!db) {
        return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      if (!this.hasPrivilege('SELECT', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to SHOW CREATE TABLE on database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const escapedName = parsed.name.replace(/'/g, "''");
      const result = db.exec(
        `SELECT sql FROM sqlite_master WHERE type='table' AND lower(name)=lower('${escapedName}') LIMIT 1`,
      );
      if (result.length === 0 || result[0].values.length === 0) {
        return sqlErrorEngine.fromMessage(`Unknown table '${parsed.name}'`, {
          sql: rawSql,
          startTime,
        });
      }

      return {
        columns: ['Table', 'Create Table'],
        rows: [
          {
            Table: parsed.name,
            'Create Table': String(result[0].values[0]?.[0] ?? ''),
          },
        ],
        rowCount: 1,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(
      /^SHOW\s+(?:INDEX|INDEXES|KEYS)\s+(?:FROM|IN)\s+(.+?)(?:\s+(?:FROM|IN)\s+[`"']?(\w+)[`"']?)?\s*;?$/i,
    );
    if (m) {
      const parsed = this.parseQualifiedName(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid table name in SHOW INDEX', {
          sql: rawSql,
          startTime,
        });
      }

      const explicitDb = m[2];
      const dbName = explicitDb
        ? (this.resolveDatabaseName(explicitDb) ?? explicitDb)
        : parsed.database
          ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
          : this.activeDatabase;

      const db = this.databases.get(dbName);
      if (!db) {
        return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      if (!this.hasPrivilege('SELECT', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to SHOW INDEX on database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const tableName = parsed.name;
      const escapedTableName = tableName.replace(/'/g, "''");
      const exists = db.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND lower(name)=lower('${escapedTableName}') LIMIT 1`,
      );
      if (exists.length === 0 || exists[0].values.length === 0) {
        return sqlErrorEngine.fromMessage(`Unknown table '${tableName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      const indexList = db.exec(`PRAGMA index_list(\"${tableName}\")`);
      const rows: Row[] = [];
      if (indexList.length > 0) {
        for (const row of indexList[0].values) {
          const indexName = String(row[1] ?? '');
          if (!indexName) continue;

          const nonUnique = Number(row[2] ?? 0) === 1 ? 0 : 1;
          const indexInfo = db.exec(`PRAGMA index_info(\"${indexName}\")`);
          if (indexInfo.length === 0 || indexInfo[0].values.length === 0) {
            rows.push({
              Table: tableName,
              Non_unique: nonUnique,
              Key_name: indexName,
              Seq_in_index: 1,
              Column_name: null,
              Index_type: 'BTREE',
            });
            continue;
          }

          for (const infoRow of indexInfo[0].values) {
            rows.push({
              Table: tableName,
              Non_unique: nonUnique,
              Key_name: indexName,
              Seq_in_index: Number(infoRow[0] ?? 0) + 1,
              Column_name: String(infoRow[2] ?? ''),
              Index_type: 'BTREE',
            });
          }
        }
      }

      return {
        columns: ['Table', 'Non_unique', 'Key_name', 'Seq_in_index', 'Column_name', 'Index_type'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^SHOW\s+CREATE\s+VIEW\s+(.+)\s*;?$/i);
    if (m) {
      const parsed = this.parseQualifiedName(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid view name in SHOW CREATE VIEW', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = parsed.database
        ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
        : this.activeDatabase;
      const db = this.databases.get(dbName);
      if (!db) {
        return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      if (!this.hasPrivilege('SELECT', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to SHOW CREATE VIEW on database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const escapedName = parsed.name.replace(/'/g, "''");
      const result = db.exec(
        `SELECT sql FROM sqlite_master WHERE type='view' AND lower(name)=lower('${escapedName}') LIMIT 1`,
      );
      if (result.length === 0 || result[0].values.length === 0) {
        return sqlErrorEngine.fromMessage(`Unknown view '${parsed.name}'`, {
          sql: rawSql,
          startTime,
        });
      }

      return {
        columns: ['View', 'Create View'],
        rows: [
          {
            View: parsed.name,
            'Create View': String(result[0].values[0]?.[0] ?? ''),
          },
        ],
        rowCount: 1,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^SHOW\s+TRIGGERS(?:\s+(?:FROM|IN)\s+[`"']?(\w+)[`"']?)?\s*;?$/i);
    if (m) {
      const requestedName = m[1];
      const dbName = requestedName
        ? this.resolveDatabaseName(requestedName)
        : this.activeDatabase;
      if (!dbName) {
        return sqlErrorEngine.fromMessage(`Unknown database '${requestedName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      if (!this.hasPrivilege('SELECT', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to SHOW TRIGGERS on database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const db = this.databases.get(dbName);
      if (!db) {
        return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      const result = db.exec(
        `SELECT name, tbl_name, sql
           FROM sqlite_master
          WHERE type='trigger'
          ORDER BY name`,
      );
      const rowsByTrigger = new Map<string, Row>();

      if (result.length > 0) {
        result[0].values.forEach(([name, table, statement]) => {
          const triggerName = String(name);
          rowsByTrigger.set(triggerName.toLowerCase(), {
            Trigger: triggerName,
            Table: String(table),
            Statement: String(statement ?? ''),
          });
        });
      }

      Array.from(this.triggers.values())
        .filter((trigger) => trigger.database === dbName)
        .forEach((trigger) => {
          rowsByTrigger.set(trigger.name.toLowerCase(), {
            Trigger: trigger.name,
            Table: trigger.table,
            Statement: trigger.definition,
          });
        });

      const rows = Array.from(rowsByTrigger.values()).sort((a, b) =>
        String(a.Trigger).localeCompare(String(b.Trigger)),
      );

      return {
        columns: ['Trigger', 'Table', 'Statement'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^SHOW\s+CREATE\s+TRIGGER\s+(.+)\s*;?$/i);
    if (m) {
      const parsed = this.parseQualifiedName(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid trigger name in SHOW CREATE TRIGGER', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = parsed.database
        ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
        : this.activeDatabase;
      const db = this.databases.get(dbName);
      if (!db) {
        return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      const storedTrigger = this.triggers.get(this.triggerKey(dbName, parsed.name));
      const escapedName = parsed.name.replace(/'/g, "''");
      const result = db.exec(
        `SELECT sql FROM sqlite_master WHERE type='trigger' AND LOWER(name)=LOWER('${escapedName}')`,
      );
      if (!storedTrigger && (result.length === 0 || result[0].values.length === 0)) {
        return sqlErrorEngine.fromMessage(`Unknown trigger '${parsed.name}'`, {
          sql: rawSql,
          startTime,
        });
      }

      const statement = storedTrigger
        ? storedTrigger.definition
        : String(result[0].values[0][0] ?? '');
      return {
        columns: ['Trigger', 'Create Trigger'],
        rows: [{ Trigger: parsed.name, 'Create Trigger': statement }],
        rowCount: 1,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(
      /^CREATE\s+(?:DATABASE|SCHEMA)(?:\s+IF\s+NOT\s+EXISTS)?\s+[`"']?(\w+)[`"']?\s*;?$/i,
    );
    if (m) {
      const requestedName = m[1];
      const dbName = this.resolveDatabaseName(requestedName) ?? requestedName;
      const hasIfNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(norm);

      if (this.databases.has(dbName)) {
        if (hasIfNotExists) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: performance.now() - startTime,
          };
        }
        return sqlErrorEngine.fromMessage(`Database '${dbName}' already exists`, {
          sql: rawSql,
          startTime,
        });
      }

      if (!this.sqlModule) {
        return sqlErrorEngine.fromMessage('Database engine is not initialized.', {
          sql: rawSql,
          startTime,
        });
      }

      const newDb = new this.sqlModule.Database();
      newDb.run('PRAGMA foreign_keys = ON;');
      this.databases.set(dbName, newDb);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(
      /^DROP\s+(?:DATABASE|SCHEMA)(?:\s+IF\s+EXISTS)?\s+[`"']?(\w+)[`"']?\s*;?$/i,
    );
    if (m) {
      const requestedName = m[1];
      const dbName = this.resolveDatabaseName(requestedName) ?? requestedName;
      const hasIfExists = /\bIF\s+EXISTS\b/i.test(norm);

      if (dbName.toLowerCase() === 'main') {
        return sqlErrorEngine.fromMessage("Cannot drop default database 'main'", {
          sql: rawSql,
          startTime,
        });
      }

      const db = this.databases.get(dbName);
      if (!db) {
        if (hasIfExists) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: performance.now() - startTime,
          };
        }
        return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      db.close();
      this.databases.delete(dbName);
      for (const key of Array.from(this.procedures.keys())) {
        if (key.startsWith(`${dbName.toLowerCase()}.`)) {
          this.procedures.delete(key);
        }
      }
      for (const key of Array.from(this.functions.keys())) {
        if (key.startsWith(`${dbName.toLowerCase()}.`)) {
          this.functions.delete(key);
        }
      }
      for (const key of Array.from(this.triggers.keys())) {
        if (key.startsWith(`${dbName.toLowerCase()}.`)) {
          this.triggers.delete(key);
        }
      }
      for (const key of Array.from(this.cursors.keys())) {
        if (key.startsWith(`${dbName.toLowerCase()}.`)) {
          this.cursors.delete(key);
        }
      }
      if (this.activeDatabase === dbName) {
        this.activeDatabase = 'main';
      }
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const triggerNormalization = normalizeMySqlTriggerDefinition(rawSql);
    if (triggerNormalization.error) {
      return sqlErrorEngine.fromMessage(triggerNormalization.error, {
        sql: rawSql,
        startTime,
      });
    }

    const normalizedTrigger = triggerNormalization.normalized;
    if (normalizedTrigger) {
      const hasIfNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(rawSql);
      const parsedName = this.parseQualifiedName(normalizedTrigger.name);
      if (!parsedName) {
        return sqlErrorEngine.fromMessage('Invalid trigger name in CREATE TRIGGER', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = parsedName.database
        ? (this.resolveDatabaseName(parsedName.database) ?? parsedName.database)
        : this.activeDatabase;
      const db = this.databases.get(dbName);
      if (!db) {
        return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      if (!this.hasPrivilege('CREATE', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to CREATE trigger in database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const triggerKey = this.triggerKey(dbName, parsedName.name);
      if (this.triggers.has(triggerKey)) {
        if (hasIfNotExists) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: performance.now() - startTime,
          };
        }

        return sqlErrorEngine.fromMessage(`Trigger '${parsedName.name}' already exists`, {
          sql: rawSql,
          startTime,
        });
      }

      try {
        db.run(normalizedTrigger.sqliteSql);
      } catch (error) {
        return sqlErrorEngine.fromUnknownError(error, {
          sql: rawSql,
          translatedSql: normalizedTrigger.sqliteSql,
          startTime,
        });
      }

      this.triggers.set(triggerKey, {
        database: dbName,
        name: parsedName.name,
        table: normalizedTrigger.table,
        definition: normalizedTrigger.definition,
        sqliteDefinition: normalizedTrigger.sqliteSql,
      });

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const procHeader = rawSql
      .trim()
      .match(
        /^CREATE\s+PROCEDURE(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s(]+)\s*\(([\s\S]*)\)\s*BEGIN\b/i,
      );
    if (procHeader) {
      const extracted = this.extractRoutineBody(rawSql.trim());
      if (extracted) {
      const hasIfNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(rawSql);
      const name = this.parseQualifiedName(procHeader[1]);
      if (!name) {
        return sqlErrorEngine.fromMessage('Invalid procedure name in CREATE PROCEDURE', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = name.database
        ? (this.resolveDatabaseName(name.database) ?? name.database)
        : this.activeDatabase;
      if (!this.databases.has(dbName)) {
        return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      if (!this.hasPrivilege('CREATE', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to CREATE procedure in database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const procName = name.name;
      const procKey = this.procedureKey(dbName, procName);
      if (this.procedures.has(procKey)) {
        if (hasIfNotExists) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: performance.now() - startTime,
          };
        }
        return sqlErrorEngine.fromMessage(`Procedure '${procName}' already exists`, {
          sql: rawSql,
          startTime,
        });
      }

      this.procedures.set(procKey, {
        database: dbName,
        name: procName,
        params: this.parseProcedureParams(procHeader[2] ?? ''),
        body: extracted.body,
        definition: rawSql.trim().replace(/;$/, ''),
      });

      for (const cursor of extractCursorDefinitions(extracted.body)) {
        this.cursors.set(this.cursorKey(dbName, procName, cursor.name), {
          database: dbName,
          procedureName: procName,
          name: cursor.name,
          query: cursor.query,
          definition: cursor.definition,
        });
      }

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
      }
    }
  }

  // CREATE FUNCTION
  {
    const funcHeader = rawSql
      .trim()
      .match(
        /^CREATE\s+FUNCTION(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s(]+)\s*\(([\s\S]*?)\)\s*RETURNS\s+[\s\S]+?\s+(?:DETERMINISTIC\s+)?BEGIN\b/i,
      );
    if (funcHeader) {
      const extracted = this.extractRoutineBody(rawSql.trim());
      if (!extracted) {
        return sqlErrorEngine.fromMessage(
          'Invalid CREATE FUNCTION body. Expected BEGIN ... END block.',
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const hasIfNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(rawSql);
      const name = this.parseQualifiedName(funcHeader[1]);
      if (!name) {
        return sqlErrorEngine.fromMessage('Invalid function name in CREATE FUNCTION', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = name.database
        ? (this.resolveDatabaseName(name.database) ?? name.database)
        : this.activeDatabase;
      if (!this.databases.has(dbName)) {
        return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      if (!this.hasPrivilege('CREATE', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to CREATE function in database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const funcName = name.name;
      const funcKey = this.functionKey(dbName, funcName);
      if (this.functions.has(funcKey)) {
        if (hasIfNotExists) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: performance.now() - startTime,
          };
        }
        return sqlErrorEngine.fromMessage(`Function '${funcName}' already exists`, {
          sql: rawSql,
          startTime,
        });
      }

      this.functions.set(funcKey, {
        database: dbName,
        name: funcName,
        params: this.parseProcedureParams(funcHeader[2] ?? ''),
        body: extracted.body,
        definition: rawSql.trim().replace(/;$/, ''),
      });

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^DROP\s+TRIGGER(?:\s+IF\s+EXISTS)?\s+(.+)\s*;?$/i);
    if (m) {
      const hasIfExists = /\bIF\s+EXISTS\b/i.test(norm);
      const parsed = this.parseQualifiedName(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid trigger name in DROP TRIGGER', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = parsed.database
        ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
        : this.activeDatabase;
      if (!this.hasPrivilege('DROP', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to DROP trigger in database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const db = this.databases.get(dbName);
      if (!db) {
        if (hasIfExists) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: performance.now() - startTime,
          };
        }

        return sqlErrorEngine.fromMessage(`Unknown database '${dbName}'`, {
          sql: rawSql,
          startTime,
        });
      }

      try {
        db.run(`DROP TRIGGER IF EXISTS ${this.quoteIdentifier(parsed.name)}`);
      } catch (error) {
        return sqlErrorEngine.fromUnknownError(error, {
          sql: rawSql,
          startTime,
        });
      }

      this.triggers.delete(this.triggerKey(dbName, parsed.name));
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^DROP\s+PROCEDURE(?:\s+IF\s+EXISTS)?\s+(.+)\s*;?$/i);
    if (m) {
      const hasIfExists = /\bIF\s+EXISTS\b/i.test(norm);
      const parsed = this.parseQualifiedName(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid procedure name in DROP PROCEDURE', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = parsed.database
        ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
        : this.activeDatabase;
      if (!this.hasPrivilege('DROP', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to DROP procedure in database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const procKey = this.procedureKey(dbName, parsed.name);
      if (!this.procedures.has(procKey)) {
        if (hasIfExists) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: performance.now() - startTime,
          };
        }
        return sqlErrorEngine.fromMessage(`Unknown procedure '${parsed.name}'`, {
          sql: rawSql,
          startTime,
        });
      }

      this.clearProcedureMetadata(dbName, parsed.name);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^SHOW\s+PROCEDURE\s+STATUS(?:\s+LIKE\s+'([^']+)')?\s*;?$/i);
    if (m) {
      const likePattern = m[1]?.replace(/''/g, "'");
      const likeMatcher = buildSqlLikeMatcher(likePattern);
      const rows = Array.from(this.procedures.values())
        .filter((proc) => this.hasPrivilege('SELECT', proc.database))
        .filter((proc) => likeMatcher(proc.name))
        .sort((a, b) => `${a.database}.${a.name}`.localeCompare(`${b.database}.${b.name}`))
        .map((proc) => ({
          Db: proc.database,
          Name: proc.name,
          Type: 'PROCEDURE',
        }));

      return {
        columns: ['Db', 'Name', 'Type'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(
      /^SHOW\s+CURSORS(?:\s+(?:FROM|IN)\s+[`"']?(\w+)[`"']?)?(?:\s+LIKE\s+'([^']+)')?\s*;?$/i,
    );
    if (m) {
      const requestedName = m[1];
      const dbName = requestedName
        ? (this.resolveDatabaseName(requestedName) ?? requestedName)
        : this.activeDatabase;
      const likePattern = m[2]?.replace(/''/g, "'");
      const likeMatcher = buildSqlLikeMatcher(likePattern);

      const rows = Array.from(this.cursors.values())
        .filter((cursor) => cursor.database === dbName)
        .filter((cursor) => likeMatcher(cursor.name))
        .sort((a, b) =>
          `${a.procedureName}.${a.name}`.localeCompare(`${b.procedureName}.${b.name}`),
        )
        .map((cursor) => ({
          Db: cursor.database,
          Procedure: cursor.procedureName,
          Cursor: cursor.name,
          Query: cursor.query,
        }));

      return {
        columns: ['Db', 'Procedure', 'Cursor', 'Query'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^SHOW\s+CREATE\s+CURSOR\s+(.+)\s*;?$/i);
    if (m) {
      const parsed = this.parseCursorReference(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid cursor name in SHOW CREATE CURSOR', {
          sql: rawSql,
          startTime,
        });
      }

      const matches = Array.from(this.cursors.values()).filter((cursor) => {
        const dbMatches = parsed.database ? cursor.database === parsed.database : true;
        const procedureMatches = parsed.procedureName
          ? cursor.procedureName === parsed.procedureName
          : true;
        return (
          dbMatches &&
          procedureMatches &&
          cursor.name.toLowerCase() === parsed.name.toLowerCase()
        );
      });

      if (matches.length === 0) {
        return sqlErrorEngine.fromMessage(`Unknown cursor '${parsed.name}'`, {
          sql: rawSql,
          startTime,
        });
      }

      const cursor = matches[0];
      return {
        columns: ['Cursor', 'Create Cursor'],
        rows: [
          {
            Cursor: `${cursor.procedureName}.${cursor.name}`,
            'Create Cursor': cursor.definition,
          },
        ],
        rowCount: 1,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^SHOW\s+CREATE\s+PROCEDURE\s+(.+)\s*;?$/i);
    if (m) {
      const parsed = this.parseQualifiedName(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid procedure name in SHOW CREATE PROCEDURE', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = parsed.database
        ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
        : this.activeDatabase;
      const procedure = this.procedures.get(this.procedureKey(dbName, parsed.name));
      if (!procedure) {
        return sqlErrorEngine.fromMessage(`Unknown procedure '${parsed.name}'`, {
          sql: rawSql,
          startTime,
        });
      }

      return {
        columns: ['Procedure', 'Create Procedure'],
        rows: [
          {
            Procedure: `${procedure.database}.${procedure.name}`,
            'Create Procedure': procedure.definition,
          },
        ],
        rowCount: 1,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^DROP\s+FUNCTION(?:\s+IF\s+EXISTS)?\s+(.+)\s*;?$/i);
    if (m) {
      const hasIfExists = /\bIF\s+EXISTS\b/i.test(norm);
      const parsed = this.parseQualifiedName(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid function name in DROP FUNCTION', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = parsed.database
        ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
        : this.activeDatabase;
      if (!this.hasPrivilege('DROP', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to DROP function in database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      const fnKey = this.functionKey(dbName, parsed.name);
      if (!this.functions.has(fnKey)) {
        if (hasIfExists) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: performance.now() - startTime,
          };
        }
        return sqlErrorEngine.fromMessage(`Unknown function '${parsed.name}'`, {
          sql: rawSql,
          startTime,
        });
      }

      this.functions.delete(fnKey);
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^SHOW\s+FUNCTION\s+STATUS(?:\s+LIKE\s+'([^']+)')?\s*;?$/i);
    if (m) {
      const likePattern = m[1]?.replace(/''/g, "'");
      const likeMatcher = buildSqlLikeMatcher(likePattern);
      const rows = Array.from(this.functions.values())
        .filter((fn) => this.hasPrivilege('SELECT', fn.database))
        .filter((fn) => likeMatcher(fn.name))
        .sort((a, b) => `${a.database}.${a.name}`.localeCompare(`${b.database}.${b.name}`))
        .map((fn) => ({
          Db: fn.database,
          Name: fn.name,
          Type: 'FUNCTION',
        }));

      return {
        columns: ['Db', 'Name', 'Type'],
        rows,
        rowCount: rows.length,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const m = norm.match(/^SHOW\s+CREATE\s+FUNCTION\s+(.+)\s*;?$/i);
    if (m) {
      const parsed = this.parseQualifiedName(m[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid function name in SHOW CREATE FUNCTION', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = parsed.database
        ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
        : this.activeDatabase;
      const fn = this.functions.get(this.functionKey(dbName, parsed.name));
      if (!fn) {
        return sqlErrorEngine.fromMessage(`Unknown function '${parsed.name}'`, {
          sql: rawSql,
          startTime,
        });
      }

      return {
        columns: ['Function', 'Create Function'],
        rows: [
          {
            Function: `${fn.database}.${fn.name}`,
            'Create Function': fn.definition,
          },
        ],
        rowCount: 1,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  {
    const callMatch = rawSql.trim().match(/^CALL\s+([^\s(]+)\s*\((.*)\)\s*;?$/i);
    if (callMatch) {
      const parsed = this.parseQualifiedName(callMatch[1]);
      if (!parsed) {
        return sqlErrorEngine.fromMessage('Invalid procedure name in CALL', {
          sql: rawSql,
          startTime,
        });
      }

      const dbName = parsed.database
        ? (this.resolveDatabaseName(parsed.database) ?? parsed.database)
        : this.activeDatabase;
      const procedure = this.procedures.get(this.procedureKey(dbName, parsed.name));
      if (!procedure) {
        return sqlErrorEngine.fromMessage(`Unknown procedure '${parsed.name}'`, {
          sql: rawSql,
          startTime,
        });
      }

      return this.executeStoredProcedure(procedure, callMatch[2] ?? '', startTime, rawSql);
    }
  }

  {
    const m = norm.match(/^USE\s+[`"']?(\w+)[`"']?\s*;?$/i);
    if (m) {
      const requestedName = m[1];
      const dbName = this.resolveDatabaseName(requestedName);
      if (!dbName) {
        return sqlErrorEngine.fromMessage(`Unknown database '${requestedName}'`, {
          sql: rawSql,
          startTime,
        });
      }
      if (!this.hasPrivilege('SELECT', dbName)) {
        return sqlErrorEngine.fromMessage(
          `Access denied for user '${this.getCurrentUserDisplay()}' to USE database '${dbName}'`,
          {
            sql: rawSql,
            startTime,
          },
        );
      }

      this.activeDatabase = dbName;
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }
  }

  return null;
}
