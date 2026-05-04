# SQL Sandbox Audit — MySQL Command Coverage (Breadth Pass)

Date: 2026-05-05  
Scope: End-to-end ability of the QueryCraft sandbox (`SqlExecutor` + UI) to **accept, translate, and run MySQL-oriented statements**, evaluated against the stated product goal of supporting **any and all** MySQL commands.

## Overall Rating

**5.4 / 10**

The stack is a strong **MySQL-flavored layer on SQLite (sql.js)** with deliberate virtual commands and regex-driven translation. It covers common tutorial and exam-style SQL well, but it is **not** a MySQL server and cannot honestly satisfy “any and all” MySQL commands without major architectural change or very large compatibility investment.

## Verification Snapshot

- Static review of execution pipeline and translation surface:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts) (`execute`, `loadSQL`, privilege gate, `translateMySQL` invocation)
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts) (SHOW/SET/transaction stubs, type and function rewrites)
  - [src/lib/engine/sql-executor/internal/database-commands.ts](src/lib/engine/sql-executor/internal/database-commands.ts) (virtual DCL/users/GRANT/CALL/USE, etc.)
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts) (`extractPrivilegeTableTargets`)
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts) (trigger normalization limits)
  - [src/lib/engine/sql-executor/statement-splitter.ts](src/lib/engine/sql-executor/statement-splitter.ts) (`DELIMITER`, routine/trigger blocks)
- Regression run:
  - `npm test -- tests/sql/executor/core/sql-executor-full-script.test.ts tests/sql/executor/privileges/sql-executor-dcl.test.ts`
  - Result: 2 files, 17 tests passed.

## Findings (Ordered by Criticality)

### 1) Critical (goal mismatch): Backend is SQLite, not MySQL

**Evidence**

- Execution ultimately calls `activeDb.exec(finalSql)` on a sql.js database after translation ([src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts)).
- Server-grade features (real replication, binlog, plugins, engines, privilege tables in `mysql` schema, XA, connection pooling semantics, etc.) cannot exist in this model.

**Impact**

- “Any and all commands” at **MySQL fidelity** is unattainable without embedding or proxying to real MySQL/MariaDB.



---

### 2) High: Large classes of MySQL syntax fall through to SQLite and fail

**Evidence**

- `translateMySQL` implements a **fixed list** of SHOW/SET/admin patterns and rewrites; anything else becomes SQLite-shaped SQL or passes through unchanged ([src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts)).
- Examples not handled there (e.g. many `SHOW …` variants such as `SHOW CREATE VIEW`, `SHOW TRIGGERS`, `SHOW FUNCTION STATUS`, partitioning DDL, `LOAD DATA`, handler statements, prepared-statement SQL) will typically hit SQLite and error.

**Impact**

- Users hitting “random” or advanced MySQL features see **opaque SQLite errors**, not a clear “unsupported in sandbox” signal.

**Recommendation**

- Add targeted translators or friendly error surfaces for high-traffic gaps; optionally detect unknown leading verbs and return structured “not implemented” messages.

---

### 3) Medium: Stored routines and triggers are intentionally partial

**Evidence**

- Trigger bodies reject several MySQL patterns (e.g. `SET NEW.` / `SET OLD.`, control-flow constructs) in compatibility classification ([src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts)).
- Procedures report unsupported parameter modes in some paths ([src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts) — `Procedure parameter mode … is not supported`).

**Impact**

- Valid MySQL definitions often **cannot be ported** without rewriting for SQLite constraints.

**Recommendation**

- Expand compatibility incrementally with tests per pattern; document limits next to the sandbox UI.

---

### 4) Medium: ALTER / DDL emulation vs native MySQL

**Evidence**

- `ALTER TABLE` compatibility is partially emulated via rebuild paths ([src/lib/engine/sql-executor/internal/alter-table-compat.ts](src/lib/engine/sql-executor/internal/alter-table-compat.ts), orchestrated from [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts)).

**Impact**

- Long-tail migrations may diverge from MySQL (indexes, constraints, defaults).

**Recommendation**

- Regression tests for chained ALTERs and metadata round-trips (already a sensible direction from prior audits).

---

### 5) Low: Authorization coverage does not track every SQL verb

**Evidence**

- Table-target extraction is lexer-driven for core DML/read verbs ([src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts)); other statements fall back to `requiredPrivilegeForSql`, which only maps a **subset** of leading verbs ([src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts)).
- Statements with **no derived targets** and **no mapped privilege** skip `denyIfNoPrivilege` entirely for non-admin users.

**Impact**

- For a **breadth** audit focused on “run anything,” this is secondary; for **locked-down** non-admin sandboxes, obscure verbs could **bypass** table/database privilege checks while still failing or succeeding at SQLite.

**Recommendation**

- Default-deny unknown verbs for non-admin users or extend privilege mapping (separate from MySQL parity).

---

## Strengths (Breadth)

- Rich **virtual** handling for users, grants, SHOW stubs, transactions, and common MySQL_session idioms ([src/lib/engine/sql-executor/internal/database-commands.ts](src/lib/engine/sql-executor/internal/database-commands.ts), [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts)).
- **Statement splitting** supports `DELIMITER`, triggers, procedures, and PL/SQL-style blocks ([src/lib/engine/sql-executor/statement-splitter.ts](src/lib/engine/sql-executor/statement-splitter.ts)).
- **Regression coverage** for multi-statement scripts and DCL remains green (see Verification Snapshot).

## Final Assessment

For **everyday MySQL-like workloads** (schemas, CRUD, common SHOW/DESC, transactions, many tutorials), the sandbox is capable and improving. For the literal requirement **any and all MySQL commands**, the rating stays **moderate**: the architecture caps fidelity, unhandled syntax is large, and SQLite remains the source of truth at execution time. Closing the gap is a **product scope** decision (document limits vs invest in translators vs ship a real MySQL-backed mode).
