import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/lib/engine/sql-executor';

describe('SqlExecutor multi-database behavior', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
  });

  it('creates, lists, uses and drops user databases', () => {
    const create = executor.execute('CREATE DATABASE testdb');
    expect(create.error).toBeUndefined();

    const dbs = executor.execute('SHOW DATABASES');
    expect(dbs.error).toBeUndefined();
    const names = dbs.rows.map((row) => String(row.Database));
    expect(names).toContain('main');
    expect(names).toContain('testdb');

    const use = executor.useDatabase('testdb');
    expect(use.error).toBeUndefined();
    expect(executor.getActiveDatabase()).toBe('testdb');

    const drop = executor.execute('DROP DATABASE testdb');
    expect(drop.error).toBeUndefined();
    expect(executor.getActiveDatabase()).toBe('main');
  });

  it('keeps tables isolated between databases', () => {
    executor.execute('CREATE DATABASE school');
    executor.useDatabase('school');
    executor.execute('CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT)');
    executor.execute("INSERT INTO students VALUES (1, 'InSchool')");

    executor.useDatabase('main');
    const inMain = executor.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='students'",
    );
    expect(inMain.rowCount).toBe(0);

    executor.useDatabase('school');
    const inSchool = executor.execute('SELECT * FROM students');
    expect(inSchool.rowCount).toBe(1);
  });

  it('supports SHOW TABLES FROM specific database', () => {
    executor.execute('CREATE DATABASE bank');
    executor.useDatabase('bank');
    executor.execute('CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER)');

    const tables = executor.execute('SHOW TABLES FROM bank');
    expect(tables.error).toBeUndefined();
    expect(tables.columns[0]).toBe('Tables_in_bank');
    expect(tables.rowCount).toBe(1);
  });

  it('prevents dropping main database', () => {
    const result = executor.execute('DROP DATABASE main');
    expect(result.error).toBeDefined();
  });
});
