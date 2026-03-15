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
});
