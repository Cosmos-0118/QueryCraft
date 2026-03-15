import type { QueryResult, TableSchema, Row } from '@/types/database';
import { sqlErrorEngine } from '@/lib/engine/sql-error-engine';
import { loadSqlJs, resetSqlJsLoader } from './sqljs-loader';
import { stripComments } from './utils';
import { translateMySQL } from './translation';
import { splitSqlStatements } from './statement-splitter';
import { isPlSqlBlock, runPlSqlBlock } from './plsql-runtime';
import type { SqlJs, SqlJsDatabase, SupportedPrivilege, DbUser, GrantEntry } from './types';
import { SUPPORTED_PRIVILEGES } from './types';

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

export class SqlExecutor {
  private sqlModule: SqlJs | null = null;
  private databases = new Map<string, SqlJsDatabase>();
  private procedures = new Map<string, StoredProcedure>();
  private activeDatabase = 'main';
  private users = new Map<string, DbUser>();
  private grants = new Map<string, GrantEntry[]>();
  private currentUserKey = 'admin@localhost';

  private procedureKey(database: string, name: string): string {
    return `${database.toLowerCase()}.${name.toLowerCase()}`;
  }

  private parseQualifiedName(raw: string): { database?: string; name: string } | null {
    const cleaned = raw.trim().replace(/;$/, '');
    if (!cleaned) return null;

    const parts = cleaned
      .split('.')
      .map((part) => this.normalizeIdentifier(part))
      .filter(Boolean);

    if (parts.length === 1) {
      return { name: parts[0] };
    }
    if (parts.length === 2) {
      return { database: parts[0], name: parts[1] };
    }
    return null;
  }

