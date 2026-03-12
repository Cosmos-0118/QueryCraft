import type { Lesson } from '@/types/lesson';

export const unit2Lessons: Lesson[] = [
  {
    slug: 'er-to-relational',
    title: 'ER to Relational Mapping',
    description: 'Convert ER diagrams into relational tables systematically.',
    steps: [
      {
        id: 'u2l1s1',
        type: 'explanation',
        title: 'Mapping Overview',
        explanation:
          'Converting an ER diagram to relational tables follows a systematic 7-step algorithm: (1) Map strong entities, (2) Map weak entities, (3) Map 1:1 relationships, (4) Map 1:N relationships, (5) Map M:N relationships, (6) Map multivalued attributes, (7) Map higher-degree relationships.',
      },
      {
        id: 'u2l1s2',
        type: 'sql',
        title: 'Step 1: Strong Entities',
        explanation:
          'Each strong entity becomes a table. Simple attributes become columns. The key attribute becomes the primary key. Composite attributes are flattened (name → first_name, last_name).',
        command:
          'CREATE TABLE Employee (\n  emp_id INT PRIMARY KEY,\n  first_name VARCHAR(50),\n  last_name VARCHAR(50),\n  salary DECIMAL(10,2)\n);',
        afterState: [
          {
            name: 'Employee',
            columns: ['emp_id', 'first_name', 'last_name', 'salary'],
            rows: [],
          },
        ],
      },
      {
        id: 'u2l1s3',
        type: 'sql',
        title: 'Step 2: Weak Entities',
        explanation:
          "A weak entity's table includes its partial key plus the primary key of its owner entity as a foreign key. Together they form the composite primary key.",
        command:
          'CREATE TABLE Dependent (\n  emp_id INT,\n  dep_name VARCHAR(50),\n  relationship VARCHAR(30),\n  PRIMARY KEY (emp_id, dep_name),\n  FOREIGN KEY (emp_id) REFERENCES Employee(emp_id)\n);',
        afterState: [
          {
            name: 'Dependent',
            columns: ['emp_id', 'dep_name', 'relationship'],
            rows: [],
          },
        ],
      },
      {
        id: 'u2l1s4',
        type: 'sql',
        title: 'Step 4: 1:N Relationships',
        explanation:
          'For a one-to-many relationship, add the primary key of the "one" side as a foreign key in the "many" side table. Example: each Employee works in one Department, but a Department has many Employees.',
        command:
          'CREATE TABLE Department (\n  dept_id INT PRIMARY KEY,\n  name VARCHAR(50),\n  location VARCHAR(100)\n);\n\nALTER TABLE Employee ADD COLUMN dept_id INT;\nALTER TABLE Employee ADD FOREIGN KEY (dept_id) REFERENCES Department(dept_id);',
        afterState: [
          {
            name: 'Department',
            columns: ['dept_id', 'name', 'location'],
            rows: [],
          },
          {
            name: 'Employee',
            columns: ['emp_id', 'first_name', 'last_name', 'salary', 'dept_id'],
            rows: [],
          },
        ],
      },
      {
        id: 'u2l1s5',
        type: 'sql',
        title: 'Step 5: M:N Relationships',
        explanation:
          'Many-to-many relationships require a new junction (bridge) table. It contains the primary keys of both participating entities as foreign keys, forming a composite primary key. Relationship attributes go here too.',
        command:
          'CREATE TABLE Project (\n  proj_id INT PRIMARY KEY,\n  name VARCHAR(100)\n);\n\nCREATE TABLE Works_On (\n  emp_id INT,\n  proj_id INT,\n  hours DECIMAL(5,1),\n  PRIMARY KEY (emp_id, proj_id),\n  FOREIGN KEY (emp_id) REFERENCES Employee(emp_id),\n  FOREIGN KEY (proj_id) REFERENCES Project(proj_id)\n);',
        afterState: [
          {
            name: 'Works_On',
            columns: ['emp_id', 'proj_id', 'hours'],
            rows: [],
          },
        ],
      },
      {
        id: 'u2l1s6',
        type: 'sql',
        title: 'Putting It All Together',
        explanation:
          "Let's see the complete mapped schema with sample data. The ER diagram had entities Employee, Department, Project, and Dependent with various relationships.",
        command:
          "INSERT INTO Department VALUES (1, 'Engineering', 'Building A');\nINSERT INTO Department VALUES (2, 'Marketing', 'Building B');\n\nINSERT INTO Employee VALUES (101, 'Alice', 'Smith', 75000, 1);\nINSERT INTO Employee VALUES (102, 'Bob', 'Jones', 68000, 1);\nINSERT INTO Employee VALUES (103, 'Carol', 'Lee', 72000, 2);\n\nSELECT e.first_name, e.last_name, d.name AS department\nFROM Employee e JOIN Department d ON e.dept_id = d.dept_id;",
        afterState: [
          {
            name: 'Result',
            columns: ['first_name', 'last_name', 'department'],
            rows: [
              ['Alice', 'Smith', 'Engineering'],
              ['Bob', 'Jones', 'Engineering'],
              ['Carol', 'Lee', 'Marketing'],
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'relational-algebra',
    title: 'Relational Algebra Operations',
    description: 'Master the fundamental operations: select, project, join, union, and more.',
    steps: [
      {
        id: 'u2l2s1',
        type: 'explanation',
        title: 'What is Relational Algebra?',
        explanation:
          'Relational algebra is a procedural query language that operates on relations (tables) and produces relations as results. It forms the theoretical foundation of SQL. The six fundamental operations are: Select (σ), Project (π), Union (∪), Set Difference (−), Cartesian Product (×), and Rename (ρ).',
      },
      {
        id: 'u2l2s2',
        type: 'algebra',
        title: 'Select (σ) — Filter Rows',
        explanation:
          'The Select operation σ filters rows that satisfy a condition. σ_{age > 20}(Students) returns only students older than 20. In SQL, this corresponds to the WHERE clause.',
        command: 'σ_{age > 20}(Students)',
        beforeState: [
          {
            name: 'Students',
            columns: ['id', 'name', 'age'],
            rows: [
              ['1', 'Alice', '20'],
              ['2', 'Bob', '22'],
              ['3', 'Carol', '19'],
              ['4', 'Dave', '21'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Result',
            columns: ['id', 'name', 'age'],
            rows: [
              ['2', 'Bob', '22'],
              ['4', 'Dave', '21'],
            ],
          },
        ],
        highlightedRows: [{ tableIndex: 0, rowIndices: [1, 3], color: 'green' }],
      },
      {
        id: 'u2l2s3',
        type: 'algebra',
        title: 'Project (π) — Choose Columns',
        explanation:
          'The Project operation π selects specific columns and removes duplicates. π_{name, age}(Students) keeps only the name and age columns. In SQL, this is the column list in SELECT.',
        command: 'π_{name, age}(Students)',
        beforeState: [
          {
            name: 'Students',
            columns: ['id', 'name', 'age'],
            rows: [
              ['1', 'Alice', '20'],
              ['2', 'Bob', '22'],
              ['3', 'Carol', '19'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Result',
            columns: ['name', 'age'],
            rows: [
              ['Alice', '20'],
              ['Bob', '22'],
              ['Carol', '19'],
            ],
          },
        ],
      },
      {
        id: 'u2l2s4',
        type: 'algebra',
        title: 'Natural Join (⋈) — Combine Tables',
        explanation:
          'The Natural Join ⋈ combines two tables on their common columns. Students ⋈ Enrollment matches rows where student_id is equal in both tables, combining the information.',
        command: 'Students ⋈ Enrollment',
        beforeState: [
          {
            name: 'Students',
            columns: ['student_id', 'name'],
            rows: [
              ['1', 'Alice'],
              ['2', 'Bob'],
            ],
          },
          {
            name: 'Enrollment',
            columns: ['student_id', 'course'],
            rows: [
              ['1', 'CS101'],
              ['1', 'MATH201'],
              ['2', 'CS101'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Result',
            columns: ['student_id', 'name', 'course'],
            rows: [
              ['1', 'Alice', 'CS101'],
              ['1', 'Alice', 'MATH201'],
              ['2', 'Bob', 'CS101'],
            ],
          },
        ],
      },
      {
        id: 'u2l2s5',
        type: 'algebra',
        title: 'Union (∪) and Difference (−)',
        explanation:
          'Union ∪ combines rows from two compatible tables (same columns), removing duplicates. Set Difference − returns rows in the first table that are not in the second. Both require union-compatible relations (same number and type of attributes).',
        command: 'CS_Students ∪ Math_Students',
        beforeState: [
          {
            name: 'CS_Students',
            columns: ['name'],
            rows: [['Alice'], ['Bob']],
          },
          {
            name: 'Math_Students',
            columns: ['name'],
            rows: [['Bob'], ['Carol']],
          },
        ],
        afterState: [
          {
            name: 'Result (Union)',
            columns: ['name'],
            rows: [['Alice'], ['Bob'], ['Carol']],
          },
        ],
      },
      {
        id: 'u2l2s6',
        type: 'explanation',
        title: 'Combining Operations',
        explanation:
          'The real power of relational algebra comes from combining operations. For example: π_{name}(σ_{age > 20}(Students ⋈ Enrollment)) first joins Students with Enrollment, then filters by age, then projects only names. This is equivalent to: SELECT name FROM Students JOIN Enrollment USING (student_id) WHERE age > 20.',
      },
    ],
  },
  {
    slug: 'relational-calculus',
    title: 'Relational Calculus',
    description:
      'Understand tuple and domain relational calculus — the declarative counterpart to algebra.',
    steps: [
      {
        id: 'u2l3s1',
        type: 'explanation',
        title: 'Algebra vs Calculus',
        explanation:
          "Relational Algebra is procedural — you specify HOW to get the result (step by step). Relational Calculus is declarative — you specify WHAT you want without specifying how. SQL is based on relational calculus. Both are equivalent in expressive power (Codd's theorem).",
      },
      {
        id: 'u2l3s2',
        type: 'explanation',
        title: 'Tuple Relational Calculus (TRC)',
        explanation:
          'In TRC, queries have the form: { t | P(t) } — "the set of all tuples t such that predicate P is true." Example: { t | t ∈ Students ∧ t.age > 20 } means "all student tuples where age is greater than 20." The variable t ranges over entire tuples.',
      },
      {
        id: 'u2l3s3',
        type: 'explanation',
        title: 'TRC Examples',
        explanation:
          "Find names of CS students: { t.name | t ∈ Students ∧ t.major = 'CS' }. Find students enrolled in CS101: { t | t ∈ Students ∧ ∃e(e ∈ Enrollment ∧ e.student_id = t.student_id ∧ e.course = 'CS101') }. The ∃ (exists) quantifier checks if at least one matching tuple exists.",
      },
      {
        id: 'u2l3s4',
        type: 'explanation',
        title: 'Domain Relational Calculus (DRC)',
        explanation:
          'In DRC, variables range over domain values (individual columns) instead of entire tuples. Format: { <x₁, x₂, ...> | P(x₁, x₂, ...) }. Example: { <n> | ∃i,a(Students(i, n, a) ∧ a > 20) } means "names n where there exists an id i and age a such that (i,n,a) is in Students and a > 20."',
      },
      {
        id: 'u2l3s5',
        type: 'explanation',
        title: 'Safe Expressions',
        explanation:
          'A calculus expression is "safe" if it always produces a finite result. Unsafe example: { t | t ∉ Students } — this would return all possible tuples NOT in Students (infinite!). Safe expressions only reference values that appear in the database. All practical queries must be safe.',
      },
      {
        id: 'u2l3s6',
        type: 'sql',
        title: 'From Calculus to SQL',
        explanation:
          'SQL is directly inspired by relational calculus. The SELECT clause corresponds to what we want (projection), FROM specifies the source relations, and WHERE defines the selection predicate. EXISTS in SQL maps to ∃ in calculus.',
        command:
          "-- TRC: { t.name | t ∈ Students ∧ ∃e(e ∈ Enrollment ∧ e.sid = t.id ∧ e.course = 'CS101') }\n-- Equivalent SQL:\nSELECT s.name\nFROM Students s\nWHERE EXISTS (\n  SELECT 1 FROM Enrollment e\n  WHERE e.student_id = s.id\n  AND e.course = 'CS101'\n);",
      },
    ],
  },
];
