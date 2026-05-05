# SQL Sandbox Audit — MySQL Command Coverage (Emulator Pass 3)

Date: 2026-05-07  

## Evaluation scope

QueryCraft intentionally runs **SQLite (sql.js)** in-process: it is the **practical free option** for a browser-friendly SQL sandbox. This audit does **not** treat that as a defect.

Instead we measure progress toward **supporting almost all MySQL commands that can be meaningfully emulated** here: translation + virtual handlers + stubs + clear rejection for **true server-only** operations (replication, plugins, binary logs, `LOAD DATA` against server files, etc.).

**Goal:** maximize coverage of MySQL **syntax and introspection** users hit in tutorials, coursework, and scripts—not parity with a networked mysqld process.

---

## Overall rating

**7.3 / 10**

Solid core path (`translateMySQL`, `database-commands`, prepared statements, unsupported-pattern detection, regression tests). The remaining gap is mostly **breadth**: many `SHOW …` / metadata / DDL variants still fall through to SQLite or generic errors. Closing those systematically is the highest leverage work toward “almost all commands.”

---

## Verification snapshot

- Reviewed execution pipeline and compatibility surfaces:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts) (`execute`, prepared statements, `detectUnsupportedMySqlCommand`, `UNSUPPORTED_MYSQL_PATTERNS`, privilege defaults)
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts)
  - [src/lib/engine/sql-executor/internal/database-commands.ts](src/lib/engine/sql-executor/internal/database-commands.ts)
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts)
  - [src/lib/engine/sql-executor/internal/alter-table-compat.ts](src/lib/engine/sql-executor/internal/alter-table-compat.ts)
- Tests: `npm test -- tests/sql` → **13 files, 109 tests passed.**

---

## Issues (ordered by criticality)

Issues below are **compatibility gaps** relative to the “almost all MySQL commands” goal on the SQLite backend—not complaints about using SQLite.

### 1) Critical — `SHOW` / introspection long tail

**What’s wrong**

- `translateMySQL` implements a **fixed set** of `SHOW` branches ([translation.ts](src/lib/engine/sql-executor/translation.ts)): e.g. `SHOW DATABASES`, `SHOW TABLES`, `SHOW COLUMNS`/`DESC`, `SHOW CREATE TABLE`, index listings, `SHOW TABLE STATUS`, engines, processlist, variables/status stubs, etc.
- Many common MySQL introspection commands are **not** explicitly handled (examples users still hit): `SHOW CREATE VIEW`, `SHOW TRIGGERS`, `SHOW PROCEDURE STATUS`, `SHOW FUNCTION STATUS`, `SHOW CREATE PROCEDURE` / `FUNCTION`, charset/collation listings, and qualified forms (`db.table`) beyond what regexes accept.

**Impact**

- Scripts and dumps that rely on metadata discovery **fail or degrade** even when the underlying objects exist in SQLite form.

**Direction**

- Add translators that map each high-traffic `SHOW` to `sqlite_master` / `PRAGMA` / executor metadata (procedures, functions, triggers already tracked in executor state).

---

### 2) High — DDL / DML edge syntax vs SQLite

**What’s wrong**

- MySQL-specific DDL (partitioning clauses, some full-text / spatial assumptions, engine/tablespace idioms) is only partially stripped or rewritten; anything unrecognized may reach SQLite and fail opaquely.
- `ALTER TABLE` complex migrations often go through emulation paths ([alter-table-compat.ts](src/lib/engine/sql-executor/internal/alter-table-compat.ts)); edge cases can diverge from MySQL.

**Impact**

- Schema migrations from real MySQL dumps **break at first unsupported clause** unless extended incrementally.

**Direction**

- Expand rewrite coverage with **targeted tests per clause**; prefer friendly parser-level errors listing the unsupported fragment.

---

### 3) High — Fallthrough to SQLite before user-understandable messaging

**What’s wrong**

- After translation, many statements still execute as SQLite SQL; failures surface as **SQLite syntax errors** unless caught earlier by `detectUnsupportedMySqlCommand` ([index.ts](src/lib/engine/sql-executor/index.ts)).

**Impact**

- Users cannot tell whether the problem is “not implemented in emulator” vs “invalid SQL.”

**Direction**

- Expand detection for known-bad categories; optionally wrap SQLite errors with a short hint when input matched MySQL-shaped patterns.

---

### 4) Medium — Stored programs and triggers (subset support)

**What’s wrong**

- Trigger normalization rejects several valid MySQL trigger body shapes ([mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts)).
- Procedures/functions may hit mode limitations (`IN`/`OUT` / body features) depending on path.

**Impact**

- **Routine-heavy** dumps are more likely to fail than OLTP-style CRUD.

**Direction**

- Incremental compatibility: one pattern at a time with regression tests under `tests/sql/executor/routines/`.

---

### 5) Medium — Prepared statements and session semantics

**What’s wrong**

- Client-side `PREPARE` / `EXECUTE` / `DEALLOCATE` and `@variable` handling ([index.ts](src/lib/engine/sql-executor/index.ts)) cover common lab scenarios but are not full MySQL server semantics.

**Impact**

- Rare edge cases (optimizer behavior, every binding rule) differ; acceptable for most education use if documented.

---

### 6) Low — Maintenance of explicit “server-only” rejects

**What’s wrong**

- `UNSUPPORTED_MYSQL_PATTERNS` ([index.ts](src/lib/engine/sql-executor/index.ts)) must grow when new server-only syntax appears.

**Impact**

- Occasional generic failures until patterns are added.

**Note:** Rejecting replication/plugins/`LOAD DATA` file IO as **unsupported in sandbox** is correct; optionally return **consistent stub responses** where a no-op is safer than failure.

---

### 7) Low — Privilege model vs exotic verbs (non-admin)

**What’s wrong**

- Non-admin users hit **default deny** when privileges cannot be derived; exempt verbs include TCL/`SET`/`USE` ([`PRIVILEGE_EXEMPT_VERBS`](src/lib/engine/sql-executor/index.ts)).

**Impact**

- Mostly orthogonal to “command coverage” for the default admin sandbox; matters for multi-user / restricted demos.

---

## Out of scope for “almost all commands” (acceptable stubs / rejects)

These require a **real MySQL server** or OS-level resources; emulating them beyond **clear errors or harmless stubs** is optional:

- Replication control, binary log administration, `INSTALL PLUGIN`, `SHUTDOWN`, `CLONE`, `XA`, `HANDLER`, server-side `LOAD DATA` / `LOAD XML`.

Treat these as **documented limitations**, not failures of the SQLite strategy.

---

## Strengths

- Broad virtual layer for users, grants, many `SHOW` stubs, TCL, `SET` session no-ops, admin-command simulation ([database-commands.ts](src/lib/engine/sql-executor/internal/database-commands.ts), [translation.ts](src/lib/engine/sql-executor/translation.ts)).
- Explicit **unsupported** classification for several server-only patterns ([index.ts](src/lib/engine/sql-executor/index.ts)).
- **109** SQL tests passing — good safety net for incremental expansion.

---

## Final assessment

Using **SQLite as the only free, embeddable backend** is the right foundation. The roadmap to “almost all” MySQL commands is **not** swapping engines—it is **systematically shrinking** the unsupported surface: prioritize **`SHOW` / metadata parity**, then **DDL edge rewrites**, then **routines/triggers**. The **7.3** rating reflects strong infrastructure and clear remaining breadth work, not regret over SQLite.
