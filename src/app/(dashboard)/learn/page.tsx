'use client';

import { useState, useMemo } from 'react';
import {
  BookOpen, Database, Terminal, Sigma, RefreshCw, Shield,
  Search, Copy, Check,
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
  commands: CommandEntry[];
}

/* ──────────────────── Data ──────────────────── */

const SECTIONS: Section[] = [
  {
    id: 'ddl',
    title: 'Data Definition Language (DDL)',
    shortTitle: 'DDL',
    icon: <Database size={16} />,
    color: 'blue',
    commands: [
      {
        command: 'CREATE DATABASE',
        description: 'Creates a new database.',
        example: 'CREATE DATABASE school;',
      },
      {
        command: 'DROP DATABASE',
        description: 'Deletes an entire database and all its tables.',
        example: 'DROP DATABASE school;',
      },
      {
        command: 'CREATE TABLE',
        description: 'Creates a new table with defined columns and data types.',
        example:
`CREATE TABLE students (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  age INT,
  gpa DECIMAL(3,2)
);`,
      },
      {
        command: 'ALTER TABLE — ADD',
        description: 'Adds a new column to an existing table.',
        example: 'ALTER TABLE students ADD email VARCHAR(255);',
      },
      {
        command: 'ALTER TABLE — MODIFY',
        description: 'Changes the data type or constraints of an existing column.',
        example: 'ALTER TABLE students MODIFY name VARCHAR(200) NOT NULL;',
      },
      {
        command: 'ALTER TABLE — DROP COLUMN',
        description: 'Removes a column from a table.',
        example: 'ALTER TABLE students DROP COLUMN age;',
      },
      {
        command: 'DROP TABLE',
        description: 'Deletes a table and all its data permanently.',
        example: 'DROP TABLE students;',
      },
      {
        command: 'TRUNCATE TABLE',
        description: 'Removes all rows from a table but keeps the table structure.',
        example: 'TRUNCATE TABLE students;',
      },
      {
        command: 'RENAME TABLE',
        description: 'Renames an existing table.',
        example: 'ALTER TABLE students RENAME TO learners;',
      },
    ],
  },
  {
    id: 'constraints',
    title: 'Constraints',
    shortTitle: 'Constraints',
    icon: <Shield size={16} />,
    color: 'violet',
    commands: [
      {
        command: 'PRIMARY KEY',
        description: 'Uniquely identifies each row. Cannot be NULL or duplicate.',
        example:
`CREATE TABLE courses (
  id INT PRIMARY KEY,
  title VARCHAR(100)
);`,
      },
      {
        command: 'FOREIGN KEY',
        description: 'Links a column to the primary key of another table.',
        example:
`CREATE TABLE enrollments (
  student_id INT,
  course_id INT,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);`,
      },
      {
        command: 'NOT NULL',
        description: 'Ensures a column cannot contain NULL values.',
        example: 'name VARCHAR(100) NOT NULL',
      },
      {
        command: 'UNIQUE',
        description: 'Ensures all values in a column are distinct.',
        example: 'email VARCHAR(255) UNIQUE',
      },
      {
        command: 'CHECK',
        description: 'Ensures column values satisfy a given condition.',
        example: 'age INT CHECK (age >= 18)',
      },
      {
        command: 'DEFAULT',
        description: 'Sets a default value when no value is provided.',
        example: 'status VARCHAR(20) DEFAULT \'active\'',
      },
      {
        command: 'AUTO_INCREMENT',
        description: 'Automatically generates a unique incrementing number for new rows.',
        example: 'id INT PRIMARY KEY AUTO_INCREMENT',
      },
    ],
  },
  {
    id: 'dml',
    title: 'Data Manipulation Language (DML)',
    shortTitle: 'DML',
    icon: <Terminal size={16} />,
    color: 'emerald',
    commands: [
      {
        command: 'INSERT INTO',
        description: 'Adds a new row to a table.',
        example:
`INSERT INTO students (id, name, age, gpa)
VALUES (1, 'Alice', 21, 3.80);`,
      },
      {
        command: 'INSERT — Multiple Rows',
        description: 'Inserts several rows in a single statement.',
        example:
`INSERT INTO students (id, name, age, gpa) VALUES
  (2, 'Bob', 22, 3.50),
  (3, 'Carol', 20, 3.90);`,
      },
      {
        command: 'UPDATE',
        description: 'Modifies existing rows that match a condition.',
        example:
`UPDATE students
SET gpa = 3.95
WHERE name = 'Alice';`,
      },
      {
        command: 'DELETE',
        description: 'Removes rows that match a condition.',
        example:
`DELETE FROM students
WHERE gpa < 2.0;`,
      },
    ],
  },
  {
    id: 'queries',
    title: 'SELECT Queries',
    shortTitle: 'SELECT',
    icon: <Search size={16} />,
    color: 'emerald',
    commands: [
      {
        command: 'SELECT',
        description: 'Retrieves specific columns from a table.',
        example: 'SELECT name, gpa FROM students;',
      },
      {
        command: 'SELECT *',
        description: 'Retrieves all columns from a table.',
        example: 'SELECT * FROM students;',
      },
      {
        command: 'SELECT DISTINCT',
        description: 'Returns only unique values, removing duplicates.',
        example: 'SELECT DISTINCT department FROM professors;',
      },
      {
        command: 'WHERE',
        description: 'Filters rows based on a condition.',
        example:
`SELECT * FROM students
WHERE age > 20;`,
      },
      {
        command: 'AND / OR / NOT',
        description: 'Combines multiple conditions in a WHERE clause.',
        example:
`SELECT * FROM students
WHERE gpa > 3.5 AND age < 25;`,
      },
      {
        command: 'IN',
        description: 'Matches any value in a list.',
        example:
`SELECT * FROM students
WHERE department IN ('CS', 'Math', 'Physics');`,
      },
      {
        command: 'BETWEEN',
        description: 'Matches values within a range (inclusive).',
        example:
`SELECT * FROM students
WHERE gpa BETWEEN 3.0 AND 4.0;`,
      },
      {
        command: 'LIKE',
        description: 'Pattern matching with % (any chars) and _ (single char).',
        example:
`SELECT * FROM students
WHERE name LIKE 'A%';`,
      },
      {
        command: 'IS NULL / IS NOT NULL',
        description: 'Checks for NULL (missing) values.',
        example:
`SELECT * FROM students
WHERE email IS NULL;`,
      },
      {
        command: 'ORDER BY',
        description: 'Sorts results in ascending (ASC) or descending (DESC) order.',
        example:
`SELECT * FROM students
ORDER BY gpa DESC;`,
      },
      {
        command: 'LIMIT',
        description: 'Restricts the number of rows returned.',
        example:
`SELECT * FROM students
ORDER BY gpa DESC
LIMIT 5;`,
      },
      {
        command: 'AS (Alias)',
        description: 'Gives a temporary name to a column or table.',
        example:
`SELECT name AS student_name, gpa AS score
FROM students;`,
      },
    ],
  },
  {
    id: 'aggregates',
    title: 'Aggregate Functions & Grouping',
    shortTitle: 'Aggregates',
    icon: <Sigma size={16} />,
    color: 'amber',
    commands: [
      {
        command: 'COUNT',
        description: 'Returns the number of rows.',
        example: 'SELECT COUNT(*) FROM students;',
      },
      {
        command: 'SUM',
        description: 'Returns the total of a numeric column.',
        example: 'SELECT SUM(credits) FROM courses;',
      },
      {
        command: 'AVG',
        description: 'Returns the average of a numeric column.',
        example: 'SELECT AVG(gpa) FROM students;',
      },
      {
        command: 'MIN / MAX',
        description: 'Returns the smallest or largest value.',
        example: 'SELECT MIN(gpa), MAX(gpa) FROM students;',
      },
      {
        command: 'GROUP BY',
        description: 'Groups rows sharing a value, often used with aggregate functions.',
        example:
`SELECT department, AVG(gpa) AS avg_gpa
FROM students
GROUP BY department;`,
      },
      {
        command: 'HAVING',
        description: 'Filters groups after GROUP BY (like WHERE but for aggregates).',
        example:
`SELECT department, COUNT(*) AS total
FROM students
GROUP BY department
HAVING COUNT(*) > 10;`,
      },
    ],
  },
  {
    id: 'joins',
    title: 'Joins',
    shortTitle: 'Joins',
    icon: <Database size={16} />,
    color: 'blue',
    commands: [
      {
        command: 'INNER JOIN',
        description: 'Returns only rows with matching values in both tables.',
        example:
`SELECT s.name, c.title
FROM students s
INNER JOIN enrollments e ON s.id = e.student_id
INNER JOIN courses c ON e.course_id = c.id;`,
      },
      {
        command: 'LEFT JOIN',
        description: 'Returns all rows from the left table and matching rows from the right.',
        example:
`SELECT s.name, e.course_id
FROM students s
LEFT JOIN enrollments e ON s.id = e.student_id;`,
      },
      {
        command: 'RIGHT JOIN',
        description: 'Returns all rows from the right table and matching rows from the left.',
        example:
`SELECT e.course_id, s.name
FROM enrollments e
RIGHT JOIN students s ON e.student_id = s.id;`,
      },
      {
        command: 'FULL OUTER JOIN',
        description: 'Returns all rows from both tables, with NULLs where there is no match.',
        example:
`SELECT s.name, c.title
FROM students s
FULL OUTER JOIN enrollments e ON s.id = e.student_id;`,
      },
      {
        command: 'CROSS JOIN',
        description: 'Returns the cartesian product — every combination of rows.',
        example:
`SELECT s.name, c.title
FROM students s
CROSS JOIN courses c;`,
      },
      {
        command: 'SELF JOIN',
        description: 'Joins a table with itself using aliases.',
        example:
`SELECT a.name AS employee, b.name AS manager
FROM employees a
JOIN employees b ON a.manager_id = b.id;`,
      },
      {
        command: 'NATURAL JOIN',
        description: 'Automatically joins on columns with the same name in both tables.',
        example:
`SELECT * FROM students
NATURAL JOIN departments;`,
      },
    ],
  },
  {
    id: 'subqueries',
    title: 'Subqueries & Views',
    shortTitle: 'Subqueries',
    icon: <Terminal size={16} />,
    color: 'violet',
    commands: [
      {
        command: 'Subquery in WHERE',
        description: 'Uses the result of an inner query as a filter.',
        example:
`SELECT name FROM students
WHERE gpa > (SELECT AVG(gpa) FROM students);`,
      },
      {
        command: 'Subquery with IN',
        description: 'Filters based on a list returned by a subquery.',
        example:
`SELECT name FROM students
WHERE id IN (
  SELECT student_id FROM enrollments
  WHERE course_id = 101
);`,
      },
      {
        command: 'EXISTS',
        description: 'Returns TRUE if the subquery returns any rows.',
        example:
`SELECT name FROM students s
WHERE EXISTS (
  SELECT 1 FROM enrollments e
  WHERE e.student_id = s.id
);`,
      },
      {
        command: 'CREATE VIEW',
        description: 'Creates a virtual table based on a SELECT query.',
        example:
`CREATE VIEW honor_roll AS
SELECT name, gpa FROM students
WHERE gpa >= 3.5;`,
      },
      {
        command: 'DROP VIEW',
        description: 'Deletes a view.',
        example: 'DROP VIEW honor_roll;',
      },
    ],
  },
  {
    id: 'set-ops',
    title: 'Set Operations',
    shortTitle: 'Set Ops',
    icon: <Sigma size={16} />,
    color: 'rose',
    commands: [
      {
        command: 'UNION',
        description: 'Combines results of two queries, removing duplicates.',
        example:
`SELECT name FROM students
UNION
SELECT name FROM professors;`,
      },
      {
        command: 'UNION ALL',
        description: 'Combines results of two queries, keeping duplicates.',
        example:
`SELECT name FROM students
UNION ALL
SELECT name FROM professors;`,
      },
      {
        command: 'INTERSECT',
        description: 'Returns only rows present in both queries.',
        example:
`SELECT course_id FROM fall_courses
INTERSECT
SELECT course_id FROM spring_courses;`,
      },
      {
        command: 'EXCEPT / MINUS',
        description: 'Returns rows from the first query that are not in the second.',
        example:
`SELECT course_id FROM fall_courses
EXCEPT
SELECT course_id FROM spring_courses;`,
      },
    ],
  },
  {
    id: 'tcl',
    title: 'Transactions (TCL)',
    shortTitle: 'Transactions',
    icon: <Shield size={16} />,
    color: 'rose',
    commands: [
      {
        command: 'BEGIN / START TRANSACTION',
        description: 'Starts a new transaction block.',
        example: 'START TRANSACTION;',
      },
      {
        command: 'COMMIT',
        description: 'Saves all changes made during the current transaction.',
        example:
`START TRANSACTION;
UPDATE accounts SET balance = balance - 500 WHERE id = 1;
UPDATE accounts SET balance = balance + 500 WHERE id = 2;
COMMIT;`,
      },
      {
        command: 'ROLLBACK',
        description: 'Undoes all changes made during the current transaction.',
        example:
`START TRANSACTION;
DELETE FROM students WHERE gpa < 1.0;
ROLLBACK;  -- no rows are actually deleted`,
      },
      {
        command: 'SAVEPOINT',
        description: 'Sets a named point within a transaction to rollback to.',
        example:
`SAVEPOINT before_delete;
DELETE FROM students WHERE id = 5;
ROLLBACK TO before_delete;`,
      },
    ],
  },
  {
    id: 'plsql',
    title: 'PL/SQL & Procedures',
    shortTitle: 'PL/SQL',
    icon: <Terminal size={16} />,
    color: 'amber',
    commands: [
      {
        command: 'CREATE PROCEDURE',
        description: 'Creates a stored procedure — a reusable block of SQL statements.',
        example:
`CREATE PROCEDURE raise_gpa(IN sid INT, IN amount DECIMAL)
BEGIN
  UPDATE students SET gpa = gpa + amount WHERE id = sid;
END;`,
      },
      {
        command: 'CALL',
        description: 'Executes a stored procedure.',
        example: 'CALL raise_gpa(1, 0.10);',
      },
      {
        command: 'CREATE FUNCTION',
        description: 'Creates a function that returns a value.',
        example:
`CREATE FUNCTION get_gpa(sid INT) RETURNS DECIMAL
BEGIN
  DECLARE result DECIMAL(3,2);
  SELECT gpa INTO result FROM students WHERE id = sid;
  RETURN result;
END;`,
      },
      {
        command: 'CREATE TRIGGER',
        description: 'Automatically executes code when an INSERT, UPDATE, or DELETE occurs.',
        example:
`CREATE TRIGGER log_update
AFTER UPDATE ON students
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (action, student_id, changed_at)
  VALUES ('UPDATE', NEW.id, NOW());
END;`,
      },
      {
        command: 'DECLARE / SET',
        description: 'Declares and assigns variables inside a PL/SQL block.',
        example:
`DECLARE @total INT;
SET @total = (SELECT COUNT(*) FROM students);`,
      },
      {
        command: 'IF ... ELSE',
        description: 'Conditional logic inside stored procedures.',
        example:
`IF @total > 100 THEN
  SELECT 'Large class';
ELSE
  SELECT 'Small class';
END IF;`,
      },
      {
        command: 'CURSOR',
        description: 'Iterates over rows one by one in a procedure.',
        example:
`DECLARE cur CURSOR FOR SELECT name FROM students;
OPEN cur;
FETCH cur INTO @sname;
CLOSE cur;`,
      },
    ],
  },
  {
    id: 'dcl',
    title: 'Data Control Language (DCL)',
    shortTitle: 'DCL',
    icon: <Shield size={16} />,
    color: 'blue',
    commands: [
      {
        command: 'GRANT',
        description: 'Gives privileges to a user or role.',
        example: 'GRANT SELECT, INSERT ON students TO \'app_user\';',
      },
      {
        command: 'REVOKE',
        description: 'Removes previously granted privileges.',
        example: 'REVOKE INSERT ON students FROM \'app_user\';',
      },
    ],
  },
  {
    id: 'algebra',
    title: 'Relational Algebra',
    shortTitle: 'Algebra',
    icon: <Sigma size={16} />,
    color: 'violet',
    commands: [
      {
        command: 'σ (Selection)',
        description: 'Selects rows that satisfy a condition. Like WHERE in SQL.',
        example: 'σ[age > 20](Students)',
      },
      {
        command: 'π (Projection)',
        description: 'Selects specific columns. Like SELECT col1, col2 in SQL.',
        example: 'π[name, gpa](Students)',
      },
      {
        command: '∪ (Union)',
        description: 'Combines rows from two compatible relations, removing duplicates.',
        example: 'CS_Students ∪ Math_Students',
      },
      {
        command: '− (Difference)',
        description: 'Returns rows in the first relation that are not in the second.',
        example: 'All_Students − Graduated',
      },
      {
        command: '× (Cartesian Product)',
        description: 'Combines every row of one relation with every row of another.',
        example: 'Students × Courses',
      },
      {
        command: '⋈ (Natural Join)',
        description: 'Joins on common attribute names, keeping matches only.',
        example: 'Students ⋈ Enrollments',
      },
      {
        command: '⋈[θ] (Theta Join)',
        description: 'Joins two relations on a specified condition.',
        example: 'Students ⋈[Students.id = Enrollments.sid] Enrollments',
      },
      {
        command: 'ρ (Rename)',
        description: 'Renames a relation or its attributes.',
        example: 'ρ[S](Students)',
      },
      {
        command: '∩ (Intersection)',
        description: 'Returns rows present in both relations.',
        example: 'CS_Students ∩ Dean_List',
      },
      {
        command: '÷ (Division)',
        description: 'Returns rows related to all rows in the divisor.',
        example: 'Enrollments ÷ Required_Courses',
      },
      {
        command: 'γ (Aggregation)',
        description: 'Groups and aggregates values (SUM, COUNT, AVG, etc.).',
        example: 'γ[department; AVG(gpa)](Students)',
      },
      {
        command: 'τ (Sort)',
        description: 'Orders the result by given attributes.',
        example: 'τ[gpa DESC](Students)',
      },
    ],
  },
  {
    id: 'normalization',
    title: 'Normalization',
    shortTitle: 'Normal Forms',
    icon: <RefreshCw size={16} />,
    color: 'amber',
    commands: [
      {
        command: '1NF — First Normal Form',
        description: 'Every cell contains a single atomic value. No repeating groups.',
        example: '❌ courses: "Math, CS"  →  ✅ one row per course',
      },
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
      {
        command: 'BCNF — Boyce-Codd Normal Form',
        description: 'Every determinant is a candidate key. Stricter than 3NF.',
        example: 'If A → B, then A must be a superkey.',
      },
      {
        command: 'Functional Dependency (FD)',
        description: 'A → B means: the value of A uniquely determines the value of B.',
        example: 'student_id → name, age, gpa',
      },
      {
        command: 'Candidate Key',
        description: 'A minimal set of attributes that uniquely identifies every row.',
        example: '{student_id} is a candidate key if it determines all other attributes.',
      },
      {
        command: 'Closure (A⁺)',
        description: 'The set of all attributes functionally determined by A under given FDs.',
        example: 'Given A → B, B → C: A⁺ = {A, B, C}',
      },
    ],
  },
];