  private splitCommaSafe(raw: string): string[] {
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

  private parseProcedureParams(raw: string): ProcedureParam[] {
    const source = raw.trim();
    if (!source) return [];

    return this.splitCommaSafe(source)
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

  private toSqlLiteral(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return 'NULL';
    if (/^null$/i.test(trimmed)) return 'NULL';
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return trimmed;
    if (/^'.*'$/.test(trimmed)) return trimmed;
    if (/^".*"$/.test(trimmed)) {
      return `'${trimmed.slice(1, -1).replace(/'/g, "''")}'`;
    }
    return `'${trimmed.replace(/'/g, "''")}'`;
  }

  private substituteProcedureParams(
    body: string,
    params: ProcedureParam[],
    args: string[],
  ): { sql: string; error?: string } {
    let rewritten = body;

    for (let i = 0; i < params.length; i += 1) {
      const param = params[i];
      if (!param) continue;

      if (param.mode !== 'IN') {
        return {
          sql: '',
          error: `Procedure parameter mode '${param.mode}' is not supported yet. Use IN parameters only.`,
        };
      }

      const argSql = this.toSqlLiteral(args[i] ?? 'NULL');
      const namePattern = new RegExp(`\\b${param.name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'gi');
      rewritten = rewritten.replace(namePattern, argSql);
    }

    return { sql: rewritten };
  }

  private executeStoredProcedure(
    procedure: StoredProcedure,
    argsRaw: string,
    startTime: number,
    rawSql: string,
  ): QueryResult {
    if (!this.hasPrivilege('EXECUTE', procedure.database)) {
      return sqlErrorEngine.fromMessage(
        `Access denied for user '${this.getCurrentUserDisplay()}' to EXECUTE procedure '${procedure.name}'`,
        {
          sql: rawSql,
          startTime,
        },
      );
    }

    const args = argsRaw.trim() ? this.splitCommaSafe(argsRaw) : [];
    if (args.length !== procedure.params.length) {
      return sqlErrorEngine.fromMessage(
        `Procedure '${procedure.name}' expects ${procedure.params.length} argument(s) but received ${args.length}`,
        {
          sql: rawSql,
          startTime,
        },
      );
    }

    const substituted = this.substituteProcedureParams(procedure.body, procedure.params, args);
    if (substituted.error) {
      return sqlErrorEngine.fromMessage(substituted.error, {
        sql: rawSql,
        startTime,
      });
    }

    const previousDb = this.activeDatabase;
    const switched = this.useDatabase(procedure.database);
    if (switched.error) {
      return switched;
    }

    try {
      const result = this.loadSQL(substituted.sql);
      if (result.error) return result;
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    } finally {
      this.useDatabase(previousDb);
    }
  }

  private userKey(username: string, host = 'localhost'): string {
    return `${username}@${host}`.toLowerCase();
  }

  private normalizeIdentifier(raw: string): string {
    const value = raw.trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('`') && value.endsWith('`'))
    ) {
      return value.slice(1, -1);
    }
    return value;
  }

  private parseUserSpec(raw: string): { username: string; host: string } | null {
    const spec = raw.trim().replace(/;$/, '');
    if (!spec) return null;

    const parts = spec
      .split('@')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0 || parts.length > 2) return null;

    const username = this.normalizeIdentifier(parts[0]);
    const host = this.normalizeIdentifier(parts[1] ?? 'localhost');
    if (!username || !host) return null;
    return { username, host };
  }

  private formatUser(user: { username: string; host: string }): string {
    return `'${user.username}'@'${user.host}'`;
  }

  private displayUser(user: { username: string; host: string }): string {
    return user.host.toLowerCase() === 'localhost'
      ? user.username
      : `${user.username}@${user.host}`;
  }

  private getCurrentUser(): DbUser {
    return this.users.get(this.currentUserKey) ?? { username: 'admin', host: 'localhost' };
  }

  getCurrentUserDisplay(): string {
    const current = this.getCurrentUser();
    return `${current.username}@${current.host}`;
  }

  private isCurrentUserAdmin(): boolean {
    const current = this.getCurrentUser();
    return current.username.toLowerCase() === 'admin';
  }

  private normalizePrivilegeToken(raw: string): SupportedPrivilege | null {
    const token = raw.trim().toUpperCase().replace(/\s+/g, ' ');
    const mapped = token === 'ALL' ? 'ALL PRIVILEGES' : token;
    return SUPPORTED_PRIVILEGES.has(mapped as SupportedPrivilege)
      ? (mapped as SupportedPrivilege)
      : null;
  }

  private splitCommaSeparated(raw: string): string[] {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private parseGrantScope(raw: string): { database: string; table: string } | null {
    const cleaned = raw.trim();
    const scopeMatch = cleaned.match(/^(.+?)\.(.+)$/);
    if (!scopeMatch) return null;

    const database = this.normalizeIdentifier(scopeMatch[1]);
    const table = this.normalizeIdentifier(scopeMatch[2]);
    if (!database || !table) return null;
    return { database, table };
  }

  private getGrantEntries(userKey: string): GrantEntry[] {
    return this.grants.get(userKey) ?? [];
  }

  private setGrantEntries(userKey: string, entries: GrantEntry[]): void {
    this.grants.set(userKey, entries);
  }

  private upsertGrant(
    userKey: string,
    scope: { database: string; table: string },
    privileges: SupportedPrivilege[],
    withGrantOption: boolean,
  ): void {
    const entries = this.getGrantEntries(userKey);
    const existing = entries.find(
      (entry) =>
        entry.database.toLowerCase() === scope.database.toLowerCase() &&
        entry.table.toLowerCase() === scope.table.toLowerCase(),
    );

    if (existing) {
      for (const privilege of privileges) {
        existing.privileges.add(privilege);
      }
      existing.withGrantOption = existing.withGrantOption || withGrantOption;
      this.setGrantEntries(userKey, entries);
      return;
    }

    entries.push({
      database: scope.database,
      table: scope.table,
      privileges: new Set(privileges),
      withGrantOption,
    });
    this.setGrantEntries(userKey, entries);
  }

  private revokeGrant(
    userKey: string,
    scope: { database: string; table: string },
    privileges: SupportedPrivilege[],
  ): void {
    const entries = this.getGrantEntries(userKey);
    const nextEntries: GrantEntry[] = [];

    for (const entry of entries) {
      const sameScope =
        entry.database.toLowerCase() === scope.database.toLowerCase() &&
        entry.table.toLowerCase() === scope.table.toLowerCase();

      if (!sameScope) {
        nextEntries.push(entry);
        continue;
      }

      if (entry.privileges.has('ALL PRIVILEGES')) {
        if (privileges.includes('ALL PRIVILEGES')) {
          continue;
        }
        entry.privileges.delete('ALL PRIVILEGES');
        SUPPORTED_PRIVILEGES.forEach((privilege) => {
          if (privilege !== 'ALL PRIVILEGES') {
            entry.privileges.add(privilege);
          }
        });
      }

      for (const privilege of privileges) {
        if (privilege === 'ALL PRIVILEGES') {
          entry.privileges.clear();
          break;
        }
        entry.privileges.delete(privilege);
      }

      if (entry.privileges.size > 0) {
        nextEntries.push(entry);
      }
    }

    this.setGrantEntries(userKey, nextEntries);
  }

  private requiredPrivilegeForSql(sql: string): SupportedPrivilege | null {
    const norm = stripComments(sql).replace(/\s+/g, ' ').trim().toUpperCase();
    if (!norm) return null;

    if (/^(SELECT|SHOW|DESC|DESCRIBE|EXPLAIN|WITH\b.*SELECT\b)/.test(norm)) return 'SELECT';
    if (/^(INSERT|REPLACE)/.test(norm)) return 'INSERT';
    if (/^UPDATE/.test(norm)) return 'UPDATE';
    if (/^(DELETE|TRUNCATE)/.test(norm)) return 'DELETE';
    if (/^CALL/.test(norm)) return 'EXECUTE';
    if (/^CREATE\s+INDEX/.test(norm)) return 'INDEX';
    if (/^CREATE/.test(norm)) return 'CREATE';
    if (/^ALTER/.test(norm)) return 'ALTER';
    if (/^(DROP|RENAME)/.test(norm)) return 'DROP';

    return null;
  }

  private hasPrivilege(privilege: SupportedPrivilege, database: string): boolean {
    if (this.isCurrentUserAdmin()) return true;

    const userEntries = this.getGrantEntries(this.currentUserKey);
    const dbLower = database.toLowerCase();
    for (const entry of userEntries) {
      const dbMatches = entry.database === '*' || entry.database.toLowerCase() === dbLower;
      const tableScopeAllowsDatabaseOps = entry.table === '*';

      if (!dbMatches || !tableScopeAllowsDatabaseOps) continue;

      if (entry.privileges.has('ALL PRIVILEGES') || entry.privileges.has(privilege)) {
        return true;
      }
    }

    return false;
  }

  private denyIfNoPrivilege(sql: string, startTime: number): QueryResult | null {
    const required = this.requiredPrivilegeForSql(sql);
    if (!required) return null;
    if (this.hasPrivilege(required, this.activeDatabase)) return null;

    return sqlErrorEngine.fromMessage(
      `Access denied for user '${this.getCurrentUserDisplay()}' to ${required} on database '${this.activeDatabase}'`,
      {
        sql,
        startTime,
      },
    );
  }

  private getActiveDb(): SqlJsDatabase | null {
    return this.databases.get(this.activeDatabase) ?? null;
  }

  private listDatabases(): string[] {
    return Array.from(this.databases.keys()).sort((a, b) => a.localeCompare(b));
  }

  private resolveDatabaseName(name: string): string | undefined {
    const direct = this.databases.has(name) ? name : undefined;
    if (direct) return direct;

    const lower = name.toLowerCase();
    return this.listDatabases().find((dbName) => dbName.toLowerCase() === lower);
  }

  private handleDatabaseCommand(rawSql: string, startTime: number): QueryResult | null {
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
      const m = norm.match(/^SHOW\s+(?:FULL\s+)?TABLES\s+(?:FROM|IN)\s+[`"']?(\w+)[`"']?\s*;?$/i);
      if (m) {
        if (!this.isCurrentUserAdmin()) {
          return sqlErrorEngine.fromMessage('Access denied. Only admin can drop databases.', {
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
        const db = this.databases.get(dbName);
        if (!db) return null;
        const result = db.exec(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        );
        const key = `Tables_in_${dbName}`;
        const rows: Row[] =
          result.length > 0
            ? result[0].values.map(([tableName]) => ({ [key]: String(tableName) }))
            : [];
        return {
          columns: [key],
          rows,
          rowCount: rows.length,
          executionTimeMs: performance.now() - startTime,
        };
      }
    }

    {
      const m = norm.match(/^SHOW\s+TRIGGERS(?:\s+(?:FROM|IN)\s+[`"']?(\w+)[`"']?)?\s*;?$/i);
      if (m) {
        const requestedName = m[1];
        const dbName = requestedName ? this.resolveDatabaseName(requestedName) : this.activeDatabase;
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
        const rows: Row[] =
          result.length > 0
            ? result[0].values.map(([name, table, statement]) => ({
                Trigger: String(name),
                Table: String(table),
                Statement: String(statement ?? ''),
              }))
            : [];

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

        const escapedName = parsed.name.replace(/'/g, "''");
        const result = db.exec(
          `SELECT sql FROM sqlite_master WHERE type='trigger' AND LOWER(name)=LOWER('${escapedName}')`,
        );
        if (result.length === 0 || result[0].values.length === 0) {
          return sqlErrorEngine.fromMessage(`Unknown trigger '${parsed.name}'`, {
            sql: rawSql,
            startTime,
          });
        }

        const statement = String(result[0].values[0][0] ?? '');
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

        this.databases.set(dbName, new this.sqlModule.Database());
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
      const createRoutine = rawSql
        .trim()
        .match(
          /^CREATE\s+PROCEDURE(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s(]+)\s*\(([\s\S]*)\)\s*BEGIN\s+([\s\S]*?)\s*END\s*;?$/i,
        );
      if (createRoutine) {
        const hasIfNotExists = /\bIF\s+NOT\s+EXISTS\b/i.test(rawSql);
        const name = this.parseQualifiedName(createRoutine[1]);
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
          params: this.parseProcedureParams(createRoutine[2] ?? ''),
          body: createRoutine[3].trim(),
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

        this.procedures.delete(procKey);
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
        const likePattern = m[1]?.toLowerCase();
        const rows = Array.from(this.procedures.values())
          .filter((proc) => this.hasPrivilege('SELECT', proc.database))
          .filter((proc) => !likePattern || proc.name.toLowerCase().includes(likePattern))
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

  async init(): Promise<void> {
    const SQL = await loadSqlJs();
    this.sqlModule = SQL;
    this.databases.clear();
    this.procedures.clear();
    this.databases.set('main', new SQL.Database());
    this.activeDatabase = 'main';

    this.users.clear();
    this.grants.clear();
    const admin: DbUser = { username: 'admin', host: 'localhost' };
    const adminKey = this.userKey(admin.username, admin.host);
    this.users.set(adminKey, admin);
    this.grants.set(adminKey, [
      {
        database: '*',
        table: '*',
        privileges: new Set<SupportedPrivilege>(['ALL PRIVILEGES']),
        withGrantOption: true,
      },
    ]);
    this.currentUserKey = adminKey;
  }

  isReady(): boolean {
    return this.getActiveDb() !== null;
  }

  getActiveDatabase(): string {
    return this.activeDatabase;
  }

  getDatabases(): string[] {
    return this.listDatabases();
  }

  getUsers(): string[] {
    return Array.from(this.users.values())
      .sort((a, b) => this.displayUser(a).localeCompare(this.displayUser(b)))
      .map((user) => this.displayUser(user));
  }

  useUser(name: string): QueryResult {
    const parsed = this.parseUserSpec(name);
    if (!parsed) {
      return sqlErrorEngine.fromMessage(`Invalid user '${name}'`, {
        sql: `SET USER ${name}`,
        startTime: performance.now(),
      });
    }
    return this.execute(`SET USER ${this.formatUser(parsed)}`);
  }

  useDatabase(name: string): QueryResult {
    return this.execute(`USE "${name}"`);
  }

  execute(sql: string): QueryResult {
    const start = performance.now();

    const activeDb = this.getActiveDb();
    if (!activeDb) {
      return sqlErrorEngine.fromMessage('Database not initialized. Call init() first.', {
        sql,
        startTime: start,
      });
    }

    const normalizedSql = sql.trim();

    if (isPlSqlBlock(normalizedSql)) {
      const plSqlResult = runPlSqlBlock(normalizedSql, {
        executeSql: (statement) => this.execute(statement),
      });

      if (plSqlResult.error) {
        return sqlErrorEngine.enrichResultWithError(plSqlResult, {
          sql,
        });
      }

      return {
        ...plSqlResult,
        executionTimeMs:
          plSqlResult.executionTimeMs > 0 ? plSqlResult.executionTimeMs : performance.now() - start,
      };
    }

    const virtualResult = this.handleDatabaseCommand(normalizedSql, start);
    if (virtualResult) return virtualResult;

    const permissionError = this.denyIfNoPrivilege(normalizedSql, start);
    if (permissionError) return permissionError;

    // Run MySQL translation
    const translated = translateMySQL(
      normalizedSql,
      activeDb,
      this.activeDatabase,
      this.getCurrentUserDisplay(),
    );

    // If translation produced a pre-computed result, return it with timing
    if (translated.sql === null && translated.result) {
      const resolved = { ...translated.result, executionTimeMs: performance.now() - start };
      if (!resolved.error) return resolved;

      return sqlErrorEngine.enrichResultWithError(resolved, {
        sql,
        translatedSql: translated.sql ?? undefined,
      });
    }

    const finalSql = translated.sql ?? normalizedSql;

    try {
      const results = activeDb.exec(finalSql);
      const elapsed = performance.now() - start;

      if (results.length === 0) {
        const normalizedFinalSql = finalSql.trim().toUpperCase();
        const isReadQuery = /^(SELECT|WITH|PRAGMA|EXPLAIN)/.test(normalizedFinalSql);
        if (isReadQuery) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: elapsed,
          };
        }

        const rowsModified = activeDb.getRowsModified();
        return {
          columns: [],
          rows: [],
          rowCount: rowsModified,
          executionTimeMs: elapsed,
        };
      }

      const { columns, values } = results[0];
      const rows: Row[] = values.map((vals) => {
        const row: Row = {};
        columns.forEach((col, i) => {
          row[col] = vals[i];
        });
        return row;
      });

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: elapsed,
      };
    } catch (e) {
      return sqlErrorEngine.fromUnknownError(e, {
        sql,
        translatedSql: finalSql,
        startTime: start,
      });
    }
  }

  getTables(): TableSchema[] {
    const activeDb = this.getActiveDb();
    if (!activeDb) return [];

    const result = activeDb.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    if (result.length === 0) return [];

    return result[0].values.map(([tableName]) => {
      const name = String(tableName);
      const pragmaResult = activeDb.exec(`PRAGMA table_info("${name}")`);
      const columns =
        pragmaResult.length > 0
          ? pragmaResult[0].values.map((row) => ({
              name: String(row[1]),
              type: String(row[2]),
              nullable: row[3] === 0,
              primaryKey: row[5] === 1,
            }))
          : [];

      return { name, columns };
    });
  }

  loadSQL(sql: string): QueryResult {
    const statements = splitSqlStatements(sql);
    if (statements.length === 0) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
      };
    }

    let finalResult: QueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
    };

    for (const statement of statements) {
      const result = this.execute(statement);
      finalResult = result;
      if (result.error) return result;
    }

    return finalResult;
  }

  reset(): void {
    for (const db of this.databases.values()) {
      db.close();
    }
    this.databases.clear();
    this.procedures.clear();
    this.sqlModule = null;
    this.activeDatabase = 'main';
    this.users.clear();
    this.grants.clear();
    this.currentUserKey = this.userKey('admin', 'localhost');
    resetSqlJsLoader();
  }

  exportCSV(result: QueryResult): string {
    if (result.columns.length === 0) return '';
    const header = result.columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
    const rows = result.rows.map((row) =>
      result.columns
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    return [header, ...rows].join('\n');
  }
}
