import { describe, expect, it } from 'vitest';
import { isPlSqlBlock, runPlSqlBlock } from '@/lib/engine/sql-executor/plsql-runtime';
import type { QueryResult, Row } from '@/types/database';

describe('PL/SQL runtime', () => {
  it('detects plsql blocks', () => {
    expect(isPlSqlBlock('BEGIN NULL; END;')).toBe(true);
    expect(isPlSqlBlock('SELECT * FROM users;')).toBe(false);
  });

  it('supports basic cursor open/fetch/close and output', () => {
    const mockRows: Row[] = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    const executeSql = (sql: string): QueryResult => {
      if (/SELECT\s+id\s*,\s*name\s+FROM\s+students/i.test(sql)) {
        return {
          columns: ['id', 'name'],
          rows: mockRows,
          rowCount: mockRows.length,
          executionTimeMs: 1,
        };
      }

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 1,
      };
    };

    const block = `
      DECLARE
        CURSOR c_students IS SELECT id, name FROM students;
        v_id NUMBER;
        v_name VARCHAR2(50);
      BEGIN
        OPEN c_students;
        FETCH c_students INTO v_id, v_name;
        DBMS_OUTPUT.PUT_LINE(v_name);
        CLOSE c_students;
      END;
    `;

    const result = runPlSqlBlock(block, { executeSql });
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['output']);
    expect(result.rows[0]).toEqual({ output: 'Alice' });
  });

  it('substitutes @session variables in SQL statements', () => {
    const executeSql = (sql: string): QueryResult => {
      if (/SELECT\s+'Hello'/i.test(sql)) {
        return {
          columns: ["'Hello'"],
          rows: [{ "'Hello'": 'Hello' }],
          rowCount: 1,
          executionTimeMs: 1,
        };
      }
      return { columns: [], rows: [], rowCount: 0, executionTimeMs: 1 };
    };

    const block = `
      BEGIN
        SET @greeting = 'Hello';
        DBMS_OUTPUT.PUT_LINE(@greeting);
      END;
    `;

    const result = runPlSqlBlock(block, { executeSql });
    expect(result.error).toBeUndefined();
    expect(result.columns).toEqual(['output']);
    expect(result.rows[0]).toEqual({ output: 'Hello' });
  });

  it('resolves bare variable names in SELECT without FROM', () => {
    const executeSql = (): QueryResult => {
      return { columns: [], rows: [], rowCount: 0, executionTimeMs: 1 };
    };

    const block = `
      DECLARE
        v_x NUMBER := 42;
      BEGIN
        SELECT v_x;
      END;
    `;

    const result = runPlSqlBlock(block, { executeSql });
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]?.v_x).toBe(42);
  });
});
