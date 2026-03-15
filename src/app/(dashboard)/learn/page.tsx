'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Check,
  Copy,
  Database,
  Layers,
  RefreshCw,
  Search,
  Shield,
  Sigma,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

/* ──────────────────── Types ──────────────────── */

interface CommandEntry {
  command: string;
  description: string;
  example: string;
}

interface Section {
  id: string;
  title: string;
  shortTitle: string;
  icon: ReactNode;
  color: string;
  gradient: string;
  commands: CommandEntry[];
}

type IndexedCommand = {
  section: Section;
  command: CommandEntry;
};

type SearchHit = IndexedCommand & {
  score: number;
};

/* ──────────────────── Data ──────────────────── */

const SECTIONS: Section[] = [
  {
    id: 'ddl',
    title: 'Data Definition Language (DDL)',
    shortTitle: 'DDL',
    icon: <Database size={15} />,
    color: 'sky',
    gradient: 'from-sky-400 to-blue-500',
    commands: [
      { command: 'CREATE DATABASE', description: 'Creates a new database.', example: 'CREATE DATABASE school;' },
      { command: 'CREATE DATABASE IF NOT EXISTS', description: 'Creates a database only if it does not already exist.', example: 'CREATE DATABASE IF NOT EXISTS analytics;' },
      { command: 'DROP DATABASE', description: 'Deletes an entire database and all its tables.', example: 'DROP DATABASE school;' },
      { command: 'DROP DATABASE IF EXISTS', description: 'Drops a database only if it exists.', example: 'DROP DATABASE IF EXISTS analytics;' },
      { command: 'USE', description: 'Switches the active database for subsequent commands.', example: 'USE school;' },
      {
        command: 'CREATE TABLE',
        description: 'Creates a new table with defined columns and data types.',
        example: `CREATE TABLE students (\n  id INT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  age INT,\n  gpa DECIMAL(3,2)\n);`,
      },
      { command: 'ALTER TABLE — ADD', description: 'Adds a new column to an existing table.', example: 'ALTER TABLE students ADD email VARCHAR(255);' },
      { command: 'ALTER TABLE — MODIFY', description: 'Changes the data type or constraints of an existing column.', example: 'ALTER TABLE students MODIFY name VARCHAR(200) NOT NULL;' },
      { command: 'ALTER TABLE — DROP COLUMN', description: 'Removes a column from a table.', example: 'ALTER TABLE students DROP COLUMN age;' },
      { command: 'DROP TABLE', description: 'Deletes a table and all its data permanently.', example: 'DROP TABLE students;' },
      { command: 'DROP TABLE IF EXISTS', description: 'Drops a table only if it exists.', example: 'DROP TABLE IF EXISTS students_archive;' },
      { command: 'TRUNCATE TABLE', description: 'Removes all rows from a table but keeps the table structure.', example: 'TRUNCATE TABLE students;' },
      { command: 'RENAME TABLE', description: 'Renames an existing table.', example: 'ALTER TABLE students RENAME TO learners;' },
      { command: 'CREATE INDEX', description: 'Creates an index to speed up lookups.', example: 'CREATE INDEX idx_students_name ON students(name);' },
      { command: 'CREATE UNIQUE INDEX', description: 'Creates an index that enforces uniqueness.', example: 'CREATE UNIQUE INDEX idx_students_email ON students(email);' },
      { command: 'DROP INDEX', description: 'Removes an index from a table.', example: 'DROP INDEX idx_students_name;' },
    ],
  },
  {
    id: 'constraints',
    title: 'Constraints',
    shortTitle: 'Constraints',
    icon: <Shield size={15} />,
    color: 'violet',
    gradient: 'from-violet-400 to-purple-500',
    commands: [
      {
        command: 'PRIMARY KEY',
        description: 'Uniquely identifies each row. Cannot be NULL or duplicate.',
        example: `CREATE TABLE courses (\n  id INT PRIMARY KEY,\n  title VARCHAR(100)\n);`,
      },
      {
        command: 'FOREIGN KEY',
        description: 'Links a column to the primary key of another table.',
        example: `CREATE TABLE enrollments (\n  student_id INT,\n  course_id INT,\n  FOREIGN KEY (student_id) REFERENCES students(id),\n  FOREIGN KEY (course_id) REFERENCES courses(id)\n);`,
      },
      { command: 'NOT NULL', description: 'Ensures a column cannot contain NULL values.', example: 'name VARCHAR(100) NOT NULL' },
      { command: 'UNIQUE', description: 'Ensures all values in a column are distinct.', example: 'email VARCHAR(255) UNIQUE' },
      { command: 'CHECK', description: 'Ensures column values satisfy a given condition.', example: 'age INT CHECK (age >= 18)' },
      { command: 'DEFAULT', description: 'Sets a default value when no value is provided.', example: "status VARCHAR(20) DEFAULT 'active'" },
      { command: 'AUTO_INCREMENT', description: 'Automatically generates a unique incrementing number for new rows.', example: 'id INT PRIMARY KEY AUTO_INCREMENT' },
    ],
  },
  {
    id: 'dml',
    title: 'Data Manipulation Language (DML)',
    shortTitle: 'DML',
    icon: <Terminal size={15} />,
    color: 'emerald',
    gradient: 'from-emerald-400 to-teal-500',
    commands: [
      {
        command: 'INSERT INTO',
        description: 'Adds a new row to a table.',
        example: `INSERT INTO students (id, name, age, gpa)\nVALUES (1, 'Alice', 21, 3.80);`,
      },
      {
        command: 'INSERT — Multiple Rows',
        description: 'Inserts several rows in a single statement.',
        example: `INSERT INTO students (id, name, age, gpa) VALUES\n  (2, 'Bob', 22, 3.50),\n  (3, 'Carol', 20, 3.90);`,
      },
      {
        command: 'UPDATE',
        description: 'Modifies existing rows that match a condition.',
        example: `UPDATE students\nSET gpa = 3.95\nWHERE name = 'Alice';`,
      },
      { command: 'DELETE', description: 'Removes rows that match a condition.', example: `DELETE FROM students\nWHERE gpa < 2.0;` },
    ],
  },
  {
    id: 'queries',
    title: 'SELECT Queries',
    shortTitle: 'SELECT',
    icon: <Search size={15} />,
    color: 'cyan',
    gradient: 'from-cyan-400 to-sky-500',
    commands: [
      { command: 'SELECT', description: 'Retrieves specific columns from a table.', example: 'SELECT name, gpa FROM students;' },
      { command: 'SELECT *', description: 'Retrieves all columns from a table.', example: 'SELECT * FROM students;' },
      { command: 'SELECT DISTINCT', description: 'Returns only unique values, removing duplicates.', example: 'SELECT DISTINCT department FROM professors;' },
      { command: 'WHERE', description: 'Filters rows based on a condition.', example: `SELECT * FROM students\nWHERE age > 20;` },
      { command: 'AND / OR / NOT', description: 'Combines multiple conditions in a WHERE clause.', example: `SELECT * FROM students\nWHERE gpa > 3.5 AND age < 25;` },
      { command: 'IN', description: 'Matches any value in a list.', example: `SELECT * FROM students\nWHERE department IN ('CS', 'Math', 'Physics');` },
      { command: 'BETWEEN', description: 'Matches values within a range (inclusive).', example: `SELECT * FROM students\nWHERE gpa BETWEEN 3.0 AND 4.0;` },
      { command: 'LIKE', description: 'Pattern matching with % (any chars) and _ (single char).', example: `SELECT * FROM students\nWHERE name LIKE 'A%';` },
      { command: 'IS NULL / IS NOT NULL', description: 'Checks for NULL (missing) values.', example: `SELECT * FROM students\nWHERE email IS NULL;` },
      { command: 'ORDER BY', description: 'Sorts results in ascending (ASC) or descending (DESC) order.', example: `SELECT * FROM students\nORDER BY gpa DESC;` },
      { command: 'LIMIT', description: 'Restricts the number of rows returned.', example: `SELECT * FROM students\nORDER BY gpa DESC\nLIMIT 5;` },
      { command: 'AS (Alias)', description: 'Gives a temporary name to a column or table.', example: `SELECT name AS student_name, gpa AS score\nFROM students;` },
    ],
  },
  {
    id: 'aggregates',
    title: 'Aggregate Functions & Grouping',
    shortTitle: 'Aggregates',
    icon: <Sigma size={15} />,
    color: 'amber',
    gradient: 'from-amber-400 to-orange-500',
    commands: [
      { command: 'COUNT', description: 'Returns the number of rows.', example: 'SELECT COUNT(*) FROM students;' },
      { command: 'SUM', description: 'Returns the total of a numeric column.', example: 'SELECT SUM(credits) FROM courses;' },
      { command: 'AVG', description: 'Returns the average of a numeric column.', example: 'SELECT AVG(gpa) FROM students;' },
      { command: 'MIN / MAX', description: 'Returns the smallest or largest value.', example: 'SELECT MIN(gpa), MAX(gpa) FROM students;' },
      {
        command: 'GROUP BY',
        description: 'Groups rows sharing a value, often used with aggregate functions.',
        example: `SELECT department, AVG(gpa) AS avg_gpa\nFROM students\nGROUP BY department;`,
      },
      {
        command: 'HAVING',
        description: 'Filters groups after GROUP BY (like WHERE but for aggregates).',
        example: `SELECT department, COUNT(*) AS total\nFROM students\nGROUP BY department\nHAVING COUNT(*) > 10;`,
      },
    ],
  },
  {
    id: 'joins',
    title: 'Joins',
    shortTitle: 'Joins',
    icon: <Database size={15} />,
    color: 'blue',
    gradient: 'from-blue-400 to-indigo-500',
    commands: [
      {
        command: 'INNER JOIN',
        description: 'Returns only rows with matching values in both tables.',
        example: `SELECT s.name, c.title\nFROM students s\nINNER JOIN enrollments e ON s.id = e.student_id\nINNER JOIN courses c ON e.course_id = c.id;`,
      },
      {
        command: 'LEFT JOIN',
        description: 'Returns all rows from the left table and matching rows from the right.',
        example: `SELECT s.name, e.course_id\nFROM students s\nLEFT JOIN enrollments e ON s.id = e.student_id;`,
      },
      {
        command: 'RIGHT JOIN',
        description: 'Returns all rows from the right table and matching rows from the left.',
        example: `SELECT e.course_id, s.name\nFROM enrollments e\nRIGHT JOIN students s ON e.student_id = s.id;`,
      },
      {
        command: 'FULL OUTER JOIN',
        description: 'Returns all rows from both tables, with NULLs where there is no match.',
        example: `SELECT s.name, c.title\nFROM students s\nFULL OUTER JOIN enrollments e ON s.id = e.student_id;`,
      },
      {
        command: 'CROSS JOIN',
        description: 'Returns the cartesian product — every combination of rows.',
        example: `SELECT s.name, c.title\nFROM students s\nCROSS JOIN courses c;`,
      },
      {
        command: 'SELF JOIN',
        description: 'Joins a table with itself using aliases.',
        example: `SELECT a.name AS employee, b.name AS manager\nFROM employees a\nJOIN employees b ON a.manager_id = b.id;`,
      },
      {
        command: 'NATURAL JOIN',
        description: 'Automatically joins on columns with the same name in both tables.',
        example: `SELECT * FROM students\nNATURAL JOIN departments;`,
      },
    ],
  },
  {
    id: 'subqueries',
    title: 'Subqueries & Views',
    shortTitle: 'Subqueries',
    icon: <Terminal size={15} />,
    color: 'violet',
    gradient: 'from-violet-400 to-indigo-500',
    commands: [
      {
        command: 'Subquery in WHERE',
        description: 'Uses the result of an inner query as a filter.',
        example: `SELECT name FROM students\nWHERE gpa > (SELECT AVG(gpa) FROM students);`,
      },
      {
        command: 'Subquery with IN',
        description: 'Filters based on a list returned by a subquery.',
        example: `SELECT name FROM students\nWHERE id IN (\n  SELECT student_id FROM enrollments\n  WHERE course_id = 101\n);`,
      },
      {
        command: 'EXISTS',
        description: 'Returns TRUE if the subquery returns any rows.',
        example: `SELECT name FROM students s\nWHERE EXISTS (\n  SELECT 1 FROM enrollments e\n  WHERE e.student_id = s.id\n);`,
      },
      {
        command: 'CREATE VIEW',
        description: 'Creates a virtual table based on a SELECT query.',
        example: `CREATE VIEW honor_roll AS\nSELECT name, gpa FROM students\nWHERE gpa >= 3.5;`,
      },
      { command: 'DROP VIEW', description: 'Deletes a view.', example: 'DROP VIEW honor_roll;' },
    ],
  },
  {
    id: 'set-ops',
    title: 'Set Operations',
    shortTitle: 'Set Ops',
    icon: <Sigma size={15} />,
    color: 'rose',
    gradient: 'from-rose-400 to-pink-500',
    commands: [
      {
        command: 'UNION',
        description: 'Combines results of two queries, removing duplicates.',
        example: `SELECT name FROM students\nUNION\nSELECT name FROM professors;`,
      },
      {
        command: 'UNION ALL',
        description: 'Combines results of two queries, keeping duplicates.',
        example: `SELECT name FROM students\nUNION ALL\nSELECT name FROM professors;`,
      },
      {
        command: 'INTERSECT',
        description: 'Returns only rows present in both queries.',
        example: `SELECT course_id FROM fall_courses\nINTERSECT\nSELECT course_id FROM spring_courses;`,
      },
      {
        command: 'EXCEPT / MINUS',
        description: 'Returns rows from the first query that are not in the second.',
        example: `SELECT course_id FROM fall_courses\nEXCEPT\nSELECT course_id FROM spring_courses;`,
      },
    ],
  },
  {
    id: 'tcl',
    title: 'Transactions (TCL)',
    shortTitle: 'Transactions',
    icon: <Shield size={15} />,
    color: 'orange',
    gradient: 'from-orange-400 to-red-500',
    commands: [
      { command: 'BEGIN / START TRANSACTION', description: 'Starts a new transaction block.', example: 'START TRANSACTION;' },
      {
        command: 'COMMIT',
        description: 'Saves all changes made during the current transaction.',
        example: `START TRANSACTION;\nUPDATE accounts SET balance = balance - 500 WHERE id = 1;\nUPDATE accounts SET balance = balance + 500 WHERE id = 2;\nCOMMIT;`,
      },
      {
        command: 'ROLLBACK',
        description: 'Undoes all changes made during the current transaction.',
        example: `START TRANSACTION;\nDELETE FROM students WHERE gpa < 1.0;\nROLLBACK;  -- no rows are actually deleted`,
      },
      {
        command: 'SAVEPOINT',
        description: 'Sets a named point within a transaction to rollback to.',
        example: `SAVEPOINT before_delete;\nDELETE FROM students WHERE id = 5;\nROLLBACK TO before_delete;`,
      },
      {
        command: 'ROLLBACK TO SAVEPOINT',
        description: 'Rolls back to a named savepoint without canceling the whole transaction.',
        example: 'ROLLBACK TO SAVEPOINT before_delete;',
      },
      {
        command: 'RELEASE SAVEPOINT',
        description: 'Releases a previously created savepoint.',
        example: 'RELEASE SAVEPOINT before_delete;',
      },
    ],
  },
  {
    id: 'plsql',
    title: 'PL/SQL & Procedures',
    shortTitle: 'PL/SQL',
    icon: <Terminal size={15} />,
    color: 'amber',
    gradient: 'from-yellow-400 to-amber-500',
    commands: [
      {
        command: 'CREATE PROCEDURE',
        description: 'Creates a stored procedure — a reusable block of SQL statements.',
        example: `CREATE PROCEDURE raise_gpa(IN sid INT, IN amount DECIMAL)\nBEGIN\n  UPDATE students SET gpa = gpa + amount WHERE id = sid;\nEND;`,
      },
      { command: 'CALL', description: 'Executes a stored procedure.', example: 'CALL raise_gpa(1, 0.10);' },
      { command: 'DROP PROCEDURE', description: 'Deletes a stored procedure.', example: 'DROP PROCEDURE raise_gpa;' },
      { command: 'DROP PROCEDURE IF EXISTS', description: 'Deletes a stored procedure only if it exists.', example: 'DROP PROCEDURE IF EXISTS raise_gpa;' },
      { command: 'SHOW PROCEDURE STATUS', description: 'Lists stored procedures visible in the current context.', example: 'SHOW PROCEDURE STATUS;' },
      { command: 'SHOW CREATE PROCEDURE', description: 'Shows the CREATE statement for a procedure.', example: 'SHOW CREATE PROCEDURE raise_gpa;' },
      {
        command: 'CREATE FUNCTION',
        description: 'Creates a function that returns a value.',
        example: `CREATE FUNCTION get_gpa(sid INT) RETURNS DECIMAL\nBEGIN\n  DECLARE result DECIMAL(3,2);\n  SELECT gpa INTO result FROM students WHERE id = sid;\n  RETURN result;\nEND;`,
      },
      {
        command: 'CREATE TRIGGER',
        description: 'Automatically executes code when an INSERT, UPDATE, or DELETE occurs.',
        example: `CREATE TRIGGER log_update\nAFTER UPDATE ON students\nFOR EACH ROW\nBEGIN\n  INSERT INTO audit_log (action, student_id, changed_at)\n  VALUES ('UPDATE', NEW.id, NOW());\nEND;`,
      },
      { command: 'DROP TRIGGER', description: 'Deletes an existing trigger.', example: 'DROP TRIGGER log_update;' },
      { command: 'SHOW TRIGGERS', description: 'Lists triggers in the active database.', example: 'SHOW TRIGGERS;' },
      { command: 'SHOW CREATE TRIGGER', description: 'Shows the CREATE statement for a trigger.', example: 'SHOW CREATE TRIGGER log_update;' },
      {
        command: 'DECLARE / SET',
        description: 'Declares and assigns variables inside a PL/SQL block.',
        example: `DECLARE @total INT;\nSET @total = (SELECT COUNT(*) FROM students);`,
      },
      {
        command: 'IF ... ELSE',
        description: 'Conditional logic inside stored procedures.',
        example: `IF @total > 100 THEN\n  SELECT 'Large class';\nELSE\n  SELECT 'Small class';\nEND IF;`,
      },
      {
        command: 'CURSOR',
        description: 'Iterates over rows one by one in a procedure.',
        example: `DECLARE cur CURSOR FOR SELECT name FROM students;\nOPEN cur;\nFETCH cur INTO @sname;\nCLOSE cur;`,
      },
    ],
  },
  {
    id: 'dcl',
    title: 'Data Control Language (DCL)',
    shortTitle: 'DCL',
    icon: <Shield size={15} />,
    color: 'blue',
    gradient: 'from-blue-400 to-sky-500',
    commands: [
      { command: 'CREATE USER', description: 'Creates a new database user account.', example: "CREATE USER 'analyst'@'localhost' IDENTIFIED BY 'pass123';" },
      { command: 'CREATE USER IF NOT EXISTS', description: 'Creates a user only if it does not already exist.', example: "CREATE USER IF NOT EXISTS 'analyst'@'localhost' IDENTIFIED BY 'pass123';" },
      { command: 'DROP USER', description: 'Deletes a database user account.', example: "DROP USER 'analyst'@'localhost';" },
      { command: 'DROP USER IF EXISTS', description: 'Deletes a user only if it exists.', example: "DROP USER IF EXISTS 'analyst'@'localhost';" },
      { command: 'ALTER USER ... IDENTIFIED BY', description: 'Changes a user password.', example: "ALTER USER 'analyst'@'localhost' IDENTIFIED BY 'newpass';" },
      { command: 'RENAME USER', description: 'Renames a user account (optionally with host change).', example: "RENAME USER 'analyst'@'localhost' TO 'reporter'@'localhost';" },
      { command: 'SET PASSWORD FOR', description: 'Sets password for an existing user.', example: "SET PASSWORD FOR 'reporter'@'localhost' = 'secure123';" },
      { command: 'GRANT', description: 'Gives privileges to a user or role.', example: "GRANT SELECT, INSERT ON students TO 'app_user';" },
      { command: 'GRANT ... WITH GRANT OPTION', description: 'Allows a user to grant the same privileges to others.', example: "GRANT SELECT ON main.students TO 'reporter'@'localhost' WITH GRANT OPTION;" },
      { command: 'REVOKE', description: 'Removes previously granted privileges.', example: "REVOKE INSERT ON students FROM 'app_user';" },
      { command: 'SHOW GRANTS', description: 'Displays grants for the current user.', example: 'SHOW GRANTS;' },
      { command: 'SHOW GRANTS FOR', description: 'Displays grants for a specific user.', example: "SHOW GRANTS FOR 'reporter'@'localhost';" },
      { command: 'SHOW USERS', description: 'Lists available users in the SQL runtime.', example: 'SHOW USERS;' },
      { command: 'SET USER', description: 'Switches the active SQL session user.', example: "SET USER 'reporter'@'localhost';" },
      { command: 'CHANGE USER', description: 'Alternative syntax to switch active SQL user.', example: "CHANGE USER 'reporter'@'localhost';" },
      { command: 'FLUSH PRIVILEGES', description: 'Applies privilege changes in the virtual SQL runtime.', example: 'FLUSH PRIVILEGES;' },
    ],
  },
  {
    id: 'metadata',
    title: 'Metadata & Introspection',
    shortTitle: 'Metadata',
    icon: <BookOpen size={15} />,
    color: 'sky',
    gradient: 'from-cyan-400 to-blue-500',
    commands: [
      { command: 'SHOW DATABASES', description: 'Lists databases visible to the active user.', example: 'SHOW DATABASES;' },
      { command: 'SHOW CREATE DATABASE', description: 'Shows the CREATE statement for a database.', example: 'SHOW CREATE DATABASE main;' },
      { command: 'SHOW TABLES', description: 'Lists tables in the active database.', example: 'SHOW TABLES;' },
      { command: 'SHOW TABLES FROM db', description: 'Lists tables in a specific database.', example: 'SHOW TABLES FROM main;' },
      { command: 'SHOW FULL TABLES', description: 'Shows table list with extended table metadata.', example: 'SHOW FULL TABLES;' },
      { command: 'SHOW COLUMNS FROM', description: 'Lists column metadata for a table.', example: 'SHOW COLUMNS FROM students;' },
      { command: 'SHOW FIELDS FROM', description: 'Alias of SHOW COLUMNS.', example: 'SHOW FIELDS FROM students;' },
      { command: 'DESCRIBE / DESC', description: 'Displays column definitions for a table.', example: 'DESCRIBE students;' },
      { command: 'SHOW CREATE TABLE', description: 'Shows CREATE TABLE statement text.', example: 'SHOW CREATE TABLE students;' },
      { command: 'SHOW INDEX / SHOW KEYS', description: 'Shows indexes defined on a table.', example: 'SHOW INDEX FROM students;' },
      { command: 'SHOW TABLE STATUS', description: 'Shows high-level table status information.', example: 'SHOW TABLE STATUS;' },
      { command: 'SHOW PROCESSLIST', description: 'Shows current process/session list.', example: 'SHOW PROCESSLIST;' },
      { command: 'SHOW VARIABLES', description: 'Displays runtime/session variables.', example: 'SHOW VARIABLES;' },
      { command: 'SHOW STATUS', description: 'Displays runtime/session status counters.', example: 'SHOW STATUS;' },
      { command: 'SHOW WARNINGS / SHOW ERRORS', description: 'Displays warning or error diagnostics.', example: 'SHOW WARNINGS;' },
      { command: 'SHOW ENGINES', description: 'Lists available storage engines.', example: 'SHOW ENGINES;' },
      { command: 'EXPLAIN', description: 'Shows query execution plan.', example: 'EXPLAIN SELECT * FROM students WHERE gpa > 3.5;' },
    ],
  },
  {
    id: 'maintenance',
    title: 'Maintenance & Session Commands',
    shortTitle: 'Maintenance',
    icon: <RefreshCw size={15} />,
    color: 'orange',
    gradient: 'from-orange-400 to-amber-500',
    commands: [
      { command: 'SET FOREIGN_KEY_CHECKS', description: 'Enables or disables foreign key checks for the session.', example: 'SET FOREIGN_KEY_CHECKS = 0;' },
      { command: 'SET NAMES / SET CHARACTER SET', description: 'Adjusts connection character settings.', example: 'SET NAMES utf8mb4;' },
      { command: 'LOCK TABLES', description: 'Requests explicit table locks (simulated in this runtime).', example: 'LOCK TABLES students READ;' },
      { command: 'UNLOCK TABLES', description: 'Releases explicit table locks.', example: 'UNLOCK TABLES;' },
      { command: 'ANALYZE TABLE', description: 'Runs table analysis/statistics update.', example: 'ANALYZE TABLE students;' },
      { command: 'OPTIMIZE TABLE', description: 'Runs table optimization routine.', example: 'OPTIMIZE TABLE students;' },
      { command: 'CHECK TABLE', description: 'Checks table integrity/state.', example: 'CHECK TABLE students;' },
      { command: 'REPAIR TABLE', description: 'Attempts table repair in compatible mode.', example: 'REPAIR TABLE students;' },
      { command: 'RESET / FLUSH / KILL / PURGE', description: 'Administrative server commands supported as safe stubs in this runtime.', example: 'RESET MASTER;' },
    ],
  },
  {
    id: 'algebra',
    title: 'Relational Algebra',
    shortTitle: 'Algebra',
    icon: <Sigma size={15} />,
    color: 'violet',
    gradient: 'from-violet-400 to-purple-500',
    commands: [
      { command: 'σ (Selection)', description: 'Selects rows that satisfy a condition. Like WHERE in SQL.', example: 'σ[age > 20](Students)' },
      { command: 'π (Projection)', description: 'Selects specific columns. Like SELECT col1, col2 in SQL.', example: 'π[name, gpa](Students)' },
      { command: '∪ (Union)', description: 'Combines rows from two compatible relations, removing duplicates.', example: 'CS_Students ∪ Math_Students' },
      { command: '− (Difference)', description: 'Returns rows in the first relation that are not in the second.', example: 'All_Students − Graduated' },
      { command: '× (Cartesian Product)', description: 'Combines every row of one relation with every row of another.', example: 'Students × Courses' },
      { command: '⋈ (Natural Join)', description: 'Joins on common attribute names, keeping matches only.', example: 'Students ⋈ Enrollments' },
      { command: '⋈[θ] (Theta Join)', description: 'Joins two relations on a specified condition.', example: 'Students ⋈[Students.id = Enrollments.sid] Enrollments' },
      { command: 'ρ (Rename)', description: 'Renames a relation or its attributes.', example: 'ρ[S](Students)' },
      { command: '∩ (Intersection)', description: 'Returns rows present in both relations.', example: 'CS_Students ∩ Dean_List' },
      { command: '÷ (Division)', description: 'Returns rows related to all rows in the divisor.', example: 'Enrollments ÷ Required_Courses' },
      { command: 'γ (Aggregation)', description: 'Groups and aggregates values (SUM, COUNT, AVG, etc.).', example: 'γ[department; AVG(gpa)](Students)' },
      { command: 'τ (Sort)', description: 'Orders the result by given attributes.', example: 'τ[gpa DESC](Students)' },
    ],
  },
  {
    id: 'normalization',
    title: 'Normalization',
    shortTitle: 'Normal Forms',
    icon: <RefreshCw size={15} />,
    color: 'lime',
    gradient: 'from-lime-400 to-green-500',
    commands: [
      { command: '1NF — First Normal Form', description: 'Every cell contains a single atomic value. No repeating groups.', example: '❌ courses: "Math, CS"  →  ✅ one row per course' },
      {
        command: '2NF — Second Normal Form',
        description: '1NF + no partial dependency (non-key attribute depends on part of a composite key).',
        example: '(student_id, course_id) → grade ✅\n(student_id, course_id) → student_name ❌ (depends only on student_id)',
      },
      {
        command: '3NF — Third Normal Form',
        description: '2NF + no transitive dependency (non-key → non-key).',
        example: 'student_id → dept_id → dept_name ❌\nSplit into Students(student_id, dept_id) and Departments(dept_id, dept_name)',
      },
      { command: 'BCNF — Boyce-Codd Normal Form', description: 'Every determinant is a candidate key. Stricter than 3NF.', example: 'If A → B, then A must be a superkey.' },
      { command: 'Functional Dependency (FD)', description: 'A → B means: the value of A uniquely determines the value of B.', example: 'student_id → name, age, gpa' },
      { command: 'Candidate Key', description: 'A minimal set of attributes that uniquely identifies every row.', example: '{student_id} is a candidate key if it determines all other attributes.' },
      { command: 'Closure (A⁺)', description: 'The set of all attributes functionally determined by A under given FDs.', example: 'Given A → B, B → C: A⁺ = {A, B, C}' },
    ],
  },
];

