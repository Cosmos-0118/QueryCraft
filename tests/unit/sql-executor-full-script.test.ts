import { beforeEach, describe, expect, it } from 'vitest';
import { SqlExecutor } from '@/lib/engine/sql-executor';

describe('SqlExecutor full MySQL script', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
  });

  it('executes a comprehensive MySQL script with tables, functions, procedures, and triggers', () => {
    const fullScript = `
DELIMITER $$

CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT,
    grade CHAR(1),
    gpa DECIMAL(3,2),
    enrollment_date DATE DEFAULT (CURRENT_DATE)
)$$

INSERT INTO students (name, age, grade, gpa)
VALUES
('Alice', 20, 'A', 3.80),
('Bob', 22, 'B', 3.20),
('Charlie', 21, 'A', 3.90),
('Diana', 23, 'C', 2.70),
('Eve', 20, 'B', 3.50)$$

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    department VARCHAR(50),
    salary DECIMAL(10,2),
    hire_date DATE DEFAULT (CURRENT_DATE)
)$$

INSERT INTO employees (name, department, salary)
VALUES
('John', 'Engineering', 75000),
('Jane', 'Marketing', 60000),
('Mike', 'Engineering', 80000),
('Sara', 'HR', 55000),
('Tom', 'Marketing', 65000)$$

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INT,
    old_salary DECIMAL(10,2),
    new_salary DECIMAL(10,2),
    change_date DATE
)$$

CREATE FUNCTION check_even_odd(n INT)
RETURNS VARCHAR(10)
DETERMINISTIC
BEGIN
    IF n % 2 = 0 THEN
        RETURN 'Even';
    ELSE
        RETURN 'Odd';
    END IF;
END$$

CREATE FUNCTION calculate_bonus(sal INT)
RETURNS INT
DETERMINISTIC
BEGIN
    RETURN sal * 10 / 100;
END$$

CREATE PROCEDURE insert_student(
    IN p_name VARCHAR(100),
    IN p_age INT,
    IN p_grade CHAR(1),
    IN p_gpa DECIMAL(3,2)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        SELECT 'Error occurred during insert' AS message;
    END;
    INSERT INTO students (name, age, grade, gpa) VALUES (p_name, p_age, p_grade, p_gpa);
    SELECT * FROM students WHERE name = p_name;
END$$

CREATE TRIGGER before_insert_employee
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
    IF NEW.salary < 10000 THEN
        SET NEW.salary = 10000;
    END IF;
END$$

CREATE TRIGGER after_update_employee
AFTER UPDATE ON employees
FOR EACH ROW
BEGIN
    INSERT INTO audit_log(employee_id, old_salary, new_salary, change_date)
    VALUES (OLD.id, OLD.salary, NEW.salary, DATE('now'));
END$$

DELIMITER ;

SELECT * FROM students;
SELECT * FROM employees;
CALL insert_student('Frank', 21, 'A', 3.60);
SELECT check_even_odd(10) AS result;
SELECT check_even_odd(7) AS result;
SELECT name, salary, calculate_bonus(salary) AS bonus FROM employees;
UPDATE employees SET salary = 90000 WHERE name = 'John';
SELECT * FROM audit_log;
SELECT ROW_COUNT() AS affected_rows;
`;

    const result = executor.loadSQL(fullScript);

    // Check no fatal errors
    // Allow individual statement errors if they're non-critical, but no syntax errors on IF
    const stmts = result.statementResults ?? [];

    // Debug: print any statement errors
    const errors = stmts.filter((s) => s.error).map((s) => ({ sql: s.statement?.substring(0, 80), error: s.error }));
    expect(errors).toEqual([]);

    // Verify tables were created and populated
    const studentsCheck = executor.execute('SELECT COUNT(*) AS cnt FROM students;');
    expect(studentsCheck.error).toBeUndefined();
    expect(Number(studentsCheck.rows[0]?.cnt)).toBeGreaterThanOrEqual(5);

    const employeesCheck = executor.execute('SELECT COUNT(*) AS cnt FROM employees;');
    expect(employeesCheck.error).toBeUndefined();
    expect(Number(employeesCheck.rows[0]?.cnt)).toBeGreaterThanOrEqual(5);

    // Verify function exists
    const funcStatus = executor.execute('SHOW FUNCTION STATUS;');
    expect(funcStatus.error).toBeUndefined();
    const funcNames = funcStatus.rows.map((r) => String(r.Name).toLowerCase());
    expect(funcNames).toContain('check_even_odd');
    expect(funcNames).toContain('calculate_bonus');

    // Verify procedure exists
    const procStatus = executor.execute('SHOW PROCEDURE STATUS;');
    expect(procStatus.error).toBeUndefined();
    const procNames = procStatus.rows.map((r) => String(r.Name).toLowerCase());
    expect(procNames).toContain('insert_student');

    // Verify triggers exist
    const triggerStatus = executor.execute('SHOW TRIGGERS;');
    expect(triggerStatus.error).toBeUndefined();
    const triggerNames = triggerStatus.rows.map((r) => String(r.Trigger).toLowerCase());
    expect(triggerNames).toContain('before_insert_employee');
    expect(triggerNames).toContain('after_update_employee');

    // Verify audit_log has an entry from the UPDATE
    const auditCheck = executor.execute('SELECT * FROM audit_log;');
    expect(auditCheck.error).toBeUndefined();
    expect(auditCheck.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('check_even_odd function returns correct results', () => {
    executor.execute(`
      CREATE FUNCTION check_even_odd(n INT)
      RETURNS VARCHAR(10)
      DETERMINISTIC
      BEGIN
        IF n % 2 = 0 THEN
          RETURN 'Even';
        ELSE
          RETURN 'Odd';
        END IF;
      END;
    `);

    const even = executor.execute("SELECT check_even_odd(10) AS result;");
    expect(even.error).toBeUndefined();
    expect(even.rows[0]?.result).toBe('Even');

    const odd = executor.execute("SELECT check_even_odd(7) AS result;");
    expect(odd.error).toBeUndefined();
    expect(odd.rows[0]?.result).toBe('Odd');
  });

  it('BEFORE INSERT trigger enforces minimum salary', () => {
    executor.execute(`
      CREATE TABLE emp (id INTEGER PRIMARY KEY, name TEXT, salary REAL);
    `);
    executor.execute(`
      CREATE TRIGGER min_salary_check
      BEFORE INSERT ON emp
      FOR EACH ROW
      BEGIN
        IF NEW.salary < 10000 THEN
          SET NEW.salary = 10000;
        END IF;
      END;
    `);

    executor.execute("INSERT INTO emp (name, salary) VALUES ('Low', 5000);");
    const check = executor.execute("SELECT salary FROM emp WHERE name = 'Low';");
    expect(check.error).toBeUndefined();
    expect(Number(check.rows[0]?.salary)).toBe(10000);

    executor.execute("INSERT INTO emp (name, salary) VALUES ('High', 50000);");
    const check2 = executor.execute("SELECT salary FROM emp WHERE name = 'High';");
    expect(check2.error).toBeUndefined();
    expect(Number(check2.rows[0]?.salary)).toBe(50000);
  });

  it('AFTER UPDATE trigger logs to audit_log', () => {
    executor.execute(`
      CREATE TABLE emp2 (id INTEGER PRIMARY KEY, name TEXT, salary REAL);
      CREATE TABLE audit2 (id INTEGER PRIMARY KEY, emp_id INT, old_sal REAL, new_sal REAL);
      INSERT INTO emp2 VALUES (1, 'Alice', 50000);
    `);
    executor.execute(`
      CREATE TRIGGER log_salary_change
      AFTER UPDATE ON emp2
      FOR EACH ROW
      BEGIN
        INSERT INTO audit2(emp_id, old_sal, new_sal)
        VALUES (OLD.id, OLD.salary, NEW.salary);
      END;
    `);

    executor.execute("UPDATE emp2 SET salary = 60000 WHERE name = 'Alice';");
    const audit = executor.execute('SELECT * FROM audit2;');
    expect(audit.error).toBeUndefined();
    expect(audit.rows.length).toBe(1);
    expect(Number(audit.rows[0]?.old_sal)).toBe(50000);
    expect(Number(audit.rows[0]?.new_sal)).toBe(60000);
  });

  it('procedure with EXIT HANDLER works', () => {
    executor.execute(`
      CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT UNIQUE);
      INSERT INTO items VALUES (1, 'Widget');
    `);

    executor.execute(`
      CREATE PROCEDURE safe_insert(IN p_id INT, IN p_name TEXT)
      BEGIN
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
          SELECT 'Error: duplicate' AS message;
        END;
        INSERT INTO items VALUES (p_id, p_name);
      END;
    `);

    // This should trigger the exit handler (duplicate name)
    const res = executor.execute("CALL safe_insert(2, 'Widget');");
    // Should not be a syntax error
    expect(res.error).toBeUndefined();
  });
});
