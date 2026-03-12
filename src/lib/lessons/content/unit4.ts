import type { Lesson } from '@/types/lesson';

export const unit4Lessons: Lesson[] = [
  {
    slug: 'why-normalize',
    title: 'Why Normalize?',
    description: 'Understand data redundancy, anomalies, and why normalization matters.',
    steps: [
      {
        id: 'u4l1s1',
        type: 'explanation',
        title: 'The Problem: Data Redundancy',
        explanation:
          "When data is not properly organized, the same information is stored multiple times. For example, if a student's department info is stored in every enrollment row, the department name and location appear repeatedly. This wastes space and leads to inconsistencies.",
      },
      {
        id: 'u4l1s2',
        type: 'normalization',
        title: 'Insert Anomaly',
        explanation:
          "An insert anomaly occurs when you cannot add data without adding unrelated data. Example: in a denormalized Student_Dept table, you can't add a new department unless a student enrolls in it. The department's existence depends on having at least one student — that's a design flaw.",
        beforeState: [
          {
            name: 'Student_Course_Dept',
            columns: ['student_id', 'student_name', 'course', 'dept_name', 'dept_location'],
            rows: [
              ['1', 'Alice', 'CS101', 'Computer Science', 'Building A'],
              ['1', 'Alice', 'CS102', 'Computer Science', 'Building A'],
              ['2', 'Bob', 'MATH101', 'Mathematics', 'Building B'],
            ],
          },
        ],
      },
      {
        id: 'u4l1s3',
        type: 'normalization',
        title: 'Update Anomaly',
        explanation:
          'An update anomaly occurs when you need to update the same fact in multiple rows. If the CS department moves to Building C, you must update every row with dept_name = "Computer Science". Miss one, and you have inconsistent data.',
        beforeState: [
          {
            name: 'Student_Course_Dept',
            columns: ['student_id', 'student_name', 'course', 'dept_name', 'dept_location'],
            rows: [
              ['1', 'Alice', 'CS101', 'Computer Science', 'Building C'],
              ['1', 'Alice', 'CS102', 'Computer Science', 'Building A'],
              ['2', 'Bob', 'MATH101', 'Mathematics', 'Building B'],
            ],
          },
        ],
        highlightedRows: [{ tableIndex: 0, rowIndices: [0, 1], color: 'red' }],
      },
      {
        id: 'u4l1s4',
        type: 'normalization',
        title: 'Delete Anomaly',
        explanation:
          'A delete anomaly occurs when deleting data causes unintended loss of other data. If Bob drops MATH101 and we delete his row, we lose all information about the Mathematics department. The department ceases to exist in our database!',
      },
      {
        id: 'u4l1s5',
        type: 'explanation',
        title: 'The Solution: Normalization',
        explanation:
          'Normalization is the process of decomposing tables to eliminate redundancy and anomalies. Each normal form (1NF → 2NF → 3NF → BCNF → 4NF → 5NF) addresses specific types of problems. In practice, most databases aim for 3NF or BCNF.',
      },
    ],
  },
  {
    slug: 'first-normal-form',
    title: 'First Normal Form (1NF)',
    description: 'Eliminate repeating groups and ensure atomic values.',
    steps: [
      {
        id: 'u4l2s1',
        type: 'explanation',
        title: '1NF Rules',
        explanation:
          'A table is in 1NF if: (1) All columns contain atomic (indivisible) values — no lists or sets in a single cell, (2) Each row is unique (has a primary key), (3) No repeating groups — each column has a single value per row.',
      },
      {
        id: 'u4l2s2',
        type: 'normalization',
        title: 'Violating 1NF',
        explanation:
          'This table violates 1NF because the "phones" column contains multiple values (a comma-separated list). Also, "courses" has multiple values. Each cell should hold exactly one value.',
        beforeState: [
          {
            name: 'Students (NOT 1NF)',
            columns: ['id', 'name', 'phones', 'courses'],
            rows: [
              ['1', 'Alice', '555-0101, 555-0102', 'CS101, CS102, MATH101'],
              ['2', 'Bob', '555-0201', 'CS101'],
            ],
          },
        ],
      },
      {
        id: 'u4l2s3',
        type: 'normalization',
        title: 'Converting to 1NF',
        explanation:
          'To reach 1NF: (1) Move multivalued attributes (phones) into a separate table, (2) Create one row per combination. The result has atomic values in every cell.',
        afterState: [
          {
            name: 'Students (1NF)',
            columns: ['id', 'name'],
            rows: [
              ['1', 'Alice'],
              ['2', 'Bob'],
            ],
          },
          {
            name: 'Student_Phones',
            columns: ['student_id', 'phone'],
            rows: [
              ['1', '555-0101'],
              ['1', '555-0102'],
              ['2', '555-0201'],
            ],
          },
          {
            name: 'Student_Courses',
            columns: ['student_id', 'course'],
            rows: [
              ['1', 'CS101'],
              ['1', 'CS102'],
              ['1', 'MATH101'],
              ['2', 'CS101'],
            ],
          },
        ],
      },
      {
        id: 'u4l2s4',
        type: 'sql',
        title: '1NF in SQL',
        explanation:
          "Here's how the 1NF-compliant schema looks in SQL. Each table has atomic values and a clear primary key.",
        command:
          'CREATE TABLE Students (\n  id INT PRIMARY KEY,\n  name VARCHAR(100)\n);\n\nCREATE TABLE Student_Phones (\n  student_id INT,\n  phone VARCHAR(20),\n  PRIMARY KEY (student_id, phone),\n  FOREIGN KEY (student_id) REFERENCES Students(id)\n);\n\nCREATE TABLE Student_Courses (\n  student_id INT,\n  course VARCHAR(20),\n  PRIMARY KEY (student_id, course),\n  FOREIGN KEY (student_id) REFERENCES Students(id)\n);',
      },
    ],
  },
  {
    slug: 'second-normal-form',
    title: 'Second Normal Form (2NF)',
    description: 'Remove partial dependencies on composite keys.',
    steps: [
      {
        id: 'u4l3s1',
        type: 'explanation',
        title: '2NF Rules',
        explanation:
          'A table is in 2NF if: (1) It is already in 1NF, and (2) Every non-key attribute is fully functionally dependent on the ENTIRE primary key. Partial dependencies (where a non-key attribute depends on only PART of a composite key) are not allowed.',
      },
      {
        id: 'u4l3s2',
        type: 'normalization',
        title: 'Partial Dependency Example',
        explanation:
          'In this table, the primary key is (student_id, course_id). But student_name depends only on student_id, not on the full key. Similarly, course_title depends only on course_id. These are partial dependencies.',
        beforeState: [
          {
            name: 'Enrollment (NOT 2NF)',
            columns: ['student_id', 'course_id', 'student_name', 'course_title', 'grade'],
            rows: [
              ['1', 'CS101', 'Alice', 'Databases', 'A'],
              ['1', 'CS102', 'Alice', 'Algorithms', 'B'],
              ['2', 'CS101', 'Bob', 'Databases', 'B'],
            ],
          },
        ],
        highlightedRows: [{ tableIndex: 0, rowIndices: [0, 1], color: 'yellow' }],
      },
      {
        id: 'u4l3s3',
        type: 'normalization',
        title: 'Decomposing to 2NF',
        explanation:
          'Remove partial dependencies by creating separate tables. student_name goes to Students (depends on student_id). course_title goes to Courses (depends on course_id). Only grade stays in Enrollment (depends on the full key).',
        afterState: [
          {
            name: 'Students',
            columns: ['student_id', 'student_name'],
            rows: [
              ['1', 'Alice'],
              ['2', 'Bob'],
            ],
          },
          {
            name: 'Courses',
            columns: ['course_id', 'course_title'],
            rows: [
              ['CS101', 'Databases'],
              ['CS102', 'Algorithms'],
            ],
          },
          {
            name: 'Enrollment (2NF)',
            columns: ['student_id', 'course_id', 'grade'],
            rows: [
              ['1', 'CS101', 'A'],
              ['1', 'CS102', 'B'],
              ['2', 'CS101', 'B'],
            ],
          },
        ],
      },
      {
        id: 'u4l3s4',
        type: 'explanation',
        title: 'Key Insight',
        explanation:
          '2NF only applies to tables with composite primary keys. Tables with a single-column primary key are automatically in 2NF (there\'s no "part" of the key to depend on). When you find a non-key column that depends on part of the composite key, split it out.',
      },
    ],
  },
  {
    slug: 'third-normal-form',
    title: 'Third Normal Form (3NF)',
    description: 'Eliminate transitive dependencies.',
    steps: [
      {
        id: 'u4l4s1',
        type: 'explanation',
        title: '3NF Rules',
        explanation:
          'A table is in 3NF if: (1) It is in 2NF, and (2) No non-key attribute transitively depends on the primary key. A transitive dependency is when A → B → C — attribute C depends on A through B. The fix: split B → C into its own table.',
      },
      {
        id: 'u4l4s2',
        type: 'normalization',
        title: 'Transitive Dependency Example',
        explanation:
          'In this table, emp_id → dept_id → dept_name, dept_location. The department info depends on dept_id (not directly on emp_id). This is a transitive dependency: dept_name and dept_location transitively depend on emp_id through dept_id.',
        beforeState: [
          {
            name: 'Employees (NOT 3NF)',
            columns: ['emp_id', 'emp_name', 'dept_id', 'dept_name', 'dept_location'],
            rows: [
              ['1', 'Alice', 'D1', 'Engineering', 'Floor 3'],
              ['2', 'Bob', 'D1', 'Engineering', 'Floor 3'],
              ['3', 'Carol', 'D2', 'Marketing', 'Floor 1'],
            ],
          },
        ],
      },
      {
        id: 'u4l4s3',
        type: 'normalization',
        title: 'Decomposing to 3NF',
        explanation:
          'Extract the transitive dependency into its own table. Department info (dept_name, dept_location) depends on dept_id, so create a Departments table. The Employees table keeps only the foreign key dept_id.',
        afterState: [
          {
            name: 'Employees (3NF)',
            columns: ['emp_id', 'emp_name', 'dept_id'],
            rows: [
              ['1', 'Alice', 'D1'],
              ['2', 'Bob', 'D1'],
              ['3', 'Carol', 'D2'],
            ],
          },
          {
            name: 'Departments',
            columns: ['dept_id', 'dept_name', 'dept_location'],
            rows: [
              ['D1', 'Engineering', 'Floor 3'],
              ['D2', 'Marketing', 'Floor 1'],
            ],
          },
        ],
      },
      {
        id: 'u4l4s4',
        type: 'explanation',
        title: '3NF Summary',
        explanation:
          'A simple way to remember 3NF (by Bill Kent): "Every non-key attribute must provide a fact about the key, the whole key, and nothing but the key." — 1NF: the key (1 fact per cell), 2NF: the whole key (no partial deps), 3NF: nothing but the key (no transitive deps).',
      },
    ],
  },
  {
    slug: 'bcnf',
    title: 'Boyce-Codd Normal Form (BCNF)',
    description: 'Ensure every determinant is a candidate key.',
    steps: [
      {
        id: 'u4l5s1',
        type: 'explanation',
        title: 'BCNF Definition',
        explanation:
          "BCNF is a stricter version of 3NF. A table is in BCNF if: for every functional dependency X → Y, X is a superkey (contains a candidate key). In 3NF, Y could be a prime attribute (part of a candidate key), but BCNF doesn't allow even that exception.",
      },
      {
        id: 'u4l5s2',
        type: 'normalization',
        title: '3NF but not BCNF',
        explanation:
          'Consider: Students can enroll in subjects, each taught by one teacher. FDs: {student, subject} → teacher, teacher → subject. Candidate key is {student, subject}. This is in 3NF (teacher is prime) but NOT in BCNF because teacher → subject and teacher is not a superkey.',
        beforeState: [
          {
            name: 'Teaching (3NF, not BCNF)',
            columns: ['student', 'subject', 'teacher'],
            rows: [
              ['Alice', 'Math', 'Dr. Smith'],
              ['Bob', 'Math', 'Dr. Smith'],
              ['Alice', 'Physics', 'Dr. Jones'],
              ['Carol', 'Math', 'Dr. Lee'],
            ],
          },
        ],
      },
      {
        id: 'u4l5s3',
        type: 'normalization',
        title: 'Decomposing to BCNF',
        explanation:
          'Decompose using the violating FD (teacher → subject). Create a table for teacher → subject, and another for student-teacher pairings.',
        afterState: [
          {
            name: 'Teacher_Subject',
            columns: ['teacher', 'subject'],
            rows: [
              ['Dr. Smith', 'Math'],
              ['Dr. Jones', 'Physics'],
              ['Dr. Lee', 'Math'],
            ],
          },
          {
            name: 'Student_Teacher',
            columns: ['student', 'teacher'],
            rows: [
              ['Alice', 'Dr. Smith'],
              ['Bob', 'Dr. Smith'],
              ['Alice', 'Dr. Jones'],
              ['Carol', 'Dr. Lee'],
            ],
          },
        ],
      },
      {
        id: 'u4l5s4',
        type: 'explanation',
        title: 'BCNF Trade-offs',
        explanation:
          "BCNF decomposition always eliminates redundancy but may not preserve all functional dependencies. In the example above, we can't directly enforce {student, subject} → teacher across the two tables. Sometimes 3NF is preferred when dependency preservation is important.",
      },
    ],
  },
  {
    slug: 'higher-normal-forms',
    title: 'Fourth & Fifth Normal Forms',
    description: 'Understand multivalued dependencies (4NF) and join dependencies (5NF).',
    steps: [
      {
        id: 'u4l6s1',
        type: 'explanation',
        title: 'Fourth Normal Form (4NF)',
        explanation:
          '4NF addresses multivalued dependencies (MVDs). A MVD X →→ Y means that for a given X, the set of Y values is independent of other attributes. A table is in 4NF if: (1) It is in BCNF, and (2) It has no non-trivial multivalued dependencies.',
      },
      {
        id: 'u4l6s2',
        type: 'normalization',
        title: 'MVD Example',
        explanation:
          'A professor teaches multiple courses and speaks multiple languages. These are independent facts: which courses they teach has nothing to do with which languages they speak. Storing both in one table creates redundancy.',
        beforeState: [
          {
            name: 'Prof_Course_Lang (NOT 4NF)',
            columns: ['professor', 'course', 'language'],
            rows: [
              ['Dr. Smith', 'Databases', 'English'],
              ['Dr. Smith', 'Databases', 'French'],
              ['Dr. Smith', 'AI', 'English'],
              ['Dr. Smith', 'AI', 'French'],
            ],
          },
        ],
      },
      {
        id: 'u4l6s3',
        type: 'normalization',
        title: 'Decomposing to 4NF',
        explanation:
          'Separate independent multivalued facts into their own tables. Each table captures one independent relationship.',
        afterState: [
          {
            name: 'Prof_Course',
            columns: ['professor', 'course'],
            rows: [
              ['Dr. Smith', 'Databases'],
              ['Dr. Smith', 'AI'],
            ],
          },
          {
            name: 'Prof_Language',
            columns: ['professor', 'language'],
            rows: [
              ['Dr. Smith', 'English'],
              ['Dr. Smith', 'French'],
            ],
          },
        ],
      },
      {
        id: 'u4l6s4',
        type: 'explanation',
        title: 'Fifth Normal Form (5NF)',
        explanation:
          '5NF (Project-Join Normal Form) deals with join dependencies. A table is in 5NF if every join dependency is implied by candidate keys. In simpler terms: the table cannot be further decomposed without losing information. 5NF is rarely needed in practice — most real-world designs stop at BCNF or 4NF.',
      },
      {
        id: 'u4l6s5',
        type: 'explanation',
        title: 'Normalization Summary',
        explanation:
          'The normalization hierarchy: UNF → 1NF (atomic values) → 2NF (no partial deps) → 3NF (no transitive deps) → BCNF (every determinant is a key) → 4NF (no MVDs) → 5NF (no join deps). In practice: aim for 3NF/BCNF. Higher forms are academic but important for understanding data dependencies.',
      },
    ],
  },
];
