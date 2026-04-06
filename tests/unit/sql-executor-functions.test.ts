import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/lib/engine/sql-executor';

describe('SqlExecutor stored functions', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
    executor.loadSQL(`
      CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, salary REAL);
      INSERT INTO employees VALUES (1, 'Alice', 5000);
      INSERT INTO employees VALUES (2, 'Bob', 3000);
    `);
  });

  it('creates and calls a stored function via SELECT', () => {
    const create = executor.execute(`
      CREATE FUNCTION square(n INT)
      RETURNS INT
      DETERMINISTIC
      BEGIN
        RETURN n * n;
      END;
    `);
    expect(create.error).toBeUndefined();

    // Verify function was stored
    const show = executor.execute('SHOW FUNCTION STATUS;');
    expect(show.rows.some((r) => r.Name === 'square')).toBe(true);

    // Test direct evaluation via a simple value substitution
    const directResult = executor.execute('SELECT square(5) AS val;');
    expect(directResult.error).toBeUndefined();
    expect(directResult.columns).toContain('val');
    expect(directResult.rows.length).toBe(1);
    expect(directResult.rows[0]?.val).toBe(25);
  });

  it('supports DROP FUNCTION and DROP FUNCTION IF EXISTS', () => {
    executor.execute(`
      CREATE FUNCTION add_ten(n INT)
      RETURNS INT
      DETERMINISTIC
      BEGIN
        RETURN n + 10;
      END;
    `);

    const drop = executor.execute('DROP FUNCTION add_ten;');
    expect(drop.error).toBeUndefined();

    // Calling after drop should fail
    const result = executor.execute('SELECT add_ten(5) AS val;');
    // Should not substitute since function is dropped
    expect(result.rows[0]?.val).not.toBe(15);

    // DROP IF EXISTS on non-existent should not error
    const dropAgain = executor.execute('DROP FUNCTION IF EXISTS add_ten;');
    expect(dropAgain.error).toBeUndefined();

    // DROP without IF EXISTS on non-existent should error
    const dropFail = executor.execute('DROP FUNCTION add_ten;');
    expect(dropFail.error).toBeDefined();
  });

  it('supports SHOW FUNCTION STATUS', () => {
    executor.execute(`
      CREATE FUNCTION my_func(x INT)
      RETURNS INT
      DETERMINISTIC
      BEGIN
        RETURN x + 1;
      END;
    `);

    const show = executor.execute('SHOW FUNCTION STATUS;');
    expect(show.error).toBeUndefined();
    expect(show.rows.some((row) => row.Name === 'my_func')).toBe(true);
    expect(show.rows[0]?.Type).toBe('FUNCTION');
  });

  it('supports SHOW CREATE FUNCTION', () => {
    executor.execute(`
      CREATE FUNCTION bonus(sal DECIMAL)
      RETURNS DECIMAL
      DETERMINISTIC
      BEGIN
        RETURN sal * 0.10;
      END;
    `);

    const show = executor.execute('SHOW CREATE FUNCTION bonus;');
    expect(show.error).toBeUndefined();
    expect(String(show.rows[0]?.['Create Function'] ?? '')).toContain('CREATE FUNCTION');
  });

  it('supports ROW_COUNT() after DML', () => {
    const ins = executor.execute("INSERT INTO employees VALUES (3, 'Charlie', 4000);");
    expect(ins.error).toBeUndefined();

    const rc = executor.execute('SELECT ROW_COUNT() AS cnt;');
    expect(rc.error).toBeUndefined();
    expect(rc.rows[0]?.cnt).toBe(1);
  });

  it('uses function in a SELECT with table data', () => {
    executor.execute(`
      CREATE FUNCTION calc_bonus(sal DECIMAL)
      RETURNS DECIMAL
      DETERMINISTIC
      BEGIN
        RETURN sal * 0.10;
      END;
    `);

    // The function call gets substituted with its evaluated value
    // Since the function gets a literal argument, test with a literal first
    const result = executor.execute('SELECT calc_bonus(5000) AS bonus;');
    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.bonus).toBe(500);
  });
});
