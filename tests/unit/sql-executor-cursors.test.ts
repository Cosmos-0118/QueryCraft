import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/lib/engine/sql-executor';

describe('SqlExecutor cursors', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
    executor.loadSQL(`
      CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT);
      INSERT INTO students VALUES (1, 'Alice');
    `);
  });

  it('registers cursor metadata and executes procedures that use MySQL-style cursor declarations', () => {
    const create = executor.execute(`
      CREATE PROCEDURE scan_students()
      BEGIN
        DECLARE c_students CURSOR FOR SELECT id FROM students ORDER BY id;
        DECLARE v_id INT DEFAULT 0;
        OPEN c_students;
        FETCH c_students INTO v_id;
        CLOSE c_students;
      END;
    `);

    expect(create.error).toBeUndefined();

    const show = executor.execute('SHOW CURSORS;');
    expect(show.error).toBeUndefined();
    expect(show.rows.some((row) => row.Cursor === 'c_students')).toBe(true);

    const definition = executor.execute('SHOW CREATE CURSOR scan_students.c_students;');
    expect(definition.error).toBeUndefined();
    expect(String(definition.rows[0]?.['Create Cursor'] ?? '')).toContain(
      'DECLARE c_students CURSOR FOR',
    );

    const call = executor.execute('CALL scan_students();');
    expect(call.error).toBeUndefined();
  });

  it('returns output from cursor-based procedure using DBMS_OUTPUT', () => {
    const create = executor.execute(`
      CREATE PROCEDURE list_students()
      BEGIN
        DECLARE c_students CURSOR FOR SELECT id, name FROM students ORDER BY id;
        DECLARE v_id INT DEFAULT 0;
        DECLARE v_name VARCHAR(100) DEFAULT '';
        OPEN c_students;
        FETCH c_students INTO v_id, v_name;
        DBMS_OUTPUT.PUT_LINE(v_name);
        CLOSE c_students;
      END;
    `);
    expect(create.error).toBeUndefined();

    const call = executor.execute('CALL list_students();');
    expect(call.error).toBeUndefined();
    expect(call.columns).toEqual(['output']);
    expect(call.rows[0]?.output).toBe('Alice');
  });

  it('returns fetched variable values via SELECT in cursor procedure', () => {
    const create = executor.execute(`
      CREATE PROCEDURE fetch_first_student()
      BEGIN
        DECLARE c CURSOR FOR SELECT id, name FROM students ORDER BY id;
        DECLARE v_id INT DEFAULT 0;
        DECLARE v_name VARCHAR(100) DEFAULT '';
        OPEN c;
        FETCH c INTO v_id, v_name;
        CLOSE c;
        SELECT v_id, v_name;
      END;
    `);
    expect(create.error).toBeUndefined();

    const call = executor.execute('CALL fetch_first_student();');
    expect(call.error).toBeUndefined();
    expect(call.rowCount).toBe(1);
    expect(call.rows[0]?.v_id).toBe(1);
    expect(call.rows[0]?.v_name).toBe('Alice');
  });
});