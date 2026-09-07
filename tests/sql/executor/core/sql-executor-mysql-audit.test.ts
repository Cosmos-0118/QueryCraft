import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/shared/engine/sql';

/**
 * MySQL audit suite (Pass 5).
 *
 * Covers gaps found in the Pass-4 audit: SHOW/DESCRIBE parity, new function /
 * operator rewrites, DDL translations, ALTER TABLE expansion, corrected
 * ANY/ALL semantics, and explicit unsupported errors for server-only syntax.
 */
describe('MySQL audit — SHOW / DESCRIBE parity', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
    executor.execute('CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, gpa REAL)');
    executor.execute("INSERT INTO students VALUES (1, 'Alice', 3.9)");
    executor.execute("INSERT INTO students VALUES (2, 'Bob', 3.4)");
  });

  it('supports SHOW COLUMNS FROM table', () => {
    const result = executor.execute('SHOW COLUMNS FROM students');
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['Field', 'Type', 'Null', 'Key', 'Default', 'Extra']);
    expect(result.rowCount).toBe(3);
  });

  it('supports SHOW COLUMNS with qualified table and LIKE filter', () => {
    const result = executor.execute('SHOW COLUMNS FROM main.students LIKE \'na%\'');
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(1);
    expect(String(result.rows[0]?.Field)).toBe('name');
  });

  it('supports SHOW FULL FIELDS with explicit database', () => {
    const result = executor.execute('SHOW FULL FIELDS FROM students FROM main');
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(3);
  });

  it('supports DESCRIBE with qualified names', () => {
    const result = executor.execute('DESCRIBE main.students');
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['Field', 'Type', 'Null', 'Key', 'Default', 'Extra']);
  });

  it('allows non-admin users to run SHOW CREATE DATABASE', () => {
    executor.execute("CREATE USER 'reader'@'localhost' IDENTIFIED BY 'x'");
    executor.execute("GRANT SELECT ON main.* TO 'reader'@'localhost'");
    executor.execute("SET USER 'reader'@'localhost'");

    const result = executor.execute('SHOW CREATE DATABASE main');
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['Database', 'Create Database']);
  });

  it('filters SHOW VARIABLES by LIKE', () => {
    const result = executor.execute("SHOW VARIABLES LIKE 'max%'");
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(1);
    expect(String(result.rows[0]?.Variable_name)).toBe('max_connections');
  });

  it('supports SHOW PRIVILEGES', () => {
    const result = executor.execute('SHOW PRIVILEGES');
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['Privilege', 'Context', 'Comment']);
    expect(result.rowCount).toBeGreaterThan(0);
  });

  it('supports SHOW ENGINE INNODB STATUS stub', () => {
    const result = executor.execute('SHOW ENGINE INNODB STATUS');
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['Type', 'Name', 'Status']);
  });

  it('supports SHOW COUNT(*) WARNINGS', () => {
    const result = executor.execute('SHOW COUNT(*) WARNINGS');
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['Level', 'Code', 'Message']);
  });

  it('reports unknown events for SHOW CREATE EVENT', () => {
    const result = executor.execute('SHOW CREATE EVENT nightly_cleanup');
    expect(result.error).toBeDefined();
    expect(String(result.errorDetails?.rawMessage ?? result.error).toLowerCase()).toContain(
      'unknown event',
    );
  });
});

