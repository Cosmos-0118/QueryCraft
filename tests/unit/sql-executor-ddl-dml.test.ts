import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/lib/engine/sql-executor';

describe('SqlExecutor DDL and DML', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
  });

  it('creates table, inserts rows and selects data', () => {
    const create = executor.execute(
      'CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, gpa REAL)',
    );
    expect(create.error).toBeUndefined();

    const insert = executor.execute(
      "INSERT INTO students (id, name, gpa) VALUES (1, 'Alice', 3.9)",
    );
    expect(insert.error).toBeUndefined();

    const result = executor.execute('SELECT id, name, gpa FROM students');
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]).toEqual({ id: 1, name: 'Alice', gpa: 3.9 });
  });

  it('supports UPDATE and DELETE row mutations', () => {
    executor.execute('CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER)');
    executor.execute('INSERT INTO accounts (id, balance) VALUES (1, 100)');

    const update = executor.execute('UPDATE accounts SET balance = 250 WHERE id = 1');
    expect(update.error).toBeUndefined();

    const afterUpdate = executor.execute('SELECT balance FROM accounts WHERE id = 1');
    expect(afterUpdate.rows[0]?.balance).toBe(250);

    const del = executor.execute('DELETE FROM accounts WHERE id = 1');
    expect(del.error).toBeUndefined();

    const afterDelete = executor.execute('SELECT * FROM accounts');
    expect(afterDelete.rowCount).toBe(0);
  });

  it('translates TRUNCATE TABLE to delete all rows', () => {
    executor.execute('CREATE TABLE logs (id INTEGER PRIMARY KEY, msg TEXT)');
    executor.execute("INSERT INTO logs VALUES (1, 'a')");
    executor.execute("INSERT INTO logs VALUES (2, 'b')");

    const truncate = executor.execute('TRUNCATE TABLE logs');
    expect(truncate.error).toBeUndefined();

    const rows = executor.execute('SELECT * FROM logs');
    expect(rows.rowCount).toBe(0);
  });

  it('supports INSERT IGNORE and REPLACE INTO compatibility syntax', () => {
    executor.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');

    executor.execute("INSERT INTO users VALUES (1, 'Alice')");
    const ignored = executor.execute("INSERT IGNORE INTO users VALUES (1, 'Ignored')");
    expect(ignored.error).toBeUndefined();

    const replaced = executor.execute("REPLACE INTO users VALUES (1, 'Updated')");
    expect(replaced.error).toBeUndefined();

    const result = executor.execute('SELECT name FROM users WHERE id = 1');
    expect(result.rows[0]?.name).toBe('Updated');
  });

  it('executes multi-statement SQL with loadSQL', () => {
    const result = executor.loadSQL(`
      CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT);
      INSERT INTO courses VALUES (1, 'DBMS');
      INSERT INTO courses VALUES (2, 'OS');
    `);

    expect(result.error).toBeUndefined();
    const rows = executor.execute('SELECT * FROM courses ORDER BY id');
    expect(rows.rowCount).toBe(2);
  });
});
