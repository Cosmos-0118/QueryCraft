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

// ─── Subquery operators ────────────────────────────────────────────────

describe('Subquery operators (ANY / SOME / ALL)', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
    executor.execute(`CREATE TABLE Sales (
      sale_id INTEGER PRIMARY KEY, product_name TEXT, category TEXT, price REAL, quantity INTEGER
    )`);
    executor.loadSQL(`
      INSERT INTO Sales VALUES (1, 'Laptop', 'Electronics', 75000, 2);
      INSERT INTO Sales VALUES (2, 'Mobile', 'Electronics', 20000, 5);
      INSERT INTO Sales VALUES (3, 'Headphones', 'Electronics', 2000, 3);
      INSERT INTO Sales VALUES (4, 'Chair', 'Furniture', 5000, 2);
      INSERT INTO Sales VALUES (5, 'Table', 'Furniture', 8000, 6);
      INSERT INTO Sales VALUES (6, 'Pen', 'Stationary', 20, 10);
      INSERT INTO Sales VALUES (7, 'Notebook', 'Stationary', 50, 8);
      INSERT INTO Sales VALUES (8, 'Monitor', 'Electronics', 15000, 4);
      INSERT INTO Sales VALUES (9, 'Cupboard', 'Furniture', 25000, 1);
      INSERT INTO Sales VALUES (10, 'Marker', 'Stationary', 40, 7);
    `);
  });

  it('supports > ANY (subquery)', () => {
    const result = executor.execute(
      "SELECT product_name FROM Sales WHERE price > ANY (SELECT price FROM Sales WHERE category = 'Stationary')",
    );
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(9);
  });

  it('supports > ALL (subquery)', () => {
    const result = executor.execute(
      "SELECT product_name FROM Sales WHERE price > ALL (SELECT price FROM Sales WHERE category = 'Stationary')",
    );
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(7);
  });

  it('supports < ANY (subquery)', () => {
    const result = executor.execute(
      "SELECT product_name FROM Sales WHERE price < ANY (SELECT price FROM Sales WHERE category = 'Furniture')",
    );
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(8);
  });

  it('supports < ALL (subquery)', () => {
    const result = executor.execute(
      "SELECT product_name FROM Sales WHERE price < ALL (SELECT price FROM Sales WHERE category = 'Furniture')",
    );
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(4);
  });

  it('supports = ANY (subquery) as IN', () => {
    const result = executor.execute(
      "SELECT product_name FROM Sales WHERE category = ANY (SELECT category FROM Sales WHERE category = 'Electronics')",
    );
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(4);
  });

  it('supports SOME as alias for ANY', () => {
    const result = executor.execute(
      "SELECT product_name FROM Sales WHERE price > SOME (SELECT price FROM Sales WHERE category = 'Stationary')",
    );
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(9);
  });

  it('supports >= ANY (subquery)', () => {
    const result = executor.execute(
      "SELECT product_name FROM Sales WHERE price >= ANY (SELECT price FROM Sales WHERE category = 'Stationary')",
    );
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(10);
  });

  it('supports <= ALL (subquery)', () => {
    const result = executor.execute(
      "SELECT product_name FROM Sales WHERE price <= ALL (SELECT price FROM Sales WHERE category = 'Stationary')",
    );
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].product_name).toBe('Pen');
  });

  it('supports <> ALL (subquery) as NOT IN', () => {
    const result = executor.execute(
      "SELECT product_name FROM Sales WHERE category <> ALL (SELECT category FROM Sales WHERE category = 'Electronics')",
    );
    expect(result.error).toBeUndefined();
    expect(result.rowCount).toBe(6);
  });
});

// ─── Views ─────────────────────────────────────────────────────────────

describe('Views (CREATE / SELECT / UPDATE / DELETE / DROP)', () => {
  let executor: SqlExecutor;

  beforeEach(async () => {
    executor = new SqlExecutor();
    await executor.init();
    executor.execute(`CREATE TABLE Sales (
      sale_id INTEGER PRIMARY KEY, product_name TEXT, category TEXT, price REAL, quantity INTEGER
    )`);
    executor.loadSQL(`
      INSERT INTO Sales VALUES (1, 'Laptop', 'Electronics', 75000, 2);
      INSERT INTO Sales VALUES (2, 'Mobile', 'Electronics', 20000, 5);
      INSERT INTO Sales VALUES (3, 'Headphones', 'Electronics', 2000, 3);
      INSERT INTO Sales VALUES (4, 'Chair', 'Furniture', 5000, 2);
    `);
  });

  it('creates and selects from a view', () => {
    const create = executor.execute(
      "CREATE VIEW Electronics_View AS SELECT sale_id, product_name, quantity, price FROM Sales WHERE category = 'Electronics'",
    );
    expect(create.error).toBeUndefined();

    const select = executor.execute('SELECT * FROM Electronics_View');
    expect(select.error).toBeUndefined();
    expect(select.rowCount).toBe(3);
  });

  it('updates through a simple single-table view', () => {
    executor.execute(
      "CREATE VIEW Electronics_View AS SELECT sale_id, product_name, quantity, price FROM Sales WHERE category = 'Electronics'",
    );

    const update = executor.execute("UPDATE Electronics_View SET price = 22000 WHERE product_name = 'Mobile'");
    expect(update.error).toBeUndefined();

    const check = executor.execute("SELECT price FROM Sales WHERE product_name = 'Mobile'");
    expect(check.rows[0].price).toBe(22000);
  });

  it('deletes through a simple single-table view', () => {
    executor.execute(
      "CREATE VIEW Electronics_View AS SELECT sale_id, product_name, quantity, price FROM Sales WHERE category = 'Electronics'",
    );

    const del = executor.execute("DELETE FROM Electronics_View WHERE product_name = 'Headphones'");
    expect(del.error).toBeUndefined();

    const check = executor.execute('SELECT * FROM Sales');
    expect(check.rowCount).toBe(3);
  });

  it('drops a view', () => {
    executor.execute('CREATE VIEW TestView AS SELECT * FROM Sales');
    const drop = executor.execute('DROP VIEW TestView');
    expect(drop.error).toBeUndefined();
  });

  it('handles view DML with semicolons via loadSQL', () => {
    executor.execute(
      "CREATE VIEW Electronics_View AS SELECT sale_id, product_name, quantity, price FROM Sales WHERE category = 'Electronics'",
    );

    const result = executor.loadSQL(`
      UPDATE Electronics_View SET price = 22000 WHERE product_name = 'Mobile';
      SELECT * FROM Electronics_View;
      DROP VIEW Electronics_View;
    `);
    expect(result.error).toBeUndefined();
    expect(result.statementResults).toHaveLength(3);
    for (const sr of result.statementResults!) {
      expect(sr.error).toBeUndefined();
    }
  });
});