/* ──────────────────── Color Map ──────────────────── */

const COLOR_MAP: Record<string, { pill: string; pillBg: string; border: string; badge: string; glow: string; codeText: string }> = {
  sky:    { pill: 'text-sky-400',    pillBg: 'bg-sky-500/15 border-sky-500/25',    border: 'border-sky-500/20',    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/20',    glow: 'shadow-sky-500/10',    codeText: 'text-sky-300' },
  violet: { pill: 'text-violet-400', pillBg: 'bg-violet-500/15 border-violet-500/25', border: 'border-violet-500/20', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/20', glow: 'shadow-violet-500/10', codeText: 'text-violet-300' },
  emerald:{ pill: 'text-emerald-400',pillBg: 'bg-emerald-500/15 border-emerald-500/25', border: 'border-emerald-500/20', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20', glow: 'shadow-emerald-500/10', codeText: 'text-emerald-300' },
  cyan:   { pill: 'text-cyan-400',   pillBg: 'bg-cyan-500/15 border-cyan-500/25',   border: 'border-cyan-500/20',   badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',   glow: 'shadow-cyan-500/10',   codeText: 'text-cyan-300' },
  amber:  { pill: 'text-amber-400',  pillBg: 'bg-amber-500/15 border-amber-500/25',  border: 'border-amber-500/20',  badge: 'bg-amber-500/15 text-amber-300 border-amber-500/20',  glow: 'shadow-amber-500/10',  codeText: 'text-amber-300' },
  blue:   { pill: 'text-blue-400',   pillBg: 'bg-blue-500/15 border-blue-500/25',   border: 'border-blue-500/20',   badge: 'bg-blue-500/15 text-blue-300 border-blue-500/20',   glow: 'shadow-blue-500/10',   codeText: 'text-blue-300' },
  rose:   { pill: 'text-rose-400',   pillBg: 'bg-rose-500/15 border-rose-500/25',   border: 'border-rose-500/20',   badge: 'bg-rose-500/15 text-rose-300 border-rose-500/20',   glow: 'shadow-rose-500/10',   codeText: 'text-rose-300' },
  orange: { pill: 'text-orange-400', pillBg: 'bg-orange-500/15 border-orange-500/25', border: 'border-orange-500/20', badge: 'bg-orange-500/15 text-orange-300 border-orange-500/20', glow: 'shadow-orange-500/10', codeText: 'text-orange-300' },
  lime:   { pill: 'text-lime-400',   pillBg: 'bg-lime-500/15 border-lime-500/25',   border: 'border-lime-500/20',   badge: 'bg-lime-500/15 text-lime-300 border-lime-500/20',   glow: 'shadow-lime-500/10',   codeText: 'text-lime-300' },
};

const TOTAL_COMMANDS = SECTIONS.reduce((sum, s) => sum + s.commands.length, 0);
const ALL_COMMANDS: IndexedCommand[] = SECTIONS.flatMap((section) =>
  section.commands.map((command) => ({ section, command }))
);

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const tokenized = (value: string) => normalize(value).split(/\s+/).filter(Boolean);

const hasOrderedChars = (text: string, queryText: string) => {
  let fromIndex = 0;
  for (const char of queryText) {
    const matchIndex = text.indexOf(char, fromIndex);
    if (matchIndex === -1) return false;
    fromIndex = matchIndex + 1;
  }
  return true;
};

const scoreCommand = (queryText: string, command: CommandEntry, section: Section) => {
  if (!queryText) return 0;

  const commandText = normalize(command.command);
  const descriptionText = normalize(command.description);
  const exampleText = normalize(command.example);
  const sectionText = normalize(`${section.title} ${section.shortTitle}`);
  const mergedText = `${commandText} ${descriptionText} ${exampleText} ${sectionText}`;

  let score = 0;

  if (commandText === queryText) score += 140;
  if (commandText.startsWith(queryText)) score += 92;
  if (commandText.includes(queryText)) score += 60;
  if (descriptionText.includes(queryText)) score += 34;
  if (exampleText.includes(queryText)) score += 18;
  if (sectionText.includes(queryText)) score += 24;

  const tokens = tokenized(queryText);
  let matchedTokens = 0;
  for (const token of tokens) {
    if (commandText.includes(token)) {
      score += 24;
      matchedTokens += 1;
      continue;
    }
    if (descriptionText.includes(token)) {
      score += 14;
      matchedTokens += 1;
      continue;
    }
    if (exampleText.includes(token)) {
      score += 8;
      matchedTokens += 1;
      continue;
    }
    if (sectionText.includes(token)) {
      score += 10;
      matchedTokens += 1;
    }
  }

  if (tokens.length > 0 && matchedTokens === tokens.length) {
    score += 18;
  }

  if (queryText.length >= 3 && hasOrderedChars(commandText, queryText)) {
    score += 15;
  }

  if (!mergedText.includes(queryText) && matchedTokens === 0 && score < 20) {
    return 0;
  }

  const lengthPenalty = Math.max(0, commandText.length - queryText.length) * 0.18;
  return score - lengthPenalty;
};

/* ──────────────────── Copy Button ──────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="absolute right-2.5 top-2.5 rounded-md border border-white/[0.08] bg-white/[0.06] p-1.5 opacity-0 backdrop-blur transition-all hover:bg-white/[0.12] group-hover/code:opacity-100"
      title="Copy"
    >
      {copied
        ? <Check size={11} className="text-emerald-400" />
        : <Copy size={11} className="text-white/50" />
      }
    </button>
  );
}

/* ──────────────────── Command Card ──────────────────── */

function CommandCard({ cmd, section }: { cmd: CommandEntry; section: Section }) {
  const colors = COLOR_MAP[section.color] ?? COLOR_MAP.sky;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`group relative overflow-hidden rounded-xl border border-border/60 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg ${colors.glow}`}
    >
      {/* Gradient top line */}
      <div className={`h-[2px] w-full bg-gradient-to-r ${section.gradient} opacity-70`} />

      <div className="p-4">
        {/* Command badge + description */}
        <div className="mb-3 space-y-2">
          <code className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold tracking-wide ${colors.badge}`}>
            {cmd.command}
          </code>
          <p className="text-[13px] leading-relaxed text-muted-foreground">{cmd.description}</p>
        </div>

        {/* Code block */}
        <div className="group/code relative">
          <pre className="overflow-x-auto rounded-lg border border-white/[0.07] bg-[#0d0f1a] px-4 py-3 font-mono text-xs leading-relaxed">
            <code className={`${colors.codeText}`}>{cmd.example}</code>
          </pre>
          <CopyButton text={cmd.example} />
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────── Page ──────────────────── */

export default function LearnPage() {
  const [activeTab, setActiveTab] = useState(SECTIONS[0].id);
  const [search, setSearch] = useState('');

  const query = normalize(search);
  const activeSection = SECTIONS.find((s) => s.id === activeTab) ?? SECTIONS[0];
  const colors = COLOR_MAP[activeSection.color] ?? COLOR_MAP.sky;

  const searchHits = useMemo(() => {
    if (!query) return [] as SearchHit[];

    return ALL_COMMANDS.map(({ section, command }) => ({
      section,
      command,
      score: scoreCommand(query, command, section),
    }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const commandLengthDelta = a.command.command.length - b.command.command.length;
        if (commandLengthDelta !== 0) return commandLengthDelta;
        return a.command.command.localeCompare(b.command.command);
      });
  }, [query]);

  const filteredCommands = useMemo(() => {
    if (!query) return activeSection.commands;
    return searchHits.map((hit) => hit.command);
  }, [activeSection.commands, query, searchHits]);

  const matchingTabIds = useMemo(() => {
    if (!query) return null;
    return new Set(searchHits.map((hit) => hit.section.id));
  }, [query, searchHits]);

  const commandSectionMap = useMemo(() => {
    const map = new Map<CommandEntry, Section>();
    for (const { section, command } of ALL_COMMANDS) {
      map.set(command, section);
    }
    return map;
  }, []);

  const totalInScope = matchingTabIds
    ? searchHits.length
    : TOTAL_COMMANDS;

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.05),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.06),transparent_45%)]" />

      {/* Top panel */}
      <div className="relative shrink-0 border-b border-border/50 bg-card/60 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 pb-0 pt-5 sm:px-6">

          {/* Header row */}
          <div className="mb-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
                <Sparkles size={11} />
                SQL Reference Atlas
              </div>

              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                Commands & Syntax
                <span className="block bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  beautifully organized
                </span>
              </h1>

              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { icon: <Layers size={12} />, label: `${SECTIONS.length} categories` },
                  { icon: <BookOpen size={12} />, label: `${TOTAL_COMMANDS} commands` },
                  { icon: <Search size={12} />, label: `${totalInScope} in scope` },
                ].map(({ icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                    {icon} {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/40 p-2 shadow-[0_14px_35px_-22px_rgba(2,6,23,0.55)]">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                  Smart Search
                </span>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  All Categories
                </span>
              </div>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Try: left join null values, normalize 3nf, create trigger..."
                className="h-12 w-full rounded-xl border border-border/70 bg-background/95 py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/55 outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
              </div>
            </div>
          </div>

          {/* Category tabs */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3 scrollbar-hide">
            {SECTIONS.map((section) => {
              const c = COLOR_MAP[section.color] ?? COLOR_MAP.sky;
              const isActive = section.id === activeTab;
              const hasMatch = matchingTabIds === null || matchingTabIds.has(section.id);

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveTab(section.id)}
                  className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? `${c.pillBg} ${c.pill}`
                      : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground'
                  } ${!hasMatch && !isActive ? 'opacity-30' : ''}`}
                >
                  <span className={isActive ? c.pill : ''}>{section.icon}</span>
                  {section.shortTitle}
                  {isActive && !query && (
                    <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${c.badge} border`}>
                      {section.commands.length}
                    </span>
                  )}
                  {query && hasMatch && (
                    <span className="ml-0.5 rounded-full border border-white/10 bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-zinc-200">
                      {searchHits.filter((hit) => hit.section.id === section.id).length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">

          {/* Section header */}
          <div className={`mb-5 flex items-center justify-between rounded-xl border ${colors.border} bg-card/80 px-4 py-3 backdrop-blur`}>
            <div className="flex items-center gap-3">
              <div className={`rounded-lg bg-gradient-to-br ${activeSection.gradient} p-2 text-black shadow-md`}>
                {activeSection.icon}
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight">{query ? 'Global Search Results' : activeSection.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
                  {query && ` matching "${search.trim()}"`}
                </p>
              </div>
            </div>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${query ? 'border-primary/25 bg-primary/10 text-primary' : colors.badge}`}>
              {query ? 'Ranked' : activeSection.shortTitle}
            </span>
          </div>

          {/* Cards */}
          <AnimatePresence mode="wait">
            {filteredCommands.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-border/60 bg-card py-20 text-center"
              >
                <Search size={28} className="mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No commands match &ldquo;{search}&rdquo;</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Try broader terms, synonyms, or SQL intent phrases</p>
                <button
                  onClick={() => setSearch('')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground transition-colors"
                >
                  <X size={12} /> Clear search
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={activeTab + query}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid gap-3.5 lg:grid-cols-2"
              >
                {filteredCommands.map((cmd) => (
                  <CommandCard
                    key={`${(commandSectionMap.get(cmd) ?? activeSection).id}-${cmd.command}`}
                    cmd={cmd}
                    section={commandSectionMap.get(cmd) ?? activeSection}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
