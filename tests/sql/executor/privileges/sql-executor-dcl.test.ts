import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/lib/engine/sql-executor';

describe('SqlExecutor DCL (users and grants)', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
  });

  it('creates users and lists them in SHOW USERS', () => {
    const create = executor.execute(
      "CREATE USER IF NOT EXISTS 'analyst'@'localhost' IDENTIFIED BY 'x'",
    );
    expect(create.error).toBeUndefined();

    const users = executor.execute('SHOW USERS');
    expect(users.error).toBeUndefined();
    const names = users.rows.map((row) => String(row.User));
    expect(names).toContain('admin');
    expect(names).toContain('analyst');
  });

  it('enforces privilege checks for non-admin users', () => {
    executor.execute('CREATE TABLE reports (id INTEGER PRIMARY KEY, title TEXT)');
    executor.execute("CREATE USER 'reader'@'localhost' IDENTIFIED BY 'x'");
    executor.execute("GRANT SELECT ON main.* TO 'reader'@'localhost'");
    executor.execute("SET USER 'reader'@'localhost'");

    const canRead = executor.execute('SELECT * FROM reports');
    expect(canRead.error).toBeUndefined();

    const cannotInsert = executor.execute("INSERT INTO reports VALUES (1, 'blocked')");
    expect(cannotInsert.error).toBeDefined();
    expect(cannotInsert.error?.toLowerCase()).toContain('access denied');
  });

  it('revokes privileges correctly', () => {
    executor.execute('CREATE TABLE docs (id INTEGER PRIMARY KEY, body TEXT)');
    executor.execute("CREATE USER 'writer'@'localhost' IDENTIFIED BY 'x'");
    executor.execute("GRANT SELECT, INSERT ON main.* TO 'writer'@'localhost'");
    executor.execute("REVOKE INSERT ON main.* FROM 'writer'@'localhost'");
    executor.execute("SET USER 'writer'@'localhost'");

    const insertDenied = executor.execute("INSERT INTO docs VALUES (1, 'x')");
    expect(insertDenied.error).toBeDefined();

    const selectAllowed = executor.execute('SELECT * FROM docs');
    expect(selectAllowed.error).toBeUndefined();
  });

  it('protects admin from being dropped', () => {
    const dropAdmin = executor.execute("DROP USER 'admin'@'localhost'");
    expect(dropAdmin.error).toBeDefined();
    expect(dropAdmin.error?.toLowerCase()).toContain('cannot drop default admin user');
  });

  it('shows grants for a user', () => {
    executor.execute("CREATE USER 'auditor'@'localhost' IDENTIFIED BY 'x'");
    executor.execute("GRANT SELECT ON main.* TO 'auditor'@'localhost'");

    const grants = executor.execute("SHOW GRANTS FOR 'auditor'@'localhost'");
    expect(grants.error).toBeUndefined();
    expect(grants.rowCount).toBeGreaterThan(0);
  });

  it('denies multi-table reads when one referenced table is not granted', () => {
    executor.execute('CREATE TABLE public_reports (id INTEGER PRIMARY KEY, title TEXT)');
    executor.execute('CREATE TABLE private_reports (id INTEGER PRIMARY KEY, secret TEXT)');
    executor.execute("INSERT INTO public_reports VALUES (1, 'Visible')");
    executor.execute("INSERT INTO private_reports VALUES (1, 'Hidden')");

    executor.execute("CREATE USER 'limited'@'localhost' IDENTIFIED BY 'x'");
    executor.execute("GRANT SELECT ON main.public_reports TO 'limited'@'localhost'");
    executor.execute("SET USER 'limited'@'localhost'");

    const allowed = executor.execute('SELECT title FROM public_reports');
    expect(allowed.error).toBeUndefined();

    const denied = executor.execute(
      'SELECT p.title, r.secret FROM public_reports p JOIN private_reports r ON r.id = p.id',
    );
    expect(denied.error).toBeDefined();
    expect(denied.error?.toLowerCase()).toContain('access denied');
  });

  it('denies CTE-prefixed DML when user only has SELECT privilege', () => {
    executor.execute('CREATE TABLE docs (id INTEGER PRIMARY KEY, body TEXT)');
    executor.execute("INSERT INTO docs VALUES (1, 'alpha')");

    executor.execute("CREATE USER 'cte_user'@'localhost' IDENTIFIED BY 'x'");
    executor.execute("GRANT SELECT ON main.docs TO 'cte_user'@'localhost'");
    executor.execute("SET USER 'cte_user'@'localhost'");

    const deleteDenied = executor.execute(
      'WITH picked AS (SELECT id FROM docs) DELETE FROM docs WHERE id IN (SELECT id FROM picked)',
    );
    expect(deleteDenied.error).toBeDefined();
    expect(deleteDenied.error?.toLowerCase()).toContain('access denied');

    const updateDenied = executor.execute(
      "WITH picked AS (SELECT id FROM docs) UPDATE docs SET body = 'updated' WHERE id IN (SELECT id FROM picked)",
    );
    expect(updateDenied.error).toBeDefined();
    expect(updateDenied.error?.toLowerCase()).toContain('access denied');

    const insertDenied = executor.execute(
      "WITH src AS (SELECT 2 AS id, 'beta' AS body) INSERT INTO docs(id, body) SELECT id, body FROM src",
    );
    expect(insertDenied.error).toBeDefined();
    expect(insertDenied.error?.toLowerCase()).toContain('access denied');
  });

  it('denies CTE-based DML when CTE source table lacks SELECT privilege', () => {
    executor.execute('CREATE TABLE docs (id INTEGER PRIMARY KEY, body TEXT)');
    executor.execute('CREATE TABLE secret_docs (id INTEGER PRIMARY KEY, body TEXT)');
    executor.execute("INSERT INTO docs VALUES (1, 'visible')");
    executor.execute("INSERT INTO secret_docs VALUES (1, 'classified')");

    executor.execute("CREATE USER 'cte_guard'@'localhost' IDENTIFIED BY 'x'");
    executor.execute("GRANT DELETE ON main.docs TO 'cte_guard'@'localhost'");
    executor.execute("SET USER 'cte_guard'@'localhost'");

    const denied = executor.execute(
      'WITH src AS (SELECT id FROM secret_docs) DELETE FROM docs WHERE id IN (SELECT id FROM src)',
    );
    expect(denied.error).toBeDefined();
    expect(denied.error?.toLowerCase()).toContain('access denied');

    executor.execute("SET USER 'admin'@'localhost'");
    executor.execute("GRANT SELECT ON main.secret_docs TO 'cte_guard'@'localhost'");
    executor.execute("SET USER 'cte_guard'@'localhost'");

    const allowed = executor.execute(
      'WITH src AS (SELECT id FROM secret_docs) DELETE FROM docs WHERE id IN (SELECT id FROM src)',
    );
    expect(allowed.error).toBeUndefined();
  });

  it('requires SELECT on source tables for INSERT ... SELECT statements', () => {
    executor.execute('CREATE TABLE sink (id INTEGER PRIMARY KEY, body TEXT)');
    executor.execute('CREATE TABLE secret_docs (id INTEGER PRIMARY KEY, body TEXT)');
    executor.execute("INSERT INTO secret_docs VALUES (1, 'classified')");

    executor.execute("CREATE USER 'writer_only'@'localhost' IDENTIFIED BY 'x'");
    executor.execute("GRANT INSERT ON main.sink TO 'writer_only'@'localhost'");
    executor.execute("GRANT INSERT ON main.secret_docs TO 'writer_only'@'localhost'");
    executor.execute("SET USER 'writer_only'@'localhost'");

    const denied = executor.execute('INSERT INTO sink(id, body) SELECT id, body FROM secret_docs');
    expect(denied.error).toBeDefined();
    expect(denied.error?.toLowerCase()).toContain('access denied');

    executor.execute("SET USER 'admin'@'localhost'");
    executor.execute("GRANT SELECT ON main.secret_docs TO 'writer_only'@'localhost'");
    executor.execute("SET USER 'writer_only'@'localhost'");

    const allowed = executor.execute('INSERT INTO sink(id, body) SELECT id, body FROM secret_docs');
    expect(allowed.error).toBeUndefined();
  });

  it('requires SELECT on tables referenced inside derived-table read sources', () => {
    executor.execute('CREATE TABLE sink (id INTEGER PRIMARY KEY, body TEXT)');
    executor.execute('CREATE TABLE secret_docs (id INTEGER PRIMARY KEY, body TEXT)');
    executor.execute("INSERT INTO secret_docs VALUES (1, 'classified')");

    executor.execute("CREATE USER 'derived_writer'@'localhost' IDENTIFIED BY 'x'");
    executor.execute("GRANT INSERT ON main.sink TO 'derived_writer'@'localhost'");
    executor.execute("SET USER 'derived_writer'@'localhost'");

    const denied = executor.execute(
      'INSERT INTO sink(id, body) SELECT id, body FROM (SELECT id, body FROM secret_docs) AS src',
    );
    expect(denied.error).toBeDefined();
    expect(denied.error?.toLowerCase()).toContain('access denied');

    executor.execute("SET USER 'admin'@'localhost'");
    executor.execute("GRANT SELECT ON main.secret_docs TO 'derived_writer'@'localhost'");
    executor.execute("SET USER 'derived_writer'@'localhost'");

    const allowed = executor.execute(
      'INSERT INTO sink(id, body) SELECT id, body FROM (SELECT id, body FROM secret_docs) AS src',
    );
    expect(allowed.error).toBeUndefined();
  });

  it('does not treat OUTER as a table reference in LEFT OUTER JOIN clauses', () => {
    executor.execute('CREATE TABLE public_reports (id INTEGER PRIMARY KEY, title TEXT)');
    executor.execute('CREATE TABLE private_reports (id INTEGER PRIMARY KEY, secret TEXT)');
    executor.execute("INSERT INTO public_reports VALUES (1, 'Visible')");
    executor.execute("INSERT INTO private_reports VALUES (1, 'Hidden')");

    executor.execute("CREATE USER 'outer_join_reader'@'localhost' IDENTIFIED BY 'x'");
    executor.execute("GRANT SELECT ON main.public_reports TO 'outer_join_reader'@'localhost'");
    executor.execute("GRANT SELECT ON main.private_reports TO 'outer_join_reader'@'localhost'");
    executor.execute("SET USER 'outer_join_reader'@'localhost'");

    const joined = executor.execute(
      'SELECT p.title, r.secret FROM public_reports p LEFT OUTER JOIN private_reports r ON r.id = p.id',
    );
    expect(joined.error).toBeUndefined();
    expect(joined.rowCount).toBe(1);
  });

  it('allows DELETE with only DELETE privilege on the target table', () => {
    executor.execute('CREATE TABLE logs (id INTEGER PRIMARY KEY, body TEXT)');
    executor.execute("INSERT INTO logs VALUES (1, 'old')");

    executor.execute("CREATE USER 'deleter'@'localhost' IDENTIFIED BY 'x'");
    executor.execute("GRANT DELETE ON main.logs TO 'deleter'@'localhost'");
    executor.execute("SET USER 'deleter'@'localhost'");

    const deleted = executor.execute('DELETE FROM logs WHERE id = 1');
    expect(deleted.error).toBeUndefined();
  });
});
