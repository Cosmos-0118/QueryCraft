import type { Lesson } from '@/types/lesson';

export const unit5Lessons: Lesson[] = [
  {
    slug: 'transactions',
    title: 'Transactions & ACID Properties',
    description: 'Understand transaction states, ACID properties, and recovery.',
    steps: [
      {
        id: 'u5l1s1',
        type: 'explanation',
        title: 'What is a Transaction?',
        explanation:
          'A transaction is a logical unit of work that consists of one or more SQL operations. It either completes entirely (COMMIT) or is undone entirely (ROLLBACK). Example: transferring money requires debiting one account AND crediting another — both must succeed or neither should.',
      },
      {
        id: 'u5l1s2',
        type: 'explanation',
        title: 'ACID Properties',
        explanation:
          "Transactions guarantee four properties (ACID): Atomicity — all or nothing (if any part fails, the entire transaction rolls back). Consistency — the database moves from one valid state to another. Isolation — concurrent transactions don't interfere with each other. Durability — committed changes survive system crashes.",
      },
      {
        id: 'u5l1s3',
        type: 'sql',
        title: 'Transaction in SQL',
        explanation:
          'Use BEGIN/START TRANSACTION to start, COMMIT to save, and ROLLBACK to undo. SAVEPOINT allows partial rollback within a transaction.',
        command:
          'START TRANSACTION;\n\n-- Transfer $500 from Account 1 to Account 2\nUPDATE Accounts SET balance = balance - 500 WHERE id = 1;\nUPDATE Accounts SET balance = balance + 500 WHERE id = 2;\n\n-- If both succeed:\nCOMMIT;\n\n-- If something goes wrong:\n-- ROLLBACK;',
        beforeState: [
          {
            name: 'Accounts',
            columns: ['id', 'name', 'balance'],
            rows: [
              ['1', 'Alice', '1000'],
              ['2', 'Bob', '500'],
            ],
          },
        ],
        afterState: [
          {
            name: 'Accounts (After COMMIT)',
            columns: ['id', 'name', 'balance'],
            rows: [
              ['1', 'Alice', '500'],
              ['2', 'Bob', '1000'],
            ],
          },
        ],
        highlightedRows: [{ tableIndex: 0, rowIndices: [0, 1], color: 'yellow' }],
      },
      {
        id: 'u5l1s4',
        type: 'explanation',
        title: 'Transaction States',
        explanation:
          'A transaction goes through these states: Active (executing) → Partially Committed (all operations done, waiting for commit) → Committed (changes are permanent) OR Failed (an error occurred) → Aborted (changes rolled back). After abort, the transaction can be restarted or killed.',
      },
      {
        id: 'u5l1s5',
        type: 'explanation',
        title: 'Recovery Techniques',
        explanation:
          'Write-Ahead Logging (WAL): Before any change is written to disk, a log entry is written first. On crash: redo committed transactions (their changes may not have been flushed to disk) and undo uncommitted transactions (their partial changes must be removed). Checkpoints reduce recovery time by marking known-good points.',
      },
    ],
  },
  {
    slug: 'concurrency-control',
    title: 'Concurrency Control',
    description: 'Learn about locks, two-phase locking, timestamp ordering, and deadlocks.',
    steps: [
      {
        id: 'u5l2s1',
        type: 'explanation',
        title: 'Why Concurrency Control?',
        explanation:
          'When multiple transactions run simultaneously, problems can occur: Lost Update (two transactions overwrite each other), Dirty Read (reading uncommitted data), Non-repeatable Read (same query returns different results), Phantom Read (new rows appear between reads). Concurrency control prevents these.',
      },
      {
        id: 'u5l2s2',
        type: 'explanation',
        title: 'Lock-Based Protocols',
        explanation:
          'Locks control access to data: Shared Lock (S-lock) allows reading; multiple transactions can hold S-locks simultaneously. Exclusive Lock (X-lock) allows reading and writing; only one transaction can hold it. Before accessing data, a transaction must acquire the appropriate lock.',
      },
      {
        id: 'u5l2s3',
        type: 'explanation',
        title: 'Two-Phase Locking (2PL)',
        explanation:
          'A transaction follows growing and shrinking phases: Growing Phase — acquire locks, never release. Shrinking Phase — release locks, never acquire new ones. Once a lock is released, no new locks can be obtained. Strict 2PL holds all exclusive locks until COMMIT/ROLLBACK, preventing cascading rollbacks.',
      },
      {
        id: 'u5l2s4',
        type: 'explanation',
        title: 'Deadlocks',
        explanation:
          "Deadlock occurs when two or more transactions wait for each other's locks in a cycle. T1 holds lock on A, waits for B. T2 holds lock on B, waits for A. Neither can proceed. Solutions: (1) Deadlock detection — wait-for graph, abort one transaction. (2) Deadlock prevention — timestamp-based priority (Wait-Die, Wound-Wait). (3) Timeout — abort if waiting too long.",
      },
      {
        id: 'u5l2s5',
        type: 'explanation',
        title: 'Isolation Levels',
        explanation:
          'SQL defines four isolation levels (from weakest to strongest): READ UNCOMMITTED — allows dirty reads. READ COMMITTED — prevents dirty reads. REPEATABLE READ — prevents non-repeatable reads. SERIALIZABLE — prevents phantom reads (full isolation). Higher isolation = more correctness but less concurrency.',
      },
      {
        id: 'u5l2s6',
        type: 'sql',
        title: 'Setting Isolation Level',
        explanation:
          "You can set the isolation level per transaction. Choose based on your application's needs — most applications use READ COMMITTED or REPEATABLE READ.",
        command:
          '-- Set isolation level\nSET TRANSACTION ISOLATION LEVEL SERIALIZABLE;\n\nSTART TRANSACTION;\nSELECT * FROM Accounts WHERE balance > 1000;\n-- No other transaction can insert rows matching this condition\n-- until this transaction commits\nCOMMIT;',
      },
    ],
  },
  {
    slug: 'nosql-overview',
    title: 'NoSQL Databases',
    description: 'Explore document, key-value, column-family, and graph databases.',
    steps: [
      {
        id: 'u5l3s1',
        type: 'explanation',
        title: 'Why NoSQL?',
        explanation:
          'NoSQL (Not Only SQL) databases emerged to handle: massive scale (petabytes of data), high velocity (millions of reads/writes per second), flexible schemas (semi-structured or unstructured data), and distributed systems (data across many servers). They relax some relational guarantees for performance and scalability.',
      },
      {
        id: 'u5l3s2',
        type: 'explanation',
        title: 'Document Databases',
        explanation:
          'Document databases (MongoDB, CouchDB) store data as JSON/BSON documents. Each document can have a different structure — no fixed schema required. Great for: content management, catalogs, user profiles. Example: { "_id": 1, "name": "Alice", "courses": ["CS101", "MATH201"], "address": { "city": "NYC" } }.',
      },
      {
        id: 'u5l3s3',
        type: 'explanation',
        title: 'Key-Value Stores',
        explanation:
          "Key-Value databases (Redis, DynamoDB) are the simplest NoSQL model: every item is a key-value pair. The value is opaque — the database doesn't know or care about its structure. Extremely fast for lookups by key. Use cases: caching, session storage, real-time counters.",
      },
      {
        id: 'u5l3s4',
        type: 'explanation',
        title: 'Column-Family Stores',
        explanation:
          'Column-family databases (Cassandra, HBase) store data by columns rather than rows. Each row can have different columns. Optimized for: analytical queries on large datasets, time-series data, logging. Think of it as a multi-dimensional map: row_key → { column_family → { column → value } }.',
      },
      {
        id: 'u5l3s5',
        type: 'explanation',
        title: 'Graph Databases',
        explanation:
          'Graph databases (Neo4j, Amazon Neptune) store nodes (entities) and edges (relationships) as first-class concepts. Traversing relationships is extremely fast — O(1) per hop instead of expensive JOINs. Ideal for: social networks, recommendation engines, fraud detection, knowledge graphs.',
      },
      {
        id: 'u5l3s6',
        type: 'explanation',
        title: 'CAP Theorem',
        explanation:
          'The CAP theorem states that a distributed system can guarantee only 2 of 3 properties: Consistency (all nodes see the same data), Availability (every request gets a response), Partition Tolerance (system works despite network failures). Since partitions are inevitable, the real choice is: CP (consistent but may be unavailable) or AP (available but may be stale). Relational databases are typically CP; many NoSQL databases choose AP.',
      },
    ],
  },
];
