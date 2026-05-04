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

  it('cleans up stored function metadata when dropping a database', () => {
    executor.execute('CREATE DATABASE analytics');
    executor.useDatabase('analytics');

    const createFn = executor.execute(`
      CREATE FUNCTION add_one(x INT)
      RETURNS INT
      DETERMINISTIC
      BEGIN
        RETURN x + 1;
      END;
    `);
    expect(createFn.error).toBeUndefined();

    const beforeDrop = executor.execute("SHOW FUNCTION STATUS LIKE 'add_one';");
    expect(beforeDrop.error).toBeUndefined();
    expect(beforeDrop.rowCount).toBe(1);

    const drop = executor.execute('DROP DATABASE analytics');
    expect(drop.error).toBeUndefined();

    executor.useDatabase('main');
    const afterDrop = executor.execute("SHOW FUNCTION STATUS LIKE 'add_one';");
    expect(afterDrop.error).toBeUndefined();
    expect(afterDrop.rowCount).toBe(0);
  });

  it('records effective database for each statement in multi-db batches', () => {
    executor.execute('CREATE DATABASE lab');

    const result = executor.loadSQL(`
      USE lab;
      CREATE TABLE sample (id INTEGER PRIMARY KEY, note TEXT);
      USE main;
      CREATE TABLE sample_main (id INTEGER PRIMARY KEY, note TEXT);
    `);

    expect(result.error).toBeUndefined();
    expect(result.statementResults?.map((entry) => entry.database)).toEqual([
      'lab',
      'lab',
      'main',
      'main',
    ]);
  });
});
