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

  it('returns SELECT output from CALL', () => {
    executor.execute(`
      CREATE PROCEDURE greet()
      BEGIN
        SELECT 'Hello World';
      END;
    `);

    const result = executor.execute('CALL greet();');
    expect(result.error).toBeUndefined();
    expect(result.columns.length).toBeGreaterThan(0);
    expect(result.rowCount).toBe(1);
    expect(Object.values(result.rows[0] ?? {})).toContain('Hello World');
  });

  it('returns SELECT from table in CALL', () => {
    executor.execute(`
      CREATE PROCEDURE get_salary(IN emp_id INT)
      BEGIN
        SELECT salary FROM employees WHERE id = emp_id;
      END;
    `);

    const result = executor.execute('CALL get_salary(1);');
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]?.salary).toBe(1000);
  });

  it('returns DBMS_OUTPUT from CALL', () => {
    executor.execute(`
      CREATE PROCEDURE say_hi()
      BEGIN
        DBMS_OUTPUT.PUT_LINE('Hi there');
      END;
    `);

    const result = executor.execute('CALL say_hi();');
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['output']);
    expect(result.rows[0]?.output).toBe('Hi there');
  });

  it('returns procedure errors through CALL', () => {
    executor.execute(`
      CREATE PROCEDURE bad_proc()
      BEGIN
        SELECT * FROM nonexistent_table;
      END;
    `);

    const result = executor.execute('CALL bad_proc();');
    expect(result.error).toBeTruthy();
  });

  it('supports DELIMITER syntax for CREATE PROCEDURE via loadSQL', () => {
    const result = executor.loadSQL(`
      DELIMITER $$
      CREATE PROCEDURE greet_delim()
      BEGIN
        SELECT 'Hello Delim';
      END$$
      DELIMITER ;
    `);

    expect(result.error).toBeUndefined();

    const call = executor.execute('CALL greet_delim();');
    expect(call.error).toBeUndefined();
    expect(call.rowCount).toBe(1);
    expect(Object.values(call.rows[0] ?? {})).toContain('Hello Delim');
  });
});
