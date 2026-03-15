import { describe, expect, it } from 'vitest';
import { splitSqlStatements } from '@/lib/engine/sql-executor/statement-splitter';

describe('SQL statement splitter', () => {
  it('keeps trigger body as single statement', () => {
    const sql = `
      CREATE TRIGGER trg_students_ai
      AFTER INSERT ON students
      BEGIN
        INSERT INTO audit_log(message) VALUES ('inserted');
        INSERT INTO audit_log(message) VALUES ('done');
      END;
      SELECT * FROM students;
    `;

    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0].toUpperCase()).toContain('CREATE TRIGGER');
    expect(statements[0]).toContain("INSERT INTO audit_log(message) VALUES ('inserted')");
    expect(statements[1].trim().toUpperCase()).toBe('SELECT * FROM STUDENTS;');
  });

  it('keeps plsql block as single statement', () => {
    const sql = `
      DECLARE
        v_name VARCHAR2(50) := 'John';
      BEGIN
        DBMS_OUTPUT.PUT_LINE(v_name);
      END;
      SELECT 1;
    `;

    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0].trim().toUpperCase().startsWith('DECLARE')).toBe(true);
  });

  it('keeps procedure body as single statement', () => {
    const sql = `
      CREATE PROCEDURE give_raise(IN emp_id INT, IN pct DECIMAL(5,2))
      BEGIN
        UPDATE employees SET salary = salary * (1 + pct / 100) WHERE id = emp_id;
        INSERT INTO audit_log(message) VALUES ('raise done');
      END;
      SELECT 1;
    `;

    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0].toUpperCase()).toContain('CREATE PROCEDURE');
    expect(statements[0]).toContain("INSERT INTO audit_log(message) VALUES ('raise done')");
    expect(statements[1].trim().toUpperCase()).toBe('SELECT 1;');
  });
});
