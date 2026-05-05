# SQL Sandbox Audit — MySQL Emulator (Pass 4, Deep Review)

Date: 2026-05-08  

**Method:** End-to-end read of the `SqlExecutor` pipeline, `translateMySQL`, virtual `database-commands`, `alter-table-compat`, tokenizer/privilege code, post-exec error fallback, and the `tests/sql` suite. **Scope** matches Pass 3: **SQLite/sql.js is the intended free backend**; the product goal is to **emulate as much MySQL command surface as is reasonable**, not to host mysqld.

---

## Overall rating

**7.5 / 10** *(Pass 3: 7.3 / 10)*

**Rubric (explicit):**

- **9–10:** Near-complete coverage of emulatable `SHOW` / DDL / DCL plus few opaque SQLite errors.
- **7–8:** Strong pipeline; gaps mostly in long-tail syntax and metadata. **← current band (7.5).**
- **5–6:** Core DML only; little introspection or admin simulation.

This pass **raises** the score slightly versus Pass 3 after verifying **secondary systems** that are easy to miss in a shallow review: `detectMySqlCompatibilityFallback` (post–SQLite error hints for `ON DUPLICATE`, full-text, `REGEXP`, partitions, `WITH ROLLUP`, `JSON_TABLE`, etc.), a **substantial** `handleAlterTableCompatibility` (MODIFY/CHANGE/ADD/DROP column, RENAME, ADD/DROP index with limits), growing **compatibility tests** (119 total), and layered **unsupported** detection (`UNSUPPORTED_MYSQL_PATTERNS` + verb allowlist + SHOW-specific messages).

Remaining work is still **dominated** by unimplemented `SHOW` variants and MySQL-only expressions—not by lack of structure.

---

## Architecture snapshot (execution order)

For a single statement, the effective order is:

1. **PL/SQL block** path if applicable ([`isPlSqlBlock` / `runPlSqlBlock`](src/lib/engine/sql-executor/index.ts)).
2. **[`handleDatabaseCommand`](src/lib/engine/sql-executor/internal/database-commands.ts)** — users, grants, `CALL`, `USE`, `SHOW USERS` / `SHOW GRANTS`, MySQL-style `FLUSH PRIVILEGES`, multi-DB `ATTACH` / listing, and other virtual commands.
3. **[`handlePreparedStatementCommand`](src/lib/engine/sql-executor/index.ts)** — `SET @` session variables, `PREPARE` / `EXECUTE` / `DEALLOCATE` (in-memory; `EXECUTE` re-enters `execute()`).
4. **[`denyIfNoPrivilege`](src/lib/engine/sql-executor/index.ts)** — table targets from [`extractPrivilegeTableTargets`](src/lib/engine/sql-lexer.ts) or `requiredPrivilegeForSql`; default deny for non-admin when no mapping exists (with `PRIVILEGE_EXEMPT_VERBS` for TCL / `SET` / `USE` / `START`).
5. **[`handleAlterTableCompatibility`](src/lib/engine/sql-executor/internal/alter-table-compat.ts)** — emulated `ALTER` before raw SQLite.
6. **View rewrites** for simple single-table view DML ([`view-manager`](src/lib/engine/sql-executor/view-manager.ts)).
7. **[`translateMySQL`](src/lib/engine/sql-executor/translation.ts)** — SHOW stubs, TCL, SET no-ops / `FOREIGN_KEY_CHECKS`, strip/replace MySQL idioms, type rewrites, `ANY`/`SOME`/`ALL` via [`rewriteSubqueryOperators`](src/lib/engine/sql-executor/subquery-rewriter.ts), statistical aggregates.
8. **[`detectUnsupportedMySqlCommand`](src/lib/engine/sql-executor/index.ts)** — explicit server-only patterns, SQLite verb allowlist, SHOW variant messaging.
9. **`activeDb.exec`** — on failure, **[`detectMySqlCompatibilityFallback`](src/lib/engine/sql-executor/index.ts)** maps common SQLite syntax errors to MySQL-oriented explanations when regexes match.

