import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/lib/engine/sql-executor';

describe('SqlExecutor PL/SQL integration', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
    executor.loadSQL(`
      CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, gpa REAL);
      INSERT INTO students VALUES (1, 'Alice', 3.9);
      INSERT INTO students VALUES (2, 'Bob', 3.2);
    `);
  });

  it('executes anonymous block with cursor and DBMS_OUTPUT', () => {
    const result = executor.execute(`
      DECLARE
        CURSOR c_students IS SELECT id, name FROM students ORDER BY id;
        v_id NUMBER;
        v_name VARCHAR2(50);
      BEGIN
        OPEN c_students;
        FETCH c_students INTO v_id, v_name;
        DBMS_OUTPUT.PUT_LINE(v_name);
        CLOSE c_students;
      END;
    `);

    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['output']);
    expect(result.rows[0]?.output).toBe('Alice');
  });

  it('supports SELECT INTO with variable binds', () => {
    const result = executor.execute(`
      DECLARE
        v_id NUMBER := 2;
        v_name VARCHAR2(50);
      BEGIN
        SELECT name INTO v_name FROM students WHERE id = :v_id;
        DBMS_OUTPUT.PUT_LINE('Student=' || v_name);
      END;
    `);

    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.output).toBe('Student=Bob');
  });

  it('supports IF/THEN/ELSE branches in block', () => {
    const result = executor.execute(`
      DECLARE
        v_gpa NUMBER := 3.8;
      BEGIN
        IF v_gpa >= 3.5 THEN
          DBMS_OUTPUT.PUT_LINE('honors');
        ELSE
          DBMS_OUTPUT.PUT_LINE('regular');
        END IF;
      END;
    `);

    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.output).toBe('honors');
  });

  it('handles NO_DATA_FOUND in EXCEPTION block', () => {
    const result = executor.execute(`
      DECLARE
        v_name VARCHAR2(50);
      BEGIN
        SELECT name INTO v_name FROM students WHERE id = 999;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          DBMS_OUTPUT.PUT_LINE('fallback');
      END;
    `);

    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['output']);
    expect(result.rows[0]?.output).toBe('fallback');
  });

  it('handles WHEN OTHERS for raised application errors', () => {
    const result = executor.execute(`
      BEGIN
        RAISE_APPLICATION_ERROR(-20001, 'boom');
      EXCEPTION
        WHEN OTHERS THEN
          DBMS_OUTPUT.PUT_LINE('handled');
      END;
    `);

    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.output).toBe('handled');
  });
});
