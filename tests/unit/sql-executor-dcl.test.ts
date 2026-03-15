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
});