This layering is **above average** for a WASM SQL tutor; the rating reflects **coverage breadth**, not absence of layers.

---

## Verification snapshot

- **Tests:** `npm test -- tests/sql` → **13 files, 119 tests passed** (suite grew vs Pass 3).
- **Files deeply reviewed:**  
  [`index.ts`](src/lib/engine/sql-executor/index.ts) · [`translation.ts`](src/lib/engine/sql-executor/translation.ts) · [`database-commands.ts`](src/lib/engine/sql-executor/internal/database-commands.ts) · [`alter-table-compat.ts`](src/lib/engine/sql-executor/internal/alter-table-compat.ts) · [`sql-lexer.ts`](src/lib/engine/sql-executor/sql-lexer.ts) · [`mysql-compat.ts`](src/lib/engine/sql-executor/mysql-compat.ts) · [`subquery-rewriter.ts`](src/lib/engine/sql-executor/subquery-rewriter.ts)

---

## Issues (ordered by criticality)

### 1) Critical — `SHOW` / catalog parity

**Implemented in [`translateMySQL`](src/lib/engine/sql-executor/translation.ts) (non-exhaustive):**  
`SHOW DATABASES`, `SHOW TABLES` / `SHOW FULL TABLES`, `SHOW COLUMNS`/`FIELDS FROM`, `DESC`/`DESCRIBE`/`EXPLAIN` table form, `SHOW CREATE TABLE`, `SHOW INDEX`/`INDEXES`/`KEYS FROM`, `SHOW TABLE STATUS`, `SHOW WARNINGS`/`ERRORS`, `SHOW ENGINES`, `SHOW CREATE DATABASE`, `SHOW PROCESSLIST`, `SHOW VARIABLES`/`STATUS` (stubs), plus `SHOW` handling augmented in [`database-commands`](src/lib/engine/sql-executor/internal/database-commands.ts) (e.g. `SHOW USERS`, `SHOW GRANTS`).

**Still high-impact gaps** (typical in dumps, tooling, and tutorials):  
`SHOW CREATE VIEW`, `SHOW TRIGGERS`, `SHOW PROCEDURE STATUS`, `SHOW FUNCTION STATUS`, `SHOW CREATE PROCEDURE` / `FUNCTION`, `SHOW OPEN TABLES`, `SHOW TABLE TYPES`, charset/collation listings, and qualified `db.table` / `IN db` forms that current single-line regexes do not accept.

**Impact:** Introspection-driven scripts **break early** even when the objects exist in `sqlite_master` or executor metadata.

**Mitigation direction:** Implement each as a small **virtual result** (query `sqlite_master`, `PRAGMA`, and stored procedure/function/trigger maps).

---

### 2) High — MySQL-only SQL features (rewrite + error quality)

**Prevention:** [`UNSUPPORTED_MYSQL_PATTERNS`](src/lib/engine/sql-executor/index.ts) blocks some server-only statements before execution.

**After SQLite failure:** [`detectMySqlCompatibilityFallback`](src/lib/engine/sql-executor/index.ts) explains several patterns: `ON DUPLICATE KEY UPDATE` limitations, `MATCH ... AGAINST`, `REGEXP`/`RLIKE`, `PARTITION`, `TABLESPACE`, `WITH ROLLUP`, `JSON_TABLE`.

**Gaps:** Anything **not** in those lists still surfaces as a raw SQLite error. Long tail includes additional functions, advanced JSON operators, spatial types, generated-column edge cases, etc.

**Impact:** “Paste from Stack Overflow” workloads remain **fragile** until either rewritten or caught by fallback hints.

---

### 3) High — `ON DUPLICATE KEY UPDATE` → SQLite upsert semantics

Translation rewrites to `ON CONFLICT DO UPDATE` ([`translation.ts`](src/lib/engine/sql-executor/translation.ts)). SQLite requires a **conflict target** compatible with the schema; MySQL’s duplicate-key rule can differ. Fallback messaging admits **limited emulation** ([`detectMySqlCompatibilityFallback`](src/lib/engine/sql-executor/index.ts)).

