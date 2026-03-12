import type { Lesson } from '@/types/lesson';

export const unit1Lessons: Lesson[] = [
  {
    slug: 'intro-to-databases',
    title: 'Introduction to Databases',
    description: 'Learn what databases are, why they matter, and how they evolved.',
    steps: [
      {
        id: 'u1l1s1',
        type: 'explanation',
        title: 'What is a Database?',
        explanation:
          'A database is an organized collection of structured data stored electronically. Before databases, data was stored in flat files — simple text files with no relationships or structure. Databases solve the problems of data redundancy, inconsistency, and difficulty in accessing data.',
      },
      {
        id: 'u1l1s2',
        type: 'explanation',
        title: 'File System vs DBMS',
        explanation:
          "A Database Management System (DBMS) provides several advantages over a raw file system: (1) Data Independence — programs don't need to know how data is stored, (2) Reduced Redundancy — data is stored once and shared, (3) Consistency — rules ensure data integrity, (4) Concurrent Access — multiple users can access data simultaneously, (5) Security — fine-grained access control.",
      },
      {
        id: 'u1l1s3',
        type: 'explanation',
        title: 'Types of Databases',
        explanation:
          'Databases come in many forms: Relational (MySQL, PostgreSQL) store data in tables with rows and columns. Document databases (MongoDB) store JSON-like documents. Key-Value stores (Redis) map keys to values. Graph databases (Neo4j) model relationships between entities. Column-family stores (Cassandra) organize data by columns for fast analytics.',
      },
      {
        id: 'u1l1s4',
        type: 'sql',
        title: 'Your First Table',
        explanation:
          "In a relational database, data is organized into tables (also called relations). Each table has columns (attributes) and rows (tuples). Let's create a simple Students table.",
        command:
          'CREATE TABLE Students (\n  id INT PRIMARY KEY,\n  name VARCHAR(100),\n  age INT,\n  major VARCHAR(50)\n);',
        afterState: [
          {
            name: 'Students',
            columns: ['id', 'name', 'age', 'major'],
            rows: [],
          },
        ],
      },
      {
        id: 'u1l1s5',
        type: 'sql',
        title: 'Inserting Data',
        explanation:
          'Once a table is created, we can insert rows of data into it. Each row represents one entity — in this case, one student.',
        command:
          "INSERT INTO Students VALUES\n  (1, 'Alice', 20, 'CS'),\n  (2, 'Bob', 21, 'Math'),\n  (3, 'Carol', 19, 'Physics');",
        afterState: [
          {
            name: 'Students',
            columns: ['id', 'name', 'age', 'major'],
            rows: [
              ['1', 'Alice', '20', 'CS'],
              ['2', 'Bob', '21', 'Math'],
              ['3', 'Carol', '19', 'Physics'],
            ],
          },
        ],
      },
      {
        id: 'u1l1s6',
        type: 'sql',
        title: 'Querying Data',
        explanation:
          'The SELECT statement retrieves data from a table. You can filter rows with WHERE, and choose specific columns to display.',
        command: 'SELECT name, major FROM Students WHERE age >= 20;',
        beforeState: [
          {
            name: 'Students',
            columns: ['id', 'name', 'age', 'major'],
            rows: [
              ['1', 'Alice', '20', 'CS'],
              ['2', 'Bob', '21', 'Math'],
              ['3', 'Carol', '19', 'Physics'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Result',
            columns: ['name', 'major'],
            rows: [
              ['Alice', 'CS'],
              ['Bob', 'Math'],
            ],
          },
        ],
        highlightedRows: [{ tableIndex: 0, rowIndices: [0, 1], color: 'green' }],
      },
    ],
  },
  {
    slug: 'data-models',
    title: 'Data Models',
    description:
      'Explore the different data models: hierarchical, network, relational, and object-oriented.',
    steps: [
      {
        id: 'u1l2s1',
        type: 'explanation',
        title: 'What is a Data Model?',
        explanation:
          'A data model defines how data is structured, stored, and manipulated. It provides a conceptual framework that determines the logical structure of a database. The three levels are: Conceptual (what data to store), Logical (how data relates), and Physical (how data is stored on disk).',
      },
      {
        id: 'u1l2s2',
        type: 'explanation',
        title: 'Hierarchical Model',
        explanation:
          'The hierarchical model (1960s, IBM IMS) organizes data in a tree structure. Each record has exactly one parent. Good for one-to-many relationships (e.g., Department → Employees). Limitation: cannot easily represent many-to-many relationships. Navigation is top-down only.',
      },
      {
        id: 'u1l2s3',
        type: 'explanation',
        title: 'Network Model',
        explanation:
          'The network model (CODASYL) extends the hierarchical model by allowing records to have multiple parents, forming a graph structure. It supports many-to-many relationships but requires complex pointer-based navigation. Programs must know the physical data paths.',
      },
      {
        id: 'u1l2s4',
        type: 'explanation',
        title: 'Relational Model',
        explanation:
          'Proposed by E.F. Codd in 1970, the relational model stores data in tables (relations). Each table has a fixed set of columns and a varying set of rows. Relationships between tables use foreign keys. The power: you query WHAT you want, not HOW to get it (declarative). This is the foundation of SQL.',
      },
      {
        id: 'u1l2s5',
        type: 'sql',
        title: 'Relational Model in Action',
        explanation:
          'In the relational model, we define relationships using foreign keys. Here, each Course references a Department. The DBMS enforces this relationship automatically.',
        command:
          'CREATE TABLE Departments (\n  dept_id INT PRIMARY KEY,\n  name VARCHAR(50)\n);\n\nCREATE TABLE Courses (\n  course_id INT PRIMARY KEY,\n  title VARCHAR(100),\n  dept_id INT,\n  FOREIGN KEY (dept_id) REFERENCES Departments(dept_id)\n);',
        afterState: [
          {
            name: 'Departments',
            columns: ['dept_id', 'name'],
            rows: [],
          },
          {
            name: 'Courses',
            columns: ['course_id', 'title', 'dept_id'],
            rows: [],
          },
        ],
      },
      {
        id: 'u1l2s6',
        type: 'explanation',
        title: 'Object-Oriented & Object-Relational',
        explanation:
          'The Object-Oriented model stores data as objects (like in OOP) with inheritance and encapsulation. The Object-Relational model (used by PostgreSQL) combines relational tables with object features like custom types and inheritance. Modern databases often blend multiple models.',
      },
    ],
  },
  {
    slug: 'database-architecture',
    title: 'Database Architecture',
    description: 'Understand the three-schema architecture and data independence.',
    steps: [
      {
        id: 'u1l3s1',
        type: 'explanation',
        title: 'Three-Schema Architecture',
        explanation:
          'The ANSI/SPARC three-schema architecture separates a database into three levels: (1) External Level — how individual users see the data (views), (2) Conceptual Level — the logical structure of the entire database, (3) Internal Level — how data is physically stored on disk. This separation provides data independence.',
      },
      {
        id: 'u1l3s2',
        type: 'explanation',
        title: 'External Level (Views)',
        explanation:
          'The external level consists of views — virtual tables that show a subset of data tailored to specific users. A student sees their grades; an admin sees all students. Views provide security (hide sensitive columns) and simplicity (show only relevant data).',
      },
      {
        id: 'u1l3s3',
        type: 'sql',
        title: 'Creating a View',
        explanation:
          'A view is a saved SELECT query that behaves like a virtual table. Users query the view without knowing the underlying table structure.',
        command: "CREATE VIEW CS_Students AS\nSELECT name, age FROM Students\nWHERE major = 'CS';",
        beforeState: [
          {
            name: 'Students',
            columns: ['id', 'name', 'age', 'major'],
            rows: [
              ['1', 'Alice', '20', 'CS'],
              ['2', 'Bob', '21', 'Math'],
              ['3', 'Carol', '19', 'CS'],
            ],
          },
        ],
        afterState: [
          {
            name: 'CS_Students (View)',
            columns: ['name', 'age'],
            rows: [
              ['Alice', '20'],
              ['Carol', '19'],
            ],
          },
        ],
      },
      {
        id: 'u1l3s4',
        type: 'explanation',
        title: 'Logical Data Independence',
        explanation:
          'Logical data independence means you can change the conceptual schema (e.g., split a table, add columns) without affecting external views. Applications using views continue to work even if the underlying tables are restructured.',
      },
      {
        id: 'u1l3s5',
        type: 'explanation',
        title: 'Physical Data Independence',
        explanation:
          'Physical data independence means you can change how data is stored (e.g., add indexes, change storage engine, move to SSD) without changing the logical schema. The SQL queries remain the same regardless of physical storage changes.',
      },
      {
        id: 'u1l3s6',
        type: 'explanation',
        title: 'Database Users & Roles',
        explanation:
          'A DBMS supports different user roles: Database Administrator (DBA) manages the overall system. Database Designers define the schema. Application Programmers write programs that access the database. End Users interact through applications or direct queries.',
      },
    ],
  },
  {
    slug: 'er-diagrams',
    title: 'Entity-Relationship Diagrams',
    description:
      'Learn to design databases using ER diagrams with entities, attributes, and relationships.',
    steps: [
      {
        id: 'u1l4s1',
        type: 'explanation',
        title: 'What is an ER Diagram?',
        explanation:
          'An Entity-Relationship (ER) Diagram is a visual tool for database design. Proposed by Peter Chen in 1976, it models the real world as entities (things), attributes (properties), and relationships (associations). ER diagrams are created before writing SQL — they form the conceptual design.',
      },
      {
        id: 'u1l4s2',
        type: 'diagram',
        title: 'Entities',
        explanation:
          'An entity is a distinguishable object in the real world — a person, place, event, or concept. In ER diagrams, entities are drawn as rectangles. Strong entities exist independently (Student, Course). Weak entities depend on another entity for identification (drawn with double rectangles).',
      },
      {
        id: 'u1l4s3',
        type: 'diagram',
        title: 'Attributes',
        explanation:
          'Attributes describe properties of entities. Types: Simple (age), Composite (name → first + last), Multivalued (phone numbers — double oval), Derived (age from birthdate — dashed oval), Key attribute (uniquely identifies entity — underlined). In ER diagrams, attributes are drawn as ovals connected to their entity.',
      },
      {
        id: 'u1l4s4',
        type: 'diagram',
        title: 'Relationships',
        explanation:
          'A relationship is an association between entities, drawn as a diamond. Examples: Student "enrolls in" Course. Relationships have cardinality constraints: 1:1 (one-to-one), 1:N (one-to-many), M:N (many-to-many). They can also have attributes (e.g., enrollment date).',
      },
      {
        id: 'u1l4s5',
        type: 'diagram',
        title: 'Cardinality & Participation',
        explanation:
          'Cardinality defines how many entities participate: 1:1 (one person has one passport), 1:N (one department has many employees), M:N (students enroll in many courses, courses have many students). Participation: Total (every entity must participate — double line) vs Partial (some may not — single line).',
      },
      {
        id: 'u1l4s6',
        type: 'sql',
        title: 'From ER to Tables',
        explanation:
          'Each entity becomes a table. Attributes become columns. The key attribute becomes the primary key. For 1:N relationships, the foreign key goes on the "many" side. For M:N relationships, create a junction table.',
        command:
          'CREATE TABLE Student (\n  student_id INT PRIMARY KEY,\n  name VARCHAR(100),\n  email VARCHAR(100)\n);\n\nCREATE TABLE Course (\n  course_id INT PRIMARY KEY,\n  title VARCHAR(100),\n  credits INT\n);\n\nCREATE TABLE Enrollment (\n  student_id INT,\n  course_id INT,\n  grade CHAR(2),\n  PRIMARY KEY (student_id, course_id),\n  FOREIGN KEY (student_id) REFERENCES Student(student_id),\n  FOREIGN KEY (course_id) REFERENCES Course(course_id)\n);',
        afterState: [
          {
            name: 'Student',
            columns: ['student_id', 'name', 'email'],
            rows: [],
          },
          {
            name: 'Course',
            columns: ['course_id', 'title', 'credits'],
            rows: [],
          },
          {
            name: 'Enrollment',
            columns: ['student_id', 'course_id', 'grade'],
            rows: [],
          },
        ],
      },
    ],
  },
];
