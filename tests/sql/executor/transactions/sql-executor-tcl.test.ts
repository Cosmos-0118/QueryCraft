import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/lib/engine/sql-executor';

describe('SqlExecutor TCL (transactions)', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
    executor.execute('CREATE TABLE tx_test (id INTEGER PRIMARY KEY, note TEXT)');
  });

  it('rolls back inserted rows', () => {
    executor.execute('BEGIN');
    executor.execute("INSERT INTO tx_test VALUES (1, 'temp')");
    executor.execute('ROLLBACK');

    const rows = executor.execute('SELECT * FROM tx_test');
    expect(rows.rowCount).toBe(0);
  });

  it('commits inserted rows', () => {
    executor.execute('BEGIN');
    executor.execute("INSERT INTO tx_test VALUES (1, 'persisted')");
    executor.execute('COMMIT');

    const rows = executor.execute('SELECT * FROM tx_test');
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.note).toBe('persisted');
  });

  it('supports savepoint and rollback to savepoint', () => {
    executor.execute('BEGIN');
    executor.execute("INSERT INTO tx_test VALUES (1, 'before')");
    executor.execute('SAVEPOINT s1');
    executor.execute("INSERT INTO tx_test VALUES (2, 'after')");
    executor.execute('ROLLBACK TO SAVEPOINT s1');
    executor.execute('COMMIT');

    const rows = executor.execute('SELECT * FROM tx_test ORDER BY id');
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.id).toBe(1);
  });

  it('supports START TRANSACTION alias', () => {
    const begin = executor.execute('START TRANSACTION');
    expect(begin.error).toBeUndefined();

    executor.execute("INSERT INTO tx_test VALUES (3, 'alias')");
    executor.execute('COMMIT');

    const rows = executor.execute('SELECT * FROM tx_test WHERE id = 3');
    expect(rows.rowCount).toBe(1);
  });
});
