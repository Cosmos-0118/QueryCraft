import type { Exercise } from '@/types/exercise';

export const exercises: Exercise[] = [
  // ── SQL Exercises: Easy ──
  {
    id: 'sql-001',
    title: 'Select All Students',
    description: 'Write a query to select all columns from the Students table.',
    type: 'sql',
    difficulty: 'easy',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Students (id INT PRIMARY KEY, name TEXT, age INT, major TEXT);\nINSERT INTO Students VALUES (1,'Alice',20,'CS'),(2,'Bob',21,'Math'),(3,'Carol',19,'Physics');",
    expectedResult: [
      ['1', 'Alice', '20', 'CS'],
      ['2', 'Bob', '21', 'Math'],
      ['3', 'Carol', '19', 'Physics'],
    ],
    hints: [
      'Use SELECT * to get all columns.',
      'The table name is Students.',
      'SELECT * FROM Students;',
    ],
  },
  {
    id: 'sql-002',
    title: 'Filter by Age',
    description: 'Select names of students older than 19.',
    type: 'sql',
    difficulty: 'easy',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Students (id INT PRIMARY KEY, name TEXT, age INT);\nINSERT INTO Students VALUES (1,'Alice',20),(2,'Bob',18),(3,'Carol',21),(4,'Dave',19);",
    expectedResult: [['Alice'], ['Carol']],
    hints: [
      'Use WHERE to filter rows.',
      'The condition is age > 19.',
      'SELECT name FROM Students WHERE age > 19;',
    ],
  },
  {
    id: 'sql-003',
    title: 'Count Rows',
    description: 'Count the total number of employees.',
    type: 'sql',
    difficulty: 'easy',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Employees (id INT PRIMARY KEY, name TEXT, dept TEXT);\nINSERT INTO Employees VALUES (1,'Alice','Eng'),(2,'Bob','Sales'),(3,'Carol','Eng'),(4,'Dave','HR');",
    expectedResult: [['4']],
    hints: [
      'Use the COUNT() aggregate function.',
      'COUNT(*) counts all rows.',
      'SELECT COUNT(*) FROM Employees;',
    ],
  },
  {
    id: 'sql-004',
    title: 'Order by Salary',
    description: 'Select employee names ordered by salary descending.',
    type: 'sql',
    difficulty: 'easy',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Employees (id INT PRIMARY KEY, name TEXT, salary INT);\nINSERT INTO Employees VALUES (1,'Alice',80000),(2,'Bob',95000),(3,'Carol',72000);",
    expectedResult: [['Bob'], ['Alice'], ['Carol']],
    hints: [
      'Use ORDER BY ... DESC.',
      'Select only the name column.',
      'SELECT name FROM Employees ORDER BY salary DESC;',
    ],
  },
  {
    id: 'sql-005',
    title: 'Distinct Departments',
    description: 'List all unique departments.',
    type: 'sql',
    difficulty: 'easy',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Employees (id INT PRIMARY KEY, name TEXT, dept TEXT);\nINSERT INTO Employees VALUES (1,'Alice','Eng'),(2,'Bob','Sales'),(3,'Carol','Eng'),(4,'Dave','HR'),(5,'Eve','Sales');",
    expectedResult: [['Eng'], ['HR'], ['Sales']],
    hints: [
      'Use SELECT DISTINCT.',
      'Select only the dept column.',
      'SELECT DISTINCT dept FROM Employees ORDER BY dept;',
    ],
  },

  // ── SQL Exercises: Medium ──
  {
    id: 'sql-006',
    title: 'Group by Department',
    description: 'Find the average salary per department. Show dept and avg_salary.',
    type: 'sql',
    difficulty: 'medium',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Employees (id INT PRIMARY KEY, name TEXT, dept TEXT, salary INT);\nINSERT INTO Employees VALUES (1,'Alice','Eng',80000),(2,'Bob','Sales',60000),(3,'Carol','Eng',90000),(4,'Dave','Sales',70000);",
    expectedResult: [
      ['Eng', '85000.0'],
      ['Sales', '65000.0'],
    ],
    hints: [
      'Use GROUP BY dept.',
      'Use the AVG() function for salary.',
      'SELECT dept, AVG(salary) AS avg_salary FROM Employees GROUP BY dept;',
    ],
  },
  {
    id: 'sql-007',
    title: 'INNER JOIN',
    description: 'Join Students and Enrollment tables. Show student name and course_id.',
    type: 'sql',
    difficulty: 'medium',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Students (id INT PRIMARY KEY, name TEXT);\nCREATE TABLE Enrollment (student_id INT, course_id TEXT);\nINSERT INTO Students VALUES (1,'Alice'),(2,'Bob'),(3,'Carol');\nINSERT INTO Enrollment VALUES (1,'CS101'),(1,'MATH201'),(2,'CS101');",
    expectedResult: [
      ['Alice', 'CS101'],
      ['Alice', 'MATH201'],
      ['Bob', 'CS101'],
    ],
    hints: [
      'Use INNER JOIN with ON condition.',
      'Join on Students.id = Enrollment.student_id.',
      'SELECT s.name, e.course_id FROM Students s INNER JOIN Enrollment e ON s.id = e.student_id;',
    ],
  },
  {
    id: 'sql-008',
    title: 'LEFT JOIN — Find Unenrolled',
    description: 'Find students who are NOT enrolled in any course. Show their names.',
    type: 'sql',
    difficulty: 'medium',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Students (id INT PRIMARY KEY, name TEXT);\nCREATE TABLE Enrollment (student_id INT, course_id TEXT);\nINSERT INTO Students VALUES (1,'Alice'),(2,'Bob'),(3,'Carol');\nINSERT INTO Enrollment VALUES (1,'CS101'),(2,'MATH201');",
    expectedResult: [['Carol']],
    hints: [
      'Use LEFT JOIN and check for NULL.',
      'WHERE Enrollment.student_id IS NULL.',
      'SELECT s.name FROM Students s LEFT JOIN Enrollment e ON s.id = e.student_id WHERE e.student_id IS NULL;',
    ],
  },
  {
    id: 'sql-009',
    title: 'Subquery with IN',
    description: 'Find names of students enrolled in course CS101 using a subquery.',
    type: 'sql',
    difficulty: 'medium',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Students (id INT PRIMARY KEY, name TEXT);\nCREATE TABLE Enrollment (student_id INT, course_id TEXT);\nINSERT INTO Students VALUES (1,'Alice'),(2,'Bob'),(3,'Carol');\nINSERT INTO Enrollment VALUES (1,'CS101'),(2,'MATH201'),(3,'CS101');",
    expectedResult: [['Alice'], ['Carol']],
    hints: [
      'Use WHERE id IN (SELECT ...).',
      'The subquery should find student_ids in Enrollment for CS101.',
      "SELECT name FROM Students WHERE id IN (SELECT student_id FROM Enrollment WHERE course_id = 'CS101');",
    ],
  },
  {
    id: 'sql-010',
    title: 'HAVING Clause',
    description: 'Find departments with more than 2 employees. Show dept and count.',
    type: 'sql',
    difficulty: 'medium',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Employees (id INT PRIMARY KEY, name TEXT, dept TEXT);\nINSERT INTO Employees VALUES (1,'Alice','Eng'),(2,'Bob','Eng'),(3,'Carol','Eng'),(4,'Dave','HR'),(5,'Eve','Sales'),(6,'Frank','Sales');",
    expectedResult: [['Eng', '3']],
    hints: [
      'Group by dept and use HAVING.',
      'HAVING COUNT(*) > 2.',
      'SELECT dept, COUNT(*) FROM Employees GROUP BY dept HAVING COUNT(*) > 2;',
    ],
  },

  // ── SQL Exercises: Hard ──
  {
    id: 'sql-011',
    title: 'Correlated Subquery',
    description: 'Find employees who earn more than the average salary of their department.',
    type: 'sql',
    difficulty: 'hard',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Employees (id INT PRIMARY KEY, name TEXT, dept TEXT, salary INT);\nINSERT INTO Employees VALUES (1,'Alice','Eng',90000),(2,'Bob','Eng',70000),(3,'Carol','Sales',80000),(4,'Dave','Sales',60000);",
    expectedResult: [['Alice'], ['Carol']],
    hints: [
      'Use a correlated subquery to compute dept average.',
      'WHERE salary > (SELECT AVG(salary) FROM Employees e2 WHERE e2.dept = e1.dept).',
      'SELECT name FROM Employees e1 WHERE salary > (SELECT AVG(salary) FROM Employees e2 WHERE e2.dept = e1.dept);',
    ],
  },
  {
    id: 'sql-012',
    title: 'Self Join — Manager Names',
    description: "Find each employee's name and their manager's name.",
    type: 'sql',
    difficulty: 'hard',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Employees (id INT PRIMARY KEY, name TEXT, manager_id INT);\nINSERT INTO Employees VALUES (1,'CEO',NULL),(2,'Alice',1),(3,'Bob',1),(4,'Carol',2);",
    expectedResult: [
      ['Alice', 'CEO'],
      ['Bob', 'CEO'],
      ['Carol', 'Alice'],
    ],
    hints: [
      'Join the table with itself.',
      'Use e.manager_id = m.id.',
      'SELECT e.name, m.name FROM Employees e JOIN Employees m ON e.manager_id = m.id;',
    ],
  },
  {
    id: 'sql-013',
    title: 'Window-Style Ranking',
    description: 'Find the top 2 highest-paid employees. Show name and salary.',
    type: 'sql',
    difficulty: 'hard',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Employees (id INT PRIMARY KEY, name TEXT, salary INT);\nINSERT INTO Employees VALUES (1,'Alice',90000),(2,'Bob',80000),(3,'Carol',95000),(4,'Dave',70000);",
    expectedResult: [
      ['Carol', '95000'],
      ['Alice', '90000'],
    ],
    hints: [
      'Use ORDER BY salary DESC with LIMIT.',
      'LIMIT 2 to get the top 2.',
      'SELECT name, salary FROM Employees ORDER BY salary DESC LIMIT 2;',
    ],
  },
  {
    id: 'sql-014',
    title: 'Multi-Table Aggregation',
    description: 'For each course, show the course title and the number of enrolled students.',
    type: 'sql',
    difficulty: 'hard',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Courses (id TEXT PRIMARY KEY, title TEXT);\nCREATE TABLE Enrollment (student_id INT, course_id TEXT);\nINSERT INTO Courses VALUES ('CS101','Databases'),('CS102','Algorithms'),('CS103','Networks');\nINSERT INTO Enrollment VALUES (1,'CS101'),(2,'CS101'),(3,'CS101'),(1,'CS102');",
    expectedResult: [
      ['Algorithms', '1'],
      ['Databases', '3'],
      ['Networks', '0'],
    ],
    hints: [
      'Use LEFT JOIN to include courses with 0 students.',
      'GROUP BY course and COUNT enrollments.',
      'SELECT c.title, COUNT(e.student_id) FROM Courses c LEFT JOIN Enrollment e ON c.id = e.course_id GROUP BY c.id, c.title ORDER BY c.title;',
    ],
  },
  {
    id: 'sql-015',
    title: 'EXISTS with Negation',
    description: 'Find courses that have no enrolled students.',
    type: 'sql',
    difficulty: 'hard',
    topicSlug: 'sql',
    setupSql:
      "CREATE TABLE Courses (id TEXT PRIMARY KEY, title TEXT);\nCREATE TABLE Enrollment (student_id INT, course_id TEXT);\nINSERT INTO Courses VALUES ('CS101','Databases'),('CS102','Algorithms'),('CS103','Networks');\nINSERT INTO Enrollment VALUES (1,'CS101'),(2,'CS102');",
    expectedResult: [['Networks']],
    hints: [
      'Use NOT EXISTS with a correlated subquery.',
      'Check if no enrollment row exists for each course.',
      'SELECT title FROM Courses c WHERE NOT EXISTS (SELECT 1 FROM Enrollment e WHERE e.course_id = c.id);',
    ],
  },

  // ── Relational Algebra Exercises ──
  {
    id: 'alg-001',
    title: 'Select Operation',
    description: 'Write a relational algebra expression to find all students with age > 20.',
    type: 'algebra',
    difficulty: 'easy',
    topicSlug: 'relational-model',
    hints: [
      'Use the σ (sigma) select operator.',
      'The condition goes in the subscript.',
      'σ_{age > 20}(Students)',
    ],
  },
  {
    id: 'alg-002',
    title: 'Project Operation',
    description: 'Project only the name and major columns from Students.',
    type: 'algebra',
    difficulty: 'easy',
    topicSlug: 'relational-model',
    hints: [
      'Use the π (pi) project operator.',
      'List the columns you want.',
      'π_{name, major}(Students)',
    ],
  },
  {
    id: 'alg-003',
    title: 'Combined Select-Project',
    description: 'Find names of CS students (major = "CS") using relational algebra.',
    type: 'algebra',
    difficulty: 'medium',
    topicSlug: 'relational-model',
    hints: [
      'First select CS students, then project name.',
      'Apply σ first, then π.',
      'π_{name}(σ_{major = "CS"}(Students))',
    ],
  },
  {
    id: 'alg-004',
    title: 'Natural Join',
    description: 'Write a natural join between Students and Enrollment.',
    type: 'algebra',
    difficulty: 'medium',
    topicSlug: 'relational-model',
    hints: [
      'Use the ⋈ (bowtie) join operator.',
      'Natural join matches on common columns.',
      'Students ⋈ Enrollment',
    ],
  },
  {
    id: 'alg-005',
    title: 'Union Operation',
    description: 'Find names that appear in either CS_Students or Math_Students.',
    type: 'algebra',
    difficulty: 'easy',
    topicSlug: 'relational-model',
    hints: [
      'Use ∪ (union) operator.',
      'Both relations must be union-compatible.',
      'CS_Students ∪ Math_Students',
    ],
  },
  {
    id: 'alg-006',
    title: 'Set Difference',
    description: 'Find students in CS but NOT in Math using set difference.',
    type: 'algebra',
    difficulty: 'medium',
    topicSlug: 'relational-model',
    hints: [
      'Use − (minus/difference) operator.',
      'A − B gives elements in A but not in B.',
      'CS_Students − Math_Students',
    ],
  },
  {
    id: 'alg-007',
    title: 'Complex Expression',
    description: 'Find names of students enrolled in CS101 who are older than 20.',
    type: 'algebra',
    difficulty: 'hard',
    topicSlug: 'relational-model',
    hints: [
      'Join Students with Enrollment, then select and project.',
      'Use σ, π, and ⋈ together.',
      'π_{name}(σ_{course="CS101" ∧ age>20}(Students ⋈ Enrollment))',
    ],
  },
  {
    id: 'alg-008',
    title: 'Division Operation',
    description: 'Describe how to find students enrolled in ALL courses using relational algebra.',
    type: 'algebra',
    difficulty: 'hard',
    topicSlug: 'relational-model',
    hints: [
      'Division (÷) finds tuples in A related to ALL tuples in B.',
      'Enrollment ÷ Courses gives students enrolled in every course.',
      'π_{student_id,course_id}(Enrollment) ÷ π_{course_id}(Courses)',
    ],
  },
  {
    id: 'alg-009',
    title: 'Rename Operation',
    description: 'Rename the Students table to S and project the name column.',
    type: 'algebra',
    difficulty: 'easy',
    topicSlug: 'relational-model',
    hints: ['Use ρ (rho) rename operator.', 'ρ renames a relation.', 'π_{name}(ρ_{S}(Students))'],
  },
  {
    id: 'alg-010',
    title: 'Cartesian Product',
    description: 'Write the Cartesian product of Students and Courses, then select matching rows.',
    type: 'algebra',
    difficulty: 'hard',
    topicSlug: 'relational-model',
    hints: [
      'Use × for Cartesian product.',
      'Apply σ to filter matching pairs.',
      'σ_{Students.id = Enrollment.student_id}(Students × Enrollment)',
    ],
  },

  // ── Normalization Exercises ──
  {
    id: 'norm-001',
    title: 'Identify Normal Form',
    description: 'Given R(A,B,C,D) with FDs: A→B, A→C, A→D. What normal form is this relation in?',
    type: 'normalization',
    difficulty: 'easy',
    topicSlug: 'normalization',
    hints: [
      'Find the candidate key first.',
      'A determines everything, so A is the key.',
      "Since A is the only determinant and it's the key: this is in BCNF.",
    ],
  },
  {
    id: 'norm-002',
    title: 'Find Candidate Keys',
    description: 'Given R(A,B,C,D) with FDs: AB→C, C→D, D→A. Find all candidate keys.',
    type: 'normalization',
    difficulty: 'medium',
    topicSlug: 'normalization',
    hints: [
      'B is in no FD right side — it must be in every key.',
      'Check closures: {A,B}+ = {A,B,C,D}, {B,C}+ = {B,C,D,A}, {B,D}+ = {B,D,A,C}.',
      'Candidate keys: AB, BC, BD.',
    ],
  },
  {
    id: 'norm-003',
    title: 'Decompose to 2NF',
    description:
      'Given R(student_id, course_id, student_name, grade) with key (student_id, course_id) and FD: student_id → student_name. Decompose to 2NF.',
    type: 'normalization',
    difficulty: 'medium',
    topicSlug: 'normalization',
    hints: [
      'student_name depends only on student_id (partial dependency).',
      'Create Students(student_id, student_name) and Enrollment(student_id, course_id, grade).',
      'R1(student_id, student_name), R2(student_id, course_id, grade).',
    ],
  },
  {
    id: 'norm-004',
    title: 'Decompose to 3NF',
    description:
      'Given R(emp_id, dept_id, dept_name) with FDs: emp_id→dept_id, dept_id→dept_name. Decompose to 3NF.',
    type: 'normalization',
    difficulty: 'medium',
    topicSlug: 'normalization',
    hints: [
      'There is a transitive dependency: emp_id → dept_id → dept_name.',
      'Split out the transitive part.',
      'R1(emp_id, dept_id), R2(dept_id, dept_name).',
    ],
  },
  {
    id: 'norm-005',
    title: 'Check for 1NF Violation',
    description:
      'A table has columns: id, name, phone_numbers (comma-separated list). Is it in 1NF? Explain.',
    type: 'normalization',
    difficulty: 'easy',
    topicSlug: 'normalization',
    hints: [
      '1NF requires atomic values.',
      'A comma-separated list is NOT atomic.',
      'Not in 1NF. Fix: create a separate Phone table.',
    ],
  },
  {
    id: 'norm-006',
    title: 'BCNF Decomposition',
    description: 'Given R(A,B,C) with FDs: AB→C, C→B. Key is AB. Decompose to BCNF.',
    type: 'normalization',
    difficulty: 'hard',
    topicSlug: 'normalization',
    hints: [
      'C→B violates BCNF (C is not a superkey).',
      'Decompose using C→B: R1(C,B) and R2(A,C).',
      'R1(C,B) with key C, R2(A,C) with key AC.',
    ],
  },
  {
    id: 'norm-007',
    title: 'Attribute Closure',
    description: 'Given R(A,B,C,D,E) with FDs: A→B, BC→D, D→E. Find {A,C}+.',
    type: 'normalization',
    difficulty: 'medium',
    topicSlug: 'normalization',
    hints: [
      'Start with {A,C}. Apply A→B: {A,B,C}.',
      'Apply BC→D: {A,B,C,D}. Apply D→E: {A,B,C,D,E}.',
      '{A,C}+ = {A,B,C,D,E} — so AC is a candidate key.',
    ],
  },
  {
    id: 'norm-008',
    title: 'Identify MVD for 4NF',
    description:
      'A professor teaches courses and speaks languages independently. Identify the multivalued dependencies.',
    type: 'normalization',
    difficulty: 'hard',
    topicSlug: 'normalization',
    hints: [
      'Course and language are independent of each other.',
      'prof →→ course and prof →→ language.',
      'Decompose: Prof_Course(prof, course), Prof_Lang(prof, language).',
    ],
  },
  {
    id: 'norm-009',
    title: 'Lossless Join Test',
    description: 'Given R(A,B,C) decomposed into R1(A,B) and R2(B,C). Is this lossless? FDs: B→C.',
    type: 'normalization',
    difficulty: 'hard',
    topicSlug: 'normalization',
    hints: [
      'A decomposition is lossless if R1 ∩ R2 → R1 or R1 ∩ R2 → R2.',
      'R1 ∩ R2 = {B}. B→C means {B} → R2.',
      'Yes, it is a lossless join decomposition.',
    ],
  },
  {
    id: 'norm-010',
    title: 'Minimal Cover',
    description: 'Find the minimal cover of: A→BC, B→C, AB→D.',
    type: 'normalization',
    difficulty: 'hard',
    topicSlug: 'normalization',
    hints: [
      'Split RHS: A→B, A→C, B→C, AB→D.',
      'A→C is redundant (A→B→C). Remove it.',
      'AB→D: test if A→D. A+ = {A,B,C,D}. Yes! Minimal cover: A→B, B→C, A→D.',
    ],
  },

  // ── ER Diagram Exercises ──
  {
    id: 'er-001',
    title: 'Identify Entities',
    description:
      'A university tracks students, courses, and instructors. Students enroll in courses taught by instructors. Identify the entities.',
    type: 'er-diagram',
    difficulty: 'easy',
    topicSlug: 'database-fundamentals',
    hints: [
      'Look for nouns that represent real-world objects.',
      'Student, Course, and Instructor are entities.',
      'Entities: Student, Course, Instructor. Relationships: enrolls_in (Student-Course), teaches (Instructor-Course).',
    ],
  },
  {
    id: 'er-002',
    title: 'Determine Cardinality',
    description:
      'Each student can enroll in many courses, and each course can have many students. What is the cardinality of the enrollment relationship?',
    type: 'er-diagram',
    difficulty: 'easy',
    topicSlug: 'database-fundamentals',
    hints: [
      'Think: how many of each can relate to the other?',
      'Many students to many courses.',
      'M:N (many-to-many). Requires a junction table.',
    ],
  },
  {
    id: 'er-003',
    title: 'Weak Entity',
    description:
      'A Room belongs to a Building. A room number only makes sense within its building (Room 101 in Building A ≠ Room 101 in Building B). Identify the weak entity and its partial key.',
    type: 'er-diagram',
    difficulty: 'medium',
    topicSlug: 'database-fundamentals',
    hints: [
      'A weak entity depends on another entity for identification.',
      'Room is weak; Building is strong.',
      'Weak entity: Room. Partial key: room_number. Identifying relationship: belongs_to(Room, Building).',
    ],
  },
  {
    id: 'er-004',
    title: 'Map M:N Relationship',
    description:
      'Given entities Student(student_id, name) and Course(course_id, title) with M:N relationship "enrolls" with attribute grade, write the SQL tables.',
    type: 'er-diagram',
    difficulty: 'medium',
    topicSlug: 'database-fundamentals',
    hints: [
      'M:N requires a junction table.',
      'The junction table has both foreign keys + relationship attributes.',
      'Enrollment(student_id, course_id, grade) with composite PK and FKs.',
    ],
  },
  {
    id: 'er-005',
    title: 'Specialization/Generalization',
    description:
      'A university has People. People can be Students or Instructors (or both). Design this using specialization.',
    type: 'er-diagram',
    difficulty: 'hard',
    topicSlug: 'database-fundamentals',
    hints: [
      'Person is the superclass; Student and Instructor are subclasses.',
      'This is overlapping specialization (a person can be both).',
      'Person(id, name), Student(id, gpa) FK→Person, Instructor(id, salary) FK→Person.',
    ],
  },

  // ── Mixed/Challenge Exercises ──
  {
    id: 'mix-001',
    title: 'Design a Library DB',
    description:
      'Design tables for a library: Books have titles and ISBNs. Members can borrow books. Track borrow date and return date.',
    type: 'sql',
    difficulty: 'hard',
    topicSlug: 'sql',
    hints: [
      'Entities: Book, Member, Borrowing.',
      'Borrowing is M:N between Book and Member.',
      'CREATE TABLE Books(isbn TEXT PK, title TEXT); CREATE TABLE Members(id INT PK, name TEXT); CREATE TABLE Borrowing(isbn, member_id, borrow_date, return_date, PK(isbn,member_id,borrow_date));',
    ],
  },
  {
    id: 'mix-002',
    title: 'Normalize This Table',
    description:
      'Given OrderDetails(order_id, product_id, product_name, quantity, customer_name) with FDs: order_id→customer_name, product_id→product_name. Decompose to 3NF.',
    type: 'normalization',
    difficulty: 'hard',
    topicSlug: 'normalization',
    hints: [
      'Key is (order_id, product_id). product_name has partial dep, customer_name has partial dep.',
      'Split: Products(product_id, product_name), Orders(order_id, customer_name), OrderItems(order_id, product_id, quantity).',
      'Three tables: Products, Orders, OrderItems.',
    ],
  },
  {
    id: 'mix-003',
    title: 'SQL + Normalization',
    description:
      'Write CREATE TABLE statements for a 3NF-normalized student enrollment system with Students, Courses, and Enrollment tables.',
    type: 'sql',
    difficulty: 'medium',
    topicSlug: 'sql',
    hints: [
      'Students has student info, Courses has course info.',
      'Enrollment is the junction table with grade.',
      'CREATE TABLE Students(id INT PK, name TEXT); CREATE TABLE Courses(id TEXT PK, title TEXT); CREATE TABLE Enrollment(student_id, course_id, grade, PK(student_id,course_id), FK refs);',
    ],
  },
  {
    id: 'mix-004',
    title: 'ER to SQL Challenge',
    description:
      'An Employee works in one Department. A Department can have many Employees. Each Department has exactly one Manager (who is an Employee). Design the tables.',
    type: 'er-diagram',
    difficulty: 'hard',
    topicSlug: 'database-fundamentals',
    hints: [
      'Employee has FK to Department (works_in is 1:N).',
      'Department has FK to Employee (managed_by is 1:1).',
      'Department(id, name, manager_id FK→Employee); Employee(id, name, dept_id FK→Department);',
    ],
  },
  {
    id: 'mix-005',
    title: 'Transaction Scenario',
    description:
      'Two users try to book the last available seat simultaneously. Describe what isolation level prevents double-booking and why.',
    type: 'sql',
    difficulty: 'hard',
    topicSlug: 'transactions-advanced',
    hints: [
      'Without proper isolation, both could read "1 seat available" and both book it.',
      'SERIALIZABLE prevents phantom reads and ensures serial execution.',
      'SERIALIZABLE or SELECT ... FOR UPDATE (explicit locking) prevents double-booking.',
    ],
  },
];

export function getExerciseById(id: string): Exercise | undefined {
  return exercises.find((e) => e.id === id);
}

export function getExercisesByTopic(topicSlug: string): Exercise[] {
  return exercises.filter((e) => e.topicSlug === topicSlug);
}

export function getExercisesByDifficulty(difficulty: Exercise['difficulty']): Exercise[] {
  return exercises.filter((e) => e.difficulty === difficulty);
}

export function getExercisesByType(type: Exercise['type']): Exercise[] {
  return exercises.filter((e) => e.type === type);
}
