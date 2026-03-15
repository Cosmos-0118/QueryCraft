import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/lib/engine/sql-executor';

describe('SqlExecutor procedures', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
    executor.loadSQL(`
      CREATE TABLE employees (id INTEGER PRIMARY KEY, salary REAL);
      INSERT INTO employees VALUES (1, 1000);
    `);
  });

  it('creates and executes stored procedures with CALL', () => {
    const create = executor.execute(`
      CREATE PROCEDURE give_raise(IN emp_id INT, IN pct DECIMAL(5,2))
      BEGIN
        UPDATE employees
        SET salary = salary * (1 + pct / 100)
        WHERE id = emp_id;
      END;
    `);

    expect(create.error).toBeUndefined();

    const call = executor.execute('CALL give_raise(1, 10.0);');
    expect(call.error).toBeUndefined();

    const check = executor.execute('SELECT salary FROM employees WHERE id = 1;');
    expect(check.rowCount).toBe(1);
    expect(check.rows[0]?.salary).toBe(1100);
  });

  it('supports SHOW PROCEDURE STATUS and SHOW CREATE PROCEDURE', () => {
    executor.execute(`
      CREATE PROCEDURE bump(IN emp_id INT)
      BEGIN
        UPDATE employees SET salary = salary + 1 WHERE id = emp_id;
      END;
    `);

    const show = executor.execute('SHOW PROCEDURE STATUS;');
    expect(show.error).toBeUndefined();
    expect(show.rows.some((row) => row.Name === 'bump')).toBe(true);

    const create = executor.execute('SHOW CREATE PROCEDURE bump;');
    expect(create.error).toBeUndefined();
    expect(String(create.rows[0]?.['Create Procedure'] ?? '')).toContain('CREATE PROCEDURE');
  });

  it('drops procedures', () => {
    executor.execute(`
      CREATE PROCEDURE temp_proc()
      BEGIN
        SELECT 1;
      END;
    `);

    const drop = executor.execute('DROP PROCEDURE temp_proc;');
    expect(drop.error).toBeUndefined();

    const call = executor.execute('CALL temp_proc();');
    expect(call.error).toBeTruthy();
  });
});
