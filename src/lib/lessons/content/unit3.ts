import type { Lesson } from '@/types/lesson';

export const unit3Lessons: Lesson[] = [
  {
    slug: 'ddl',
    title: 'Data Definition Language (DDL)',
    description: 'Learn CREATE, ALTER, DROP — the commands that define database structure.',
    steps: [
      {
        id: 'u3l1s1',
        type: 'explanation',
        title: 'What is DDL?',
        explanation:
          'DDL (Data Definition Language) commands define and modify the structure of database objects. The three main DDL commands are: CREATE (make new objects), ALTER (modify existing objects), and DROP (remove objects). DDL changes the schema, not the data.',
      },
      {
        id: 'u3l1s2',
        type: 'sql',
        title: 'CREATE TABLE',
        explanation:
          'CREATE TABLE defines a new table with its columns and their data types. Common types: INT (integers), VARCHAR(n) (variable-length strings), DECIMAL(p,s) (exact numbers), DATE, BOOLEAN.',
        command:
          'CREATE TABLE Products (\n  product_id INT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  price DECIMAL(10,2) DEFAULT 0.00,\n  category VARCHAR(50),\n  created_at DATE\n);',
        afterState: [
          {
            name: 'Products',
            columns: ['product_id', 'name', 'price', 'category', 'created_at'],
            rows: [],
          },
        ],
      },
      {
        id: 'u3l1s3',
        type: 'sql',
        title: 'ALTER TABLE',
        explanation:
          'ALTER TABLE modifies an existing table. You can ADD columns, DROP columns, MODIFY column types, or ADD/DROP constraints. This is how schemas evolve over time.',
        command:
          'ALTER TABLE Products ADD COLUMN stock_qty INT DEFAULT 0;\nALTER TABLE Products ADD COLUMN weight DECIMAL(5,2);',
        afterState: [
          {
            name: 'Products',
            columns: [
              'product_id',
              'name',
              'price',
              'category',
              'created_at',
              'stock_qty',
              'weight',
            ],
            rows: [],
          },
        ],
      },
      {
        id: 'u3l1s4',
        type: 'sql',
        title: 'DROP TABLE',
        explanation:
          "DROP TABLE permanently removes a table and all its data. Use with caution! DROP IF EXISTS avoids errors when the table doesn't exist. CASCADE drops dependent objects too.",
        command: 'DROP TABLE IF EXISTS Products;',
      },
      {
        id: 'u3l1s5',
        type: 'sql',
        title: 'CREATE INDEX',
        explanation:
          'Indexes speed up queries by creating a lookup structure (like a book index). CREATE INDEX makes a B-tree index on specified columns. Queries that filter or sort by indexed columns run much faster.',
        command:
          'CREATE TABLE Orders (\n  order_id INT PRIMARY KEY,\n  customer_id INT,\n  order_date DATE,\n  total DECIMAL(10,2)\n);\n\nCREATE INDEX idx_orders_customer ON Orders(customer_id);\nCREATE INDEX idx_orders_date ON Orders(order_date);',
      },
    ],
  },
  {
    slug: 'dml',
    title: 'Data Manipulation Language (DML)',
    description: 'Master INSERT, UPDATE, DELETE — the commands that modify data.',
    steps: [
      {
        id: 'u3l2s1',
        type: 'explanation',
        title: 'What is DML?',
        explanation:
          'DML (Data Manipulation Language) commands modify the data within tables. The three main DML commands are: INSERT (add new rows), UPDATE (modify existing rows), and DELETE (remove rows). Unlike DDL, DML changes data, not structure.',
      },
      {
        id: 'u3l2s2',
        type: 'sql',
        title: 'INSERT INTO',
        explanation:
          'INSERT adds new rows to a table. You can insert a single row, multiple rows, or insert from a SELECT query. Column names are optional if you provide values for all columns in order.',
        command:
          "CREATE TABLE Employees (\n  id INT PRIMARY KEY,\n  name VARCHAR(100),\n  dept VARCHAR(50),\n  salary DECIMAL(10,2)\n);\n\nINSERT INTO Employees VALUES (1, 'Alice', 'Engineering', 85000);\nINSERT INTO Employees VALUES (2, 'Bob', 'Marketing', 72000);\nINSERT INTO Employees (id, name, dept) VALUES (3, 'Carol', 'Engineering');",
        afterState: [
          {
            name: 'Employees',
            columns: ['id', 'name', 'dept', 'salary'],
            rows: [
              ['1', 'Alice', 'Engineering', '85000'],
              ['2', 'Bob', 'Marketing', '72000'],
              ['3', 'Carol', 'Engineering', ''],
            ],
          },
        ],
      },
      {
        id: 'u3l2s3',
        type: 'sql',
        title: 'UPDATE',
        explanation:
          'UPDATE modifies existing rows. Always use a WHERE clause to target specific rows — without it, ALL rows are updated! You can update multiple columns at once.',
        command:
          "UPDATE Employees SET salary = 78000 WHERE id = 3;\nUPDATE Employees SET salary = salary * 1.10 WHERE dept = 'Engineering';",
        beforeState: [
          {
            name: 'Employees',
            columns: ['id', 'name', 'dept', 'salary'],
            rows: [
              ['1', 'Alice', 'Engineering', '85000'],
              ['2', 'Bob', 'Marketing', '72000'],
              ['3', 'Carol', 'Engineering', '78000'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Employees',
            columns: ['id', 'name', 'dept', 'salary'],
            rows: [
              ['1', 'Alice', 'Engineering', '93500'],
              ['2', 'Bob', 'Marketing', '72000'],
              ['3', 'Carol', 'Engineering', '85800'],
            ],
          },
        ],
        highlightedRows: [{ tableIndex: 0, rowIndices: [0, 2], color: 'yellow' }],
      },
      {
        id: 'u3l2s4',
        type: 'sql',
        title: 'DELETE',
        explanation:
          "DELETE removes rows from a table. Like UPDATE, always use WHERE to target specific rows. DELETE without WHERE removes ALL rows. TRUNCATE is faster for removing all rows but can't be rolled back.",
        command: "DELETE FROM Employees WHERE dept = 'Marketing';",
        beforeState: [
          {
            name: 'Employees',
            columns: ['id', 'name', 'dept', 'salary'],
            rows: [
              ['1', 'Alice', 'Engineering', '93500'],
              ['2', 'Bob', 'Marketing', '72000'],
              ['3', 'Carol', 'Engineering', '85800'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Employees',
            columns: ['id', 'name', 'dept', 'salary'],
            rows: [
              ['1', 'Alice', 'Engineering', '93500'],
              ['3', 'Carol', 'Engineering', '85800'],
            ],
          },
        ],
        highlightedRows: [{ tableIndex: 0, rowIndices: [1], color: 'red' }],
      },
    ],
  },
  {
    slug: 'select-queries',
    title: 'SELECT Queries',
    description: 'Master the SELECT statement — filtering, sorting, grouping, and aggregation.',
    steps: [
      {
        id: 'u3l3s1',
        type: 'sql',
        title: 'Basic SELECT',
        explanation:
          'SELECT retrieves data from tables. SELECT * returns all columns. You can specify columns, use aliases with AS, and filter with WHERE.',
        command: 'SELECT name, salary FROM Employees WHERE salary > 50000 ORDER BY salary DESC;',
        beforeState: [
          {
            name: 'Employees',
            columns: ['id', 'name', 'dept', 'salary'],
            rows: [
              ['1', 'Alice', 'Engineering', '85000'],
              ['2', 'Bob', 'Marketing', '45000'],
              ['3', 'Carol', 'Engineering', '72000'],
              ['4', 'Dave', 'Sales', '55000'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Result',
            columns: ['name', 'salary'],
            rows: [
              ['Alice', '85000'],
              ['Carol', '72000'],
              ['Dave', '55000'],
            ],
          },
        ],
      },
      {
        id: 'u3l3s2',
        type: 'sql',
        title: 'WHERE Conditions',
        explanation:
          'WHERE supports: comparison (=, <, >, <=, >=, <>), logical (AND, OR, NOT), pattern (LIKE with % and _), range (BETWEEN), set (IN), and NULL check (IS NULL, IS NOT NULL).',
        command:
          "SELECT * FROM Employees\nWHERE dept IN ('Engineering', 'Sales')\n  AND salary BETWEEN 50000 AND 90000\n  AND name LIKE 'A%';",
        beforeState: [
          {
            name: 'Employees',
            columns: ['id', 'name', 'dept', 'salary'],
            rows: [
              ['1', 'Alice', 'Engineering', '85000'],
              ['2', 'Bob', 'Marketing', '45000'],
              ['3', 'Carol', 'Engineering', '72000'],
              ['4', 'Adam', 'Sales', '55000'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Result',
            columns: ['id', 'name', 'dept', 'salary'],
            rows: [
              ['1', 'Alice', 'Engineering', '85000'],
              ['4', 'Adam', 'Sales', '55000'],
            ],
          },
        ],
      },
      {
        id: 'u3l3s3',
        type: 'sql',
        title: 'Aggregate Functions',
        explanation:
          'Aggregate functions compute a single value from a set of rows: COUNT (number of rows), SUM (total), AVG (average), MIN (minimum), MAX (maximum). They collapse multiple rows into one.',
        command:
          'SELECT\n  dept,\n  COUNT(*) AS emp_count,\n  AVG(salary) AS avg_salary,\n  MAX(salary) AS max_salary\nFROM Employees\nGROUP BY dept;',
        beforeState: [
          {
            name: 'Employees',
            columns: ['id', 'name', 'dept', 'salary'],
            rows: [
              ['1', 'Alice', 'Engineering', '85000'],
              ['2', 'Bob', 'Marketing', '45000'],
              ['3', 'Carol', 'Engineering', '72000'],
              ['4', 'Dave', 'Marketing', '52000'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Result',
            columns: ['dept', 'emp_count', 'avg_salary', 'max_salary'],
            rows: [
              ['Engineering', '2', '78500', '85000'],
              ['Marketing', '2', '48500', '52000'],
            ],
          },
        ],
      },
      {
        id: 'u3l3s4',
        type: 'sql',
        title: 'GROUP BY and HAVING',
        explanation:
          'GROUP BY groups rows with the same values in specified columns. HAVING filters groups (like WHERE for groups). Execution order: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY.',
        command:
          'SELECT dept, COUNT(*) AS cnt\nFROM Employees\nGROUP BY dept\nHAVING COUNT(*) >= 2\nORDER BY cnt DESC;',
        afterState: [
          {
            name: 'Result',
            columns: ['dept', 'cnt'],
            rows: [
              ['Engineering', '3'],
              ['Marketing', '2'],
            ],
          },
        ],
      },
      {
        id: 'u3l3s5',
        type: 'sql',
        title: 'DISTINCT and LIMIT',
        explanation:
          'DISTINCT removes duplicate rows from the result. LIMIT (or FETCH FIRST in standard SQL) restricts the number of rows returned. Combined with ORDER BY, LIMIT returns the top/bottom N rows.',
        command:
          'SELECT DISTINCT dept FROM Employees;\n\nSELECT name, salary FROM Employees\nORDER BY salary DESC\nLIMIT 3;',
        afterState: [
          {
            name: 'Result',
            columns: ['name', 'salary'],
            rows: [
              ['Alice', '85000'],
              ['Carol', '72000'],
              ['Dave', '55000'],
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'constraints',
    title: 'Constraints',
    description:
      'Enforce data integrity with PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, and NOT NULL.',
    steps: [
      {
        id: 'u3l4s1',
        type: 'explanation',
        title: 'Why Constraints?',
        explanation:
          'Constraints are rules enforced by the DBMS to maintain data integrity. They prevent invalid data from entering the database. Without constraints, you could have employees with no name, duplicate IDs, or orders referencing non-existent customers.',
      },
      {
        id: 'u3l4s2',
        type: 'sql',
        title: 'PRIMARY KEY',
        explanation:
          'PRIMARY KEY uniquely identifies each row. It implies NOT NULL and UNIQUE. A table can have only one primary key, which can be a single column or composite (multiple columns).',
        command:
          'CREATE TABLE Students (\n  student_id INT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL\n);\n\n-- Composite primary key\nCREATE TABLE Enrollment (\n  student_id INT,\n  course_id INT,\n  PRIMARY KEY (student_id, course_id)\n);',
      },
      {
        id: 'u3l4s3',
        type: 'sql',
        title: 'FOREIGN KEY',
        explanation:
          "FOREIGN KEY creates a link between tables. It references a PRIMARY KEY or UNIQUE column in another table. This enforces referential integrity — you can't reference a non-existent row.",
        command:
          'CREATE TABLE Courses (\n  course_id INT PRIMARY KEY,\n  title VARCHAR(100)\n);\n\nCREATE TABLE Grades (\n  student_id INT,\n  course_id INT,\n  grade CHAR(2),\n  FOREIGN KEY (student_id) REFERENCES Students(student_id),\n  FOREIGN KEY (course_id) REFERENCES Courses(course_id)\n);',
      },
      {
        id: 'u3l4s4',
        type: 'sql',
        title: 'UNIQUE and NOT NULL',
        explanation:
          'UNIQUE ensures no two rows have the same value in a column (NULLs are allowed). NOT NULL ensures a column always has a value. Combining them creates an alternate key.',
        command:
          "CREATE TABLE Users (\n  id INT PRIMARY KEY,\n  email VARCHAR(255) UNIQUE NOT NULL,\n  username VARCHAR(50) UNIQUE NOT NULL,\n  bio TEXT\n);\n\n-- This would fail: INSERT INTO Users VALUES (1, NULL, 'alice', 'Hi');",
      },
      {
        id: 'u3l4s5',
        type: 'sql',
        title: 'CHECK and DEFAULT',
        explanation:
          'CHECK enforces a condition on column values. DEFAULT provides a value when none is specified during INSERT.',
        command:
          "CREATE TABLE Products (\n  id INT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  price DECIMAL(10,2) CHECK (price >= 0),\n  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'discontinued')),\n  quantity INT DEFAULT 0 CHECK (quantity >= 0)\n);",
      },
    ],
  },
  {
    slug: 'joins',
    title: 'JOIN Operations',
    description:
      'Combine data from multiple tables using INNER, LEFT, RIGHT, FULL, and CROSS joins.',
    steps: [
      {
        id: 'u3l5s1',
        type: 'explanation',
        title: 'Why Joins?',
        explanation:
          'In normalized databases, related data is spread across multiple tables. JOINs combine rows from two or more tables based on related columns. They are the most powerful feature of relational databases.',
      },
      {
        id: 'u3l5s2',
        type: 'sql',
        title: 'INNER JOIN',
        explanation:
          "INNER JOIN returns only rows that have matching values in both tables. If a row in either table has no match, it's excluded from the result.",
        command:
          'SELECT s.name, c.title, e.grade\nFROM Students s\nINNER JOIN Enrollment e ON s.id = e.student_id\nINNER JOIN Courses c ON e.course_id = c.id;',
        beforeState: [
          {
            name: 'Students',
            columns: ['id', 'name'],
            rows: [
              ['1', 'Alice'],
              ['2', 'Bob'],
              ['3', 'Carol'],
            ],
          },
          {
            name: 'Enrollment',
            columns: ['student_id', 'course_id', 'grade'],
            rows: [
              ['1', '101', 'A'],
              ['1', '102', 'B'],
              ['2', '101', 'A'],
            ],
          },
          {
            name: 'Courses',
            columns: ['id', 'title'],
            rows: [
              ['101', 'Databases'],
              ['102', 'Algorithms'],
              ['103', 'Networks'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Result',
            columns: ['name', 'title', 'grade'],
            rows: [
              ['Alice', 'Databases', 'A'],
              ['Alice', 'Algorithms', 'B'],
              ['Bob', 'Databases', 'A'],
            ],
          },
        ],
      },
      {
        id: 'u3l5s3',
        type: 'sql',
        title: 'LEFT JOIN',
        explanation:
          'LEFT JOIN returns ALL rows from the left table, plus matching rows from the right table. If there\'s no match, right-side columns are NULL. Useful for finding "students with no enrollments."',
        command:
          'SELECT s.name, e.course_id\nFROM Students s\nLEFT JOIN Enrollment e ON s.id = e.student_id;',
        afterState: [
          {
            name: 'Result',
            columns: ['name', 'course_id'],
            rows: [
              ['Alice', '101'],
              ['Alice', '102'],
              ['Bob', '101'],
              ['Carol', 'NULL'],
            ],
          },
        ],
        highlightedRows: [{ tableIndex: 0, rowIndices: [3], color: 'yellow' }],
      },
      {
        id: 'u3l5s4',
        type: 'sql',
        title: 'RIGHT and FULL JOIN',
        explanation:
          "RIGHT JOIN is the mirror of LEFT JOIN — all right-table rows are kept. FULL OUTER JOIN keeps ALL rows from both tables, with NULLs where there's no match.",
        command:
          'SELECT s.name, c.title\nFROM Students s\nFULL OUTER JOIN Enrollment e ON s.id = e.student_id\nFULL OUTER JOIN Courses c ON e.course_id = c.id;',
      },
      {
        id: 'u3l5s5',
        type: 'sql',
        title: 'CROSS JOIN and Self-Join',
        explanation:
          'CROSS JOIN produces the Cartesian product — every row from table A paired with every row from table B (m × n rows). Self-Join joins a table with itself, useful for hierarchical data (e.g., employee → manager).',
        command:
          'SELECT e.name AS employee, m.name AS manager\nFROM Employees e\nJOIN Employees m ON e.manager_id = m.id;',
        beforeState: [
          {
            name: 'Employees',
            columns: ['id', 'name', 'manager_id'],
            rows: [
              ['1', 'CEO', ''],
              ['2', 'Alice', '1'],
              ['3', 'Bob', '1'],
              ['4', 'Carol', '2'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Result',
            columns: ['employee', 'manager'],
            rows: [
              ['Alice', 'CEO'],
              ['Bob', 'CEO'],
              ['Carol', 'Alice'],
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'set-operations',
    title: 'Set Operations',
    description: 'Combine query results with UNION, INTERSECT, and EXCEPT.',
    steps: [
      {
        id: 'u3l6s1',
        type: 'explanation',
        title: 'Set Operations Overview',
        explanation:
          'SQL set operations combine the results of two SELECT statements. UNION (all rows from both), INTERSECT (only common rows), EXCEPT (rows in first but not second). Both queries must have the same number of columns with compatible types.',
      },
      {
        id: 'u3l6s2',
        type: 'sql',
        title: 'UNION',
        explanation:
          'UNION combines results and removes duplicates. UNION ALL keeps duplicates (faster). Useful for combining data from similar but separate tables.',
        command:
          "SELECT name, 'student' AS role FROM Students\nUNION\nSELECT name, 'instructor' AS role FROM Instructors;",
        beforeState: [
          {
            name: 'Students',
            columns: ['name'],
            rows: [['Alice'], ['Bob'], ['Carol']],
          },
          {
            name: 'Instructors',
            columns: ['name'],
            rows: [['Dave'], ['Bob']],
          },
        ],
        afterState: [
          {
            name: 'Result',
            columns: ['name', 'role'],
            rows: [
              ['Alice', 'student'],
              ['Bob', 'student'],
              ['Carol', 'student'],
              ['Dave', 'instructor'],
              ['Bob', 'instructor'],
            ],
          },
        ],
      },
      {
        id: 'u3l6s3',
        type: 'sql',
        title: 'INTERSECT',
        explanation:
          'INTERSECT returns only rows that appear in BOTH result sets. Useful for finding common elements.',
        command: 'SELECT name FROM Students\nINTERSECT\nSELECT name FROM Instructors;',
        afterState: [{ name: 'Result', columns: ['name'], rows: [['Bob']] }],
      },
      {
        id: 'u3l6s4',
        type: 'sql',
        title: 'EXCEPT',
        explanation:
          "EXCEPT (called MINUS in Oracle) returns rows from the first query that don't appear in the second. Useful for finding differences.",
        command: 'SELECT name FROM Students\nEXCEPT\nSELECT name FROM Instructors;',
        afterState: [{ name: 'Result', columns: ['name'], rows: [['Alice'], ['Carol']] }],
      },
    ],
  },
  {
    slug: 'subqueries',
    title: 'Subqueries',
    description: 'Nest queries within queries using scalar, multi-row, and correlated subqueries.',
    steps: [
      {
        id: 'u3l7s1',
        type: 'explanation',
        title: 'What is a Subquery?',
        explanation:
          "A subquery (inner query) is a SELECT nested inside another SQL statement. It can appear in WHERE, FROM, SELECT, or HAVING clauses. The outer query uses the subquery's result. Types: scalar (returns one value), row (returns one row), table (returns multiple rows/columns).",
      },
      {
        id: 'u3l7s2',
        type: 'sql',
        title: 'Scalar Subquery',
        explanation:
          'A scalar subquery returns exactly one value. It can be used anywhere a single value is expected — in SELECT, WHERE, or even in calculations.',
        command:
          'SELECT name, salary,\n  salary - (SELECT AVG(salary) FROM Employees) AS diff_from_avg\nFROM Employees;',
        beforeState: [
          {
            name: 'Employees',
            columns: ['id', 'name', 'salary'],
            rows: [
              ['1', 'Alice', '80000'],
              ['2', 'Bob', '60000'],
              ['3', 'Carol', '70000'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Result',
            columns: ['name', 'salary', 'diff_from_avg'],
            rows: [
              ['Alice', '80000', '10000'],
              ['Bob', '60000', '-10000'],
              ['Carol', '70000', '0'],
            ],
          },
        ],
      },
      {
        id: 'u3l7s3',
        type: 'sql',
        title: 'Multi-Row Subquery with IN',
        explanation:
          'A multi-row subquery returns multiple values. Use with IN, ANY, or ALL operators. IN checks if a value matches any value in the subquery result.',
        command:
          'SELECT name FROM Students\nWHERE id IN (\n  SELECT student_id FROM Enrollment\n  WHERE course_id = 101\n);',
      },
      {
        id: 'u3l7s4',
        type: 'sql',
        title: 'Correlated Subquery',
        explanation:
          'A correlated subquery references columns from the outer query. It executes once for each row of the outer query. More powerful but potentially slower than non-correlated subqueries.',
        command:
          'SELECT name, salary, dept\nFROM Employees e1\nWHERE salary > (\n  SELECT AVG(salary) FROM Employees e2\n  WHERE e2.dept = e1.dept\n);',
      },
      {
        id: 'u3l7s5',
        type: 'sql',
        title: 'EXISTS Operator',
        explanation:
          "EXISTS returns TRUE if the subquery returns at least one row. It's efficient because it stops as soon as it finds a match. Often used with correlated subqueries.",
        command:
          'SELECT d.name\nFROM Departments d\nWHERE EXISTS (\n  SELECT 1 FROM Employees e\n  WHERE e.dept_id = d.id AND e.salary > 100000\n);',
      },
    ],
  },
  {
    slug: 'plsql',
    title: 'PL/SQL & Stored Procedures',
    description: 'Learn procedural SQL with variables, loops, cursors, and stored procedures.',
    steps: [
      {
        id: 'u3l8s1',
        type: 'explanation',
        title: 'What is PL/SQL?',
        explanation:
          'PL/SQL (Procedural Language/SQL) extends SQL with procedural features: variables, conditionals (IF/ELSE), loops (FOR, WHILE), exception handling, and procedures/functions. It allows complex business logic to run inside the database. MySQL uses a similar syntax, and PostgreSQL has PL/pgSQL.',
      },
      {
        id: 'u3l8s2',
        type: 'sql',
        title: 'Variables and Control Flow',
        explanation:
          'PL/SQL blocks have DECLARE (variables), BEGIN (logic), and END sections. Variables hold intermediate values. IF/ELSE controls branching.',
        command:
          "-- PL/SQL Block (Oracle/PostgreSQL style)\nDECLARE\n  v_count INT;\n  v_msg VARCHAR(100);\nBEGIN\n  SELECT COUNT(*) INTO v_count FROM Employees;\n  \n  IF v_count > 10 THEN\n    v_msg := 'Large company';\n  ELSIF v_count > 5 THEN\n    v_msg := 'Medium company';\n  ELSE\n    v_msg := 'Small company';\n  END IF;\nEND;",
      },
      {
        id: 'u3l8s3',
        type: 'sql',
        title: 'Stored Procedures',
        explanation:
          'A stored procedure is a named block of code saved in the database. It accepts parameters, executes SQL statements, and can return values. Benefits: code reuse, security (grant EXECUTE instead of table access), reduced network traffic.',
        command:
          '-- Create a stored procedure\nCREATE PROCEDURE give_raise(\n  IN emp_id INT,\n  IN percentage DECIMAL(5,2)\n)\nBEGIN\n  UPDATE Employees\n  SET salary = salary * (1 + percentage / 100)\n  WHERE id = emp_id;\nEND;\n\n-- Call it\nCALL give_raise(101, 10.00);',
      },
      {
        id: 'u3l8s4',
        type: 'sql',
        title: 'Functions',
        explanation:
          'Functions are like procedures but they RETURN a value. They can be used inside SELECT statements. Use functions for calculations and procedures for actions.',
        command:
          'CREATE FUNCTION get_dept_avg(dept_name VARCHAR(50))\nRETURNS DECIMAL(10,2)\nBEGIN\n  DECLARE avg_sal DECIMAL(10,2);\n  SELECT AVG(salary) INTO avg_sal\n  FROM Employees WHERE dept = dept_name;\n  RETURN avg_sal;\nEND;\n\n-- Use in query\nSELECT name, salary, get_dept_avg(dept) AS dept_avg\nFROM Employees;',
      },
      {
        id: 'u3l8s5',
        type: 'explanation',
        title: 'Cursors',
        explanation:
          "A cursor allows row-by-row processing of a query result. DECLARE defines the cursor, OPEN executes the query, FETCH retrieves one row at a time, and CLOSE releases resources. Use cursors when set-based operations aren't sufficient — but prefer set operations when possible for performance.",
      },
    ],
  },
  {
    slug: 'triggers',
    title: 'Triggers',
    description:
      'Automate actions with BEFORE/AFTER triggers on INSERT, UPDATE, and DELETE events.',
    steps: [
      {
        id: 'u3l9s1',
        type: 'explanation',
        title: 'What is a Trigger?',
        explanation:
          'A trigger is a stored procedure that automatically executes when a specific event occurs: INSERT, UPDATE, or DELETE on a table. Triggers can fire BEFORE (validate/modify data) or AFTER (log changes, cascade updates) the event. They enforce complex business rules automatically.',
      },
      {
        id: 'u3l9s2',
        type: 'sql',
        title: 'BEFORE INSERT Trigger',
        explanation:
          'A BEFORE INSERT trigger runs before a new row is inserted. Use it to validate or transform data. The NEW keyword refers to the row being inserted.',
        command:
          'CREATE TRIGGER validate_salary\nBEFORE INSERT ON Employees\nFOR EACH ROW\nBEGIN\n  IF NEW.salary < 0 THEN\n    SET NEW.salary = 0;\n  END IF;\n  SET NEW.name = UPPER(NEW.name);\nEND;',
      },
      {
        id: 'u3l9s3',
        type: 'sql',
        title: 'AFTER UPDATE Trigger (Audit Log)',
        explanation:
          'An AFTER trigger runs after the operation completes. Common use case: creating an audit log that tracks all changes to important tables.',
        command:
          'CREATE TABLE Salary_Audit (\n  id INT PRIMARY KEY,\n  emp_id INT,\n  old_salary DECIMAL(10,2),\n  new_salary DECIMAL(10,2),\n  changed_at DATETIME\n);\n\nCREATE TRIGGER log_salary_change\nAFTER UPDATE ON Employees\nFOR EACH ROW\nBEGIN\n  IF OLD.salary <> NEW.salary THEN\n    INSERT INTO Salary_Audit(emp_id, old_salary, new_salary, changed_at)\n    VALUES (NEW.id, OLD.salary, NEW.salary, NOW());\n  END IF;\nEND;',
      },
      {
        id: 'u3l9s4',
        type: 'explanation',
        title: 'Trigger Considerations',
        explanation:
          'Triggers are powerful but use with care: (1) They make debugging harder — actions happen implicitly. (2) Cascading triggers can cause unexpected behavior. (3) They add overhead to every INSERT/UPDATE/DELETE. (4) Some databases limit what triggers can do (e.g., no DDL). Best practice: keep triggers simple and document them well.',
      },
    ],
  },
];