**Impact:** Valid MySQL upserts can **fail** on SQLite even after rewrite.

---

### 4) High — Lexer-driven privileges vs exotic SQL

[`extractPrivilegeTableTargets`](src/lib/engine/sql-lexer.ts) covers core read/DML + `TRUNCATE` in depth; `requiredPrivilegeForSql` extends coverage ([`index.ts`](src/lib/engine/sql-executor/index.ts)). Unusual syntactic shapes can still produce **conservative privilege mistakes** (false deny or over-broad allow in edge cases).

**Impact:** Matters most for **non-admin** sandboxes; default deny on unmapped verbs reduces silent bypass risk.

---

### 5) Medium — `ALTER TABLE` emulation scope

[`handleAlterTableCompatibility`](src/lib/engine/sql-executor/internal/alter-table-compat.ts) supports a **bounded** set: MODIFY/CHANGE column (rebuild), ADD COLUMN (with FIRST/AFTER), DROP COLUMN, RENAME TO, ADD/DROP INDEX-style operations; unknown segments return **`Unsupported ALTER TABLE operation segment`**.

**Impact:** MySQL migrations that mix unsupported alter clauses still stop with an explicit message—good— but **coverage** is not “all MySQL ALTER.”

---

### 6) Medium — Virtual multi-database vs MySQL catalogs

`SHOW DATABASES` returns the **active** DB name; `CREATE DATABASE`/`DROP DATABASE` are largely **virtual** ([`translation.ts`](src/lib/engine/sql-executor/translation.ts)). [`database-commands`](src/lib/engine/sql-executor/internal/database-commands.ts) adds `ATTACH`-based multi-db behavior for some flows.

**Impact:** Tools expecting a **large information_schema-style catalog** will not see full fidelity.

---

### 7) Medium — Triggers and stored routines

[`normalizeMySqlTriggerDefinition`](src/lib/engine/sql-executor/mysql-compat.ts) rejects several MySQL trigger body idioms. Procedures/functions work for supported subsets; parameter modes and bodies remain **partially** supported.

**Impact:** Routine-heavy dumps fail **more often** than OLTP CRUD.

---

### 8) Low — `RESET` / `FLUSH` / admin no-ops

[`translateMySQL`](src/lib/engine/sql-executor/translation.ts) treats some admin prefixes as **empty OK** results. That matches a sandbox with no server process but can **mask** MySQL subcommands users expected to do something observable.

---

### 9) Low — Prepared statements are session-local and simplified

In-memory `PREPARE`/`EXECUTE` does not replicate **full** MySQL wire/server semantics; adequate for most labs if documented.

---

## Strengths (confirmed in this pass)

- **Triple-line defense:** pre-check unsupported patterns, post-translate verb/show detection, **post-sqlite** compatibility fallback.
- **Real ALTER emulation** beyond naive passthrough, with explicit **unsupported segment** errors.
- **DML compatibility:** `INSERT IGNORE`, `REPLACE`, MySQL `LIMIT` offset form, `FOR UPDATE` strip, aggregate variance/stddev expansion, `ANY`/`SOME`/`ALL` rewrites, concat rules.
- **119** SQL-layer tests exercising executor, compatibility, routines, transactions, multidb, PL/SQL integration.

---

## Out of scope (honest stubs / rejects)

Replication admin, binary logs, `INSTALL PLUGIN`, server `LOAD DATA`/`LOAD XML`, `XA`, `HANDLER`, `SHUTDOWN`, `CLONE`, etc.—appropriate to reject or stub; **not** counted against the 7.5 for “wrong backend.”

---

## Final assessment

Pass 4 confirms the emulator is **engineered in depth** (not a thin regex wrapper). The score moves to **7.5** because those mechanisms were **fully credited** in the rubric. The **next leap** toward “almost all commands” is **quantitative:** implement the missing **SHOW** and catalog paths, then expand **rewrite/fallback** pairs for the highest-frequency MySQL-only constructs still hitting raw SQLite errors.
