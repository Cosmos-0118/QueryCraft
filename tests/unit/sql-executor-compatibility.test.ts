import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/lib/engine/sql-executor';

describe('SqlExecutor MySQL compatibility layer', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
    executor.execute('CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, gpa REAL)');
    executor.execute("INSERT INTO students VALUES (1, 'Alice', 3.9)");
    executor.execute("INSERT INTO students VALUES (2, 'Bob', 3.4)");
  });

  it('returns SHOW TABLES in mysql-like format', () => {
    const result = executor.execute('SHOW TABLES');
    expect(result.error).toBeUndefined();
    expect(result.columns[0]).toBe('Tables_in_main');
    expect(result.rowCount).toBeGreaterThan(0);
  });

  it('supports DESCRIBE table', () => {
    const result = executor.execute('DESCRIBE students');
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['Field', 'Type', 'Null', 'Key', 'Default', 'Extra']);
    expect(result.rowCount).toBeGreaterThan(0);
  });

  it('supports SHOW CREATE TABLE', () => {
    const result = executor.execute('SHOW CREATE TABLE students');
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['Table', 'Create Table']);
    expect(String(result.rows[0]?.['Create Table']).toUpperCase()).toContain('CREATE TABLE');
  });

  it('translates LIMIT offset,count syntax', () => {
    const result = executor.execute('SELECT id FROM students ORDER BY id LIMIT 1, 1');
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]?.id).toBe(2);
  });

  it('translates CONCAT() in SELECT projection', () => {
    const result = executor.execute(
      "SELECT CONCAT(name, '-ok') AS label FROM students WHERE id = 1",
    );
    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.label).toBe('Alice-ok');
  });

  it('supports VAR_POP/VARIANCE/VAR_SAMP compatibility aggregates', () => {
    const result = executor.execute(
      'SELECT VAR_POP(gpa) AS vp, VARIANCE(gpa) AS vv, VAR_SAMP(gpa) AS vs FROM students',
    );
    expect(result.error).toBeUndefined();
    expect(typeof result.rows[0]?.vp).toBe('number');
    expect(typeof result.rows[0]?.vv).toBe('number');
    expect(typeof result.rows[0]?.vs).toBe('number');
  });

  it('supports STD/STDDEV compatibility aggregates', () => {
    const result = executor.execute(
      'SELECT STD(gpa) AS s1, STDDEV(gpa) AS s2, STDDEV_POP(gpa) AS s3, STDDEV_SAMP(gpa) AS s4 FROM students',
    );
    expect(result.error).toBeUndefined();
    expect(typeof result.rows[0]?.s1).toBe('number');
    expect(typeof result.rows[0]?.s2).toBe('number');
    expect(typeof result.rows[0]?.s3).toBe('number');
    expect(typeof result.rows[0]?.s4).toBe('number');
  });

  it('supports ALTER TABLE ... MODIFY for column type/constraint updates', () => {
    executor.execute('CREATE TABLE courses (id INTEGER PRIMARY KEY, credits INTEGER)');
    executor.execute('INSERT INTO courses VALUES (1, 1)');
    const result = executor.execute('ALTER TABLE courses MODIFY credits INTEGER CHECK(credits<=1)');
    expect(result.error).toBeUndefined();

    const invalidInsert = executor.execute('INSERT INTO courses VALUES (2, 2)');
    expect(invalidInsert.error).toBeDefined();
    expect(invalidInsert.errorDetails?.category).toBe('constraint');
  });

  it('supports ALTER TABLE ... CHANGE COLUMN for rename + type update', () => {
    executor.execute('CREATE TABLE staff (id INTEGER PRIMARY KEY, salary INTEGER)');
    executor.execute('INSERT INTO staff VALUES (1, 1000)');

    const result = executor.execute('ALTER TABLE staff CHANGE salary monthly_salary REAL');
    expect(result.error).toBeUndefined();

    const selected = executor.execute('SELECT monthly_salary FROM staff WHERE id = 1');
    expect(selected.error).toBeUndefined();
    expect(selected.rows[0]?.monthly_salary).toBe(1000);
  });

  it('supports ALTER TABLE with multiple clauses (ADD + MODIFY + CHANGE)', () => {
    executor.execute('CREATE TABLE dept (id INTEGER PRIMARY KEY, name TEXT)');
    executor.execute("INSERT INTO dept VALUES (1, 'CS')");

    const result = executor.execute(
      'ALTER TABLE dept ADD COLUMN code VARCHAR(16), MODIFY name VARCHAR(80), CHANGE code dept_code VARCHAR(16)',
    );
    expect(result.error).toBeUndefined();

    const describe = executor.execute('DESCRIBE dept');
    expect(describe.error).toBeUndefined();
    const fields = describe.rows.map((row) => String(row.Field));
    expect(fields).toEqual(['id', 'name', 'dept_code']);
  });

  it('supports ALTER TABLE ADD INDEX / DROP INDEX', () => {
    executor.execute('CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT)');

    const addIndex = executor.execute('ALTER TABLE employees ADD INDEX idx_emp_name (name)');
    expect(addIndex.error).toBeUndefined();

    const showIndexes = executor.execute('SHOW INDEX FROM employees');
    expect(showIndexes.error).toBeUndefined();
    expect(showIndexes.rowCount).toBeGreaterThan(0);

    const dropIndex = executor.execute('ALTER TABLE employees DROP INDEX idx_emp_name');
    expect(dropIndex.error).toBeUndefined();
  });
});