describe('MySQL audit — functions and operators', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
    executor.execute('CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, gpa REAL)');
    executor.execute("INSERT INTO students VALUES (1, 'Alice', 3.9)");
    executor.execute("INSERT INTO students VALUES (2, 'Bob', 3.4)");
  });

  it('supports IF(cond, a, b)', () => {
    const result = executor.execute("SELECT IF(gpa > 3.5, 'high', 'low') AS band FROM students ORDER BY id");
    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.band).toBe('high');
    expect(result.rows[1]?.band).toBe('low');
  });

  it('supports CONCAT_WS with separator', () => {
    const result = executor.execute("SELECT CONCAT_WS(',', name, CAST(id AS TEXT)) AS v FROM students WHERE id = 1");
    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.v).toBe('Alice,1');
  });

  it('supports GROUP_CONCAT with SEPARATOR', () => {
    const result = executor.execute('SELECT GROUP_CONCAT(name SEPARATOR \';\') AS names FROM students');
    expect(result.error).toBeUndefined();
    const names = String(result.rows[0]?.names ?? '');
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('supports YEAR/MONTH/DAY extraction', () => {
    const result = executor.execute("SELECT YEAR('2024-03-15') AS y, MONTH('2024-03-15') AS m, DAY('2024-03-15') AS d");
    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.y).toBe(2024);
    expect(result.rows[0]?.m).toBe(3);
    expect(result.rows[0]?.d).toBe(15);
  });

  it('supports DATEDIFF in days', () => {
    const result = executor.execute("SELECT DATEDIFF('2024-03-10', '2024-03-01') AS diff");
    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.diff).toBe(9);
  });

  it('supports DATE_ADD with INTERVAL', () => {
    const result = executor.execute("SELECT DATE_ADD('2024-01-01', INTERVAL 1 MONTH) AS shifted");
    expect(result.error).toBeUndefined();
    expect(String(result.rows[0]?.shifted)).toContain('2024-02-01');
  });

  it('supports null-safe equal (<=>)', () => {
    const result = executor.execute('SELECT (NULL <=> NULL) AS a, (1 <=> 1) AS b, (1 <=> 2) AS c');
    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.a).toBe(1);
    expect(result.rows[0]?.b).toBe(1);
    expect(result.rows[0]?.c).toBe(0);
  });

  it('treats && as AND and || as OR (MySQL default mode)', () => {
    const andResult = executor.execute('SELECT (1 && 1) AS v');
    expect(andResult.error).toBeUndefined();
    expect(andResult.rows[0]?.v).toBe(1);

    const orResult = executor.execute('SELECT (1 || 0) AS v, (0 || 0) AS w');
    expect(orResult.error).toBeUndefined();
    expect(orResult.rows[0]?.v).toBe(1);
    expect(orResult.rows[0]?.w).toBe(0);
  });

  it('supports MOD and DIV operators', () => {
    const modResult = executor.execute('SELECT 7 MOD 3 AS v');
    expect(modResult.error).toBeUndefined();
    expect(modResult.rows[0]?.v).toBe(1);

    // SQLite `/` truncates integer division, matching MySQL DIV semantics.
    const divResult = executor.execute('SELECT 7 DIV 2 AS v');
    expect(divResult.error).toBeUndefined();
    expect(divResult.rows[0]?.v).toBe(3);
  });

  it('supports UNIX_TIMESTAMP and FROM_UNIXTIME', () => {
    const unix = executor.execute("SELECT UNIX_TIMESTAMP('1970-01-02 00:00:00') AS v");
    expect(unix.error).toBeUndefined();
    expect(Number(unix.rows[0]?.v)).toBeGreaterThan(0);

    const fromUnix = executor.execute('SELECT FROM_UNIXTIME(0) AS v');
    expect(fromUnix.error).toBeUndefined();
    expect(String(fromUnix.rows[0]?.v)).toContain('1970-01-01');
  });

  it('keeps backticks inside string literals intact', () => {
    const result = executor.execute("SELECT 'a`b' AS x");
    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.x).toBe('a`b');
  });
});

describe('MySQL audit — DDL translations', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
  });

  it('maps BIGINT AUTO_INCREMENT to an autoincrement primary key', () => {
    const create = executor.execute(
      'CREATE TABLE big_auto (id BIGINT AUTO_INCREMENT PRIMARY KEY, name TEXT)',
    );
    expect(create.error).toBeUndefined();

    const insert = executor.execute("INSERT INTO big_auto (name) VALUES ('x')");
    expect(insert.error).toBeUndefined();

    const selected = executor.execute('SELECT id FROM big_auto');
    expect(selected.error).toBeUndefined();
    expect(selected.rows[0]?.id).toBe(1);
  });

  it('strips per-column CHARACTER SET / COLLATE attributes', () => {
    const create = executor.execute(
      'CREATE TABLE cs_demo (name VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL)',
    );
    expect(create.error).toBeUndefined();

    const desc = executor.execute('DESCRIBE cs_demo');
    expect(desc.error).toBeUndefined();
    expect(String(desc.rows[0]?.Type)).toBe('TEXT');
  });

  it('strips ZEROFILL column attributes', () => {
    const create = executor.execute('CREATE TABLE z_demo (n INT ZEROFILL)');
    expect(create.error).toBeUndefined();
  });

  it('supports DROP INDEX idx ON tbl syntax', () => {
    executor.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    executor.execute('CREATE INDEX idx_t_name ON t(name)');
    const drop = executor.execute('DROP INDEX idx_t_name ON t');
    expect(drop.error).toBeUndefined();
  });

  it('supports CREATE OR REPLACE VIEW', () => {
    executor.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    const first = executor.execute('CREATE OR REPLACE VIEW v_t AS SELECT id FROM t');
    expect(first.error).toBeUndefined();
    const second = executor.execute('CREATE OR REPLACE VIEW v_t AS SELECT id FROM t');
    expect(second.error).toBeUndefined();
  });

  it('supports the TABLE t shorthand', () => {
    executor.execute('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    executor.execute('INSERT INTO t VALUES (1)');
    const result = executor.execute('TABLE t');
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(1);
  });

  it('supports INSERT ... SET syntax', () => {
    executor.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    const insert = executor.execute("INSERT INTO t SET id = 1, name = 'Alice'");
    expect(insert.error).toBeUndefined();

    const selected = executor.execute('SELECT name FROM t WHERE id = 1');
    expect(selected.error).toBeUndefined();
    expect(selected.rows[0]?.name).toBe('Alice');
  });

  it('rejects CREATE TABLE ... LIKE with an actionable message', () => {
    executor.execute('CREATE TABLE src (id INTEGER PRIMARY KEY)');
    const result = executor.execute('CREATE TABLE dst LIKE src');
    expect(result.error).toBeDefined();
    expect(result.errorDetails?.category).toBe('unsupported');
    expect(result.error?.toLowerCase()).toContain('like');
  });

  it('rejects SELECT ... INTO OUTFILE with an unsupported error', () => {
    executor.execute('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    const result = executor.execute("SELECT * FROM t INTO OUTFILE '/tmp/t.csv'");
    expect(result.error).toBeDefined();
    expect(result.errorDetails?.category).toBe('unsupported');
  });

  it('reports UPDATE ... LIMIT as unsupported', () => {
    executor.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v INTEGER)');
    executor.execute('INSERT INTO t VALUES (1, 1)');
    const result = executor.execute('UPDATE t SET v = 2 LIMIT 1');
    expect(result.error).toBeDefined();
    expect(result.errorDetails?.category).toBe('unsupported');
  });
});

