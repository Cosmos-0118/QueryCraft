import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/lib/engine/sql-executor';

describe('SqlExecutor triggers', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
  });

  it('fires AFTER INSERT trigger and writes audit rows', () => {
    const setup = executor.loadSQL(`
      CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE audit_log (id INTEGER PRIMARY KEY, message TEXT);
      CREATE TRIGGER trg_students_ai
      AFTER INSERT ON students
      BEGIN
        INSERT INTO audit_log(message) VALUES ('inserted:' || NEW.name);
      END;
    `);
    expect(setup.error).toBeUndefined();

    const insert = executor.execute("INSERT INTO students VALUES (1, 'Alice')");
    expect(insert.error).toBeUndefined();

    const audit = executor.execute('SELECT message FROM audit_log');
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0]?.message).toBe('inserted:Alice');
  });

  it('keeps trigger statement intact when loading multi-statement SQL', () => {
    const result = executor.loadSQL(`
      CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);
      CREATE TABLE t_log (id INTEGER PRIMARY KEY, v TEXT);
      CREATE TRIGGER trg_t_ai
      AFTER INSERT ON t
      BEGIN
        INSERT INTO t_log(v) VALUES (NEW.v);
        INSERT INTO t_log(v) VALUES ('second:' || NEW.v);
      END;
      INSERT INTO t VALUES (1, 'x');
    `);

    expect(result.error).toBeUndefined();
    const rows = executor.execute('SELECT v FROM t_log ORDER BY id');
    expect(rows.rowCount).toBe(2);
    expect(rows.rows[0]?.v).toBe('x');
    expect(rows.rows[1]?.v).toBe('second:x');
  });

  it('stores trigger metadata in sqlite_master', () => {
    executor.execute('CREATE TABLE base (id INTEGER PRIMARY KEY, v TEXT)');
    executor.execute(
      "CREATE TRIGGER trg_base_ai AFTER INSERT ON base BEGIN INSERT INTO base(v) VALUES ('copy'); END;",
    );

    const meta = executor.execute(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_base_ai'",
    );
    expect(meta.error).toBeUndefined();
    expect(meta.rowCount).toBe(1);
  });

  it('supports SHOW TRIGGERS and SHOW CREATE TRIGGER', () => {
    executor.execute('CREATE TABLE orders (id INTEGER PRIMARY KEY, total REAL)');
    executor.execute(
      'CREATE TRIGGER trg_orders_ai AFTER INSERT ON orders BEGIN UPDATE orders SET total = total + 1 WHERE id = NEW.id; END;',
    );

    const show = executor.execute('SHOW TRIGGERS;');
    expect(show.error).toBeUndefined();
    expect(show.rowCount).toBeGreaterThanOrEqual(1);
    expect(show.rows.some((row) => row.Trigger === 'trg_orders_ai')).toBe(true);

    const create = executor.execute('SHOW CREATE TRIGGER trg_orders_ai;');
    expect(create.error).toBeUndefined();
    expect(create.rowCount).toBe(1);
    expect(String(create.rows[0]?.['Create Trigger'] ?? '')).toContain('CREATE TRIGGER');
  });

  it('supports MySQL trigger delimiters and FOR EACH ROW syntax', () => {
    const setup = executor.loadSQL(`
      CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT);
      DELIMITER $$
      CREATE TRIGGER trg_students_bi
      BEFORE INSERT ON students FOR EACH ROW
      BEGIN
        SET NEW.name = UPPER(NEW.name);
      END$$
      DELIMITER ;
    `);

    expect(setup.error).toBeUndefined();

    const insert = executor.execute("INSERT INTO students VALUES (1, 'Alice')");
    expect(insert.error).toBeUndefined();

    const rows = executor.execute('SELECT name FROM students WHERE id = 1;');
    expect(rows.error).toBeUndefined();
    expect(rows.rows[0]?.name).toBe('ALICE');

    const showCreate = executor.execute('SHOW CREATE TRIGGER trg_students_bi;');
    expect(showCreate.error).toBeUndefined();
    expect(String(showCreate.rows[0]?.['Create Trigger'] ?? '')).toContain('FOR EACH ROW');
    expect(String(showCreate.rows[0]?.['Create Trigger'] ?? '')).toContain('BEFORE INSERT');
  });
});