/* ──────────────────── Color Utilities ──────────────────── */

const COLORS: Record<string, {
  badge: string; border: string; text: string;
  code: string; tab: string; tabActive: string;
}> = {
  blue: {
    badge: 'bg-blue-500/10 text-blue-400',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    code: 'bg-blue-500/8 border-blue-500/20 text-blue-300',
    tab: 'text-zinc-400 hover:text-blue-400 hover:bg-blue-500/5',
    tabActive: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  },
  violet: {
    badge: 'bg-violet-500/10 text-violet-400',
    border: 'border-violet-500/20',
    text: 'text-violet-400',
    code: 'bg-violet-500/8 border-violet-500/20 text-violet-300',
    tab: 'text-zinc-400 hover:text-violet-400 hover:bg-violet-500/5',
    tabActive: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  },
  emerald: {
    badge: 'bg-emerald-500/10 text-emerald-400',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    code: 'bg-emerald-500/8 border-emerald-500/20 text-emerald-300',
    tab: 'text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/5',
    tabActive: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  amber: {
    badge: 'bg-amber-500/10 text-amber-400',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    code: 'bg-amber-500/8 border-amber-500/20 text-amber-300',
    tab: 'text-zinc-400 hover:text-amber-400 hover:bg-amber-500/5',
    tabActive: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
  rose: {
    badge: 'bg-rose-500/10 text-rose-400',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    code: 'bg-rose-500/8 border-rose-500/20 text-rose-300',
    tab: 'text-zinc-400 hover:text-rose-400 hover:bg-rose-500/5',
    tabActive: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  },
};

/* ──────────────────── Copy Button ──────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2.5 top-2.5 rounded-md p-1 text-zinc-600 opacity-0 transition-all hover:text-zinc-300 group-hover/code:opacity-100"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

/* ──────────────────── Command Card ──────────────────── */

function CommandCard({ cmd, color }: { cmd: CommandEntry; color: string }) {
  const colors = COLORS[color] ?? COLORS.blue;

  return (
    <div className="group rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700/60">
      {/* Command + Description */}
      <div className="mb-3 space-y-1.5">
        <code className={`inline-block rounded-md border px-2.5 py-1 text-xs font-bold tracking-wide ${colors.code}`}>
          {cmd.command}
        </code>
        <p className="text-[13px] leading-relaxed text-zinc-400">
          {cmd.description}
        </p>
      </div>

      {/* Example */}
      <div className="group/code relative">
        <pre className="overflow-x-auto rounded-lg border border-zinc-800/50 bg-zinc-950/60 px-4 py-3 font-mono text-xs leading-relaxed text-zinc-300">
          <code>{cmd.example}</code>
        </pre>
        <CopyButton text={cmd.example} />
      </div>
    </div>
  );
}

/* ──────────────────── Page ──────────────────── */

export default function LearnPage() {
  const [activeTab, setActiveTab] = useState(SECTIONS[0].id);
  const [search, setSearch] = useState('');

  const query = search.toLowerCase().trim();

  const activeSection = SECTIONS.find((s) => s.id === activeTab) ?? SECTIONS[0];
  const activeColors = COLORS[activeSection.color] ?? COLORS.blue;

  const filteredCommands = useMemo(() => {
    if (!query) return activeSection.commands;
    return activeSection.commands.filter(
      (c) =>
        c.command.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.example.toLowerCase().includes(query),
    );
  }, [activeSection, query]);

  // global search — find matching tabs
  const matchingTabIds = useMemo(() => {
    if (!query) return null;
    return new Set(
      SECTIONS.filter((s) =>
        s.commands.some(
          (c) =>
            c.command.toLowerCase().includes(query) ||
            c.description.toLowerCase().includes(query) ||
            c.example.toLowerCase().includes(query),
        ),
      ).map((s) => s.id),
    );
  }, [query]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Top Bar ── */}
      <div className="shrink-0 border-b border-zinc-800/60 bg-zinc-950/30 px-6 pb-0 pt-5">
        {/* Title row */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <BookOpen size={18} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">
                Commands &amp; Syntax
              </h1>
              <p className="text-xs text-zinc-500">
                {SECTIONS.length} categories &middot; {SECTIONS.reduce((s, sec) => s + sec.commands.length, 0)} commands
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/50 py-1.5 pl-8 pr-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-zinc-600"
            />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="-mb-px flex flex-wrap gap-1">
          {SECTIONS.map((section) => {
            const colors = COLORS[section.color] ?? COLORS.blue;
            const isActive = section.id === activeTab;
            const hasMatch = matchingTabIds === null || matchingTabIds.has(section.id);

            return (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={`
                  inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-xs font-medium transition-all
                  ${isActive
                    ? `${colors.tabActive} border-zinc-700/40`
                    : `${colors.tab} border-transparent`
                  }
                  ${!hasMatch && !isActive ? 'opacity-30' : ''}
                `}
              >
                {section.icon}
                <span className="hidden sm:inline">{section.shortTitle}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {/* Section Title */}
          <div className="mb-5 flex items-center gap-3">
            <div className={`rounded-lg p-2 ${activeColors.badge}`}>
              {activeSection.icon}
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">{activeSection.title}</h2>
              <p className="text-xs text-zinc-500">
                {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
                {query && ` matching "${search}"`}
              </p>
            </div>
          </div>

          {/* Commands Grid */}
          {filteredCommands.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 py-16 text-center">
              <p className="text-sm text-zinc-500">
                No commands match &ldquo;{search}&rdquo; in this category
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {filteredCommands.map((cmd) => (
                <CommandCard key={cmd.command} cmd={cmd} color={activeSection.color} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