// ─── Full end-to-end script ────────────────────────────────────────────

describe('Full user script (end-to-end)', () => {
  it('executes the complete Sales/Orders/Views/Subqueries script', async () => {
    const executor = new SqlExecutor();
    await executor.init();

    const sql = `
CREATE TABLE Sales (
    sale_id INT PRIMARY KEY,
    product_name VARCHAR(50),
    category VARCHAR(50),
    price DECIMAL(10,2),
    quantity INT
);
CREATE TABLE Orders (
    order_id INT PRIMARY KEY,
    sale_id INT,
    customer_name VARCHAR(50),
    city VARCHAR(50),
    FOREIGN KEY (sale_id) REFERENCES Sales(sale_id)
);
INSERT INTO Sales VALUES
(1, 'Laptop', 'Electronics', 75000, 2),
(2, 'Mobile', 'Electronics', 20000, 5),
(3, 'Headphones', 'Electronics', 2000, 3),
(4, 'Chair', 'Furniture', 5000, 2),
(5, 'Table', 'Furniture', 8000, 6),
(6, 'Pen', 'Stationary', 20, 10),
(7, 'Notebook', 'Stationary', 50, 8),
(8, 'Monitor', 'Electronics', 15000, 4),
(9, 'Cupboard', 'Furniture', 25000, 1),
(10, 'Marker', 'Stationary', 40, 7);
INSERT INTO Orders VALUES
(1, 1, 'Rahul', 'Chennai'),
(2, 2, 'Anita', 'Mumbai'),
(3, 3, 'Karan', 'Delhi'),
(4, 5, 'Priya', 'Chennai'),
(5, 8, 'Arjun', 'Bangalore');
SELECT product_name, price FROM Sales WHERE price = (SELECT MIN(price) FROM Sales);
SELECT product_name, price FROM Sales WHERE price > (SELECT AVG(price) FROM Sales);
SELECT product_name, quantity FROM Sales WHERE quantity < (SELECT AVG(quantity) FROM Sales);
SELECT product_name, price FROM Sales WHERE price = (SELECT MAX(price) FROM Sales WHERE category = 'Furniture');
SELECT product_name, category FROM Sales WHERE category IN (SELECT category FROM Sales WHERE category = 'Electronics');
SELECT product_name, category FROM Sales WHERE category NOT IN (SELECT category FROM Sales WHERE category = 'Electronics');
SELECT product_name, price FROM Sales WHERE price > ANY (SELECT price FROM Sales WHERE category = 'Stationary');
SELECT product_name, price FROM Sales WHERE price > ALL (SELECT price FROM Sales WHERE category = 'Stationary');
SELECT DISTINCT category FROM Sales s WHERE EXISTS (SELECT 1 FROM Sales WHERE price > 50000 AND category = s.category);
SELECT DISTINCT category FROM Sales s WHERE NOT EXISTS (SELECT 1 FROM Sales WHERE price > 50000 AND category = s.category);
SELECT product_name, price FROM Sales WHERE price > (SELECT AVG(price) FROM Sales WHERE category = 'Electronics');
SELECT s.sale_id, s.product_name, o.customer_name, o.city FROM Sales s INNER JOIN Orders o ON s.sale_id = o.sale_id;
SELECT s.sale_id, s.product_name, o.customer_name FROM Sales s LEFT JOIN Orders o ON s.sale_id = o.sale_id;
SELECT s1.product_name AS product_A, s2.product_name AS product_B FROM Sales s1 CROSS JOIN Sales s2;
SELECT s1.product_name AS product1, s2.product_name AS product2, s1.category FROM Sales s1 JOIN Sales s2 ON s1.category = s2.category AND s1.sale_id <> s2.sale_id;
CREATE VIEW Electronics_View AS SELECT sale_id, product_name, quantity, price FROM Sales WHERE category = 'Electronics';
SELECT * FROM Electronics_View;
UPDATE Electronics_View SET price = 22000 WHERE product_name = 'Mobile';
DROP VIEW Electronics_View;
    `;

    const result = executor.loadSQL(sql);
    expect(result.error).toBeUndefined();
    expect(result.statementResults!.length).toBe(23);
    for (const sr of result.statementResults!) {
      expect(sr.error).toBeUndefined();
    }
  });
});