describe('MySQL audit — ALTER TABLE expansion', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
  });

  it('supports ADD PRIMARY KEY', () => {
    executor.execute('CREATE TABLE t (id INTEGER, email TEXT)');
    executor.execute("INSERT INTO t VALUES (1, 'a')");
    const altered = executor.execute('ALTER TABLE t ADD PRIMARY KEY (id)');
    expect(altered.error).toBeUndefined();

    const duplicate = executor.execute("INSERT INTO t VALUES (1, 'b')");
    expect(duplicate.error).toBeDefined();
    expect(duplicate.errorDetails?.category).toBe('constraint');
  });

  it('supports ADD UNIQUE column constraints', () => {
    executor.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, email TEXT)');
    const altered = executor.execute('ALTER TABLE t ADD UNIQUE (email)');
    expect(altered.error).toBeUndefined();

    executor.execute("INSERT INTO t VALUES (1, 'a')");
    const duplicate = executor.execute("INSERT INTO t VALUES (2, 'a')");
    expect(duplicate.error).toBeDefined();
    expect(duplicate.errorDetails?.category).toBe('constraint');
  });

  it('supports ADD CONSTRAINT CHECK', () => {
    executor.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, age INTEGER)');
    const altered = executor.execute('ALTER TABLE t ADD CONSTRAINT chk_age CHECK (age >= 0)');
    expect(altered.error).toBeUndefined();

    const invalid = executor.execute('INSERT INTO t VALUES (1, -1)');
    expect(invalid.error).toBeDefined();
    expect(invalid.errorDetails?.category).toBe('constraint');
  });

  it('supports ALTER COLUMN SET/DROP DEFAULT', () => {
    executor.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, status TEXT)');
    const setDefault = executor.execute("ALTER TABLE t ALTER COLUMN status SET DEFAULT 'new'");
    expect(setDefault.error).toBeUndefined();

    const dropDefault = executor.execute('ALTER TABLE t ALTER COLUMN status DROP DEFAULT');
    expect(dropDefault.error).toBeUndefined();
  });
});

describe('MySQL audit — ANY / ALL correctness', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
  });

  it('evaluates = ALL only when every row matches', () => {
    executor.execute('CREATE TABLE uniform (v INTEGER)');
    executor.execute('INSERT INTO uniform VALUES (5), (5)');
    const allMatch = executor.execute('SELECT v FROM uniform WHERE v = ALL (SELECT v FROM uniform)');
    expect(allMatch.error).toBeUndefined();
    expect(allMatch.rowCount).toBe(2);

    executor.execute('INSERT INTO uniform VALUES (6)');
    const mixed = executor.execute('SELECT v FROM uniform WHERE v = ALL (SELECT v FROM uniform)');
    expect(mixed.error).toBeUndefined();
    expect(mixed.rowCount).toBe(0);
  });

  it('evaluates <> ANY as an existence check', () => {
    executor.execute('CREATE TABLE vals (v INTEGER)');
    executor.execute('INSERT INTO vals VALUES (1), (2), (3)');
    const someDiffer = executor.execute(
      'SELECT v FROM vals WHERE v = 2 AND v <> ANY (SELECT v FROM vals WHERE v = 1)',
    );
    expect(someDiffer.error).toBeUndefined();
    expect(someDiffer.rowCount).toBe(1);

    const noneDiffer = executor.execute(
      'SELECT v FROM vals WHERE v <> ANY (SELECT v FROM vals WHERE v > 100)',
    );
    expect(noneDiffer.error).toBeUndefined();
    expect(noneDiffer.rowCount).toBe(0);
  });
});
