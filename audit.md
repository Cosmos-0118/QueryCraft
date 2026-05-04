# MySQL Sandbox Audit Report

Date: 2026-05-04
Scope: QueryCraft SQL sandbox engine, parser/translator, persistence flow, and sandbox integration.

## Overall Rating

**6.3 / 10**

The sandbox is feature-rich and has strong baseline test coverage (87 passing tests across executor/splitter/plsql suites), but there are several correctness and security-model gaps that can cause compatibility drift or policy bypasses in realistic MySQL usage.

## Method Used

- Static audit of core paths:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts)
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts)
  - [src/lib/engine/sql-executor/statement-splitter.ts](src/lib/engine/sql-executor/statement-splitter.ts)
  - [src/lib/engine/sql-executor/plsql-runtime.ts](src/lib/engine/sql-executor/plsql-runtime.ts)
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts)
  - [src/hooks/use-sql-engine.ts](src/hooks/use-sql-engine.ts)
  - [src/app/(dashboard)/sandbox/page.tsx](src/app/%28dashboard%29/sandbox/page.tsx)
- Dynamic baseline run:
  - `npm test -- tests/unit/sql-executor*.test.ts tests/unit/sql-splitter.test.ts tests/unit/plsql-runtime.test.ts`
  - Result: 13 test files, 87 tests passed.

## Findings (Ordered by Criticality)

## 1) Critical: Global regex translation mutates SQL semantics outside DDL

**Evidence**
- Translator applies broad token rewrites for all statements, not just DDL:
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts#L455)
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts#L456)
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts#L472)
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts#L494)

**Why this matters**
- Data type/function token replacement can alter literals and identifiers in non-DDL SQL.
- Examples at risk: values/identifiers containing `DATE`, `TIME`, `JSON`, backticks, etc.
- This creates silent correctness drift and potential data corruption.

**Recommendation**
- Tokenize SQL and restrict type rewrites to schema-definition contexts (`CREATE TABLE`, `ALTER TABLE`).
- Do not perform global lexical replacement over full statement text.

---

## 2) Critical: Table-level privilege model can be bypassed on multi-table queries

**Evidence**
- Privilege check infers only one target table via simple regex:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1252)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1256)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1262)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L2917)

**Why this matters**
- JOIN/subquery/CTE statements can reference additional tables that are never checked.
- Users with `SELECT` on one table may be able to read data from other tables in the same query.

**Recommendation**
- Parse and evaluate all referenced tables for SELECT/UPDATE/DELETE/INSERT statements.
- Enforce privilege checks against the full table set, not first match.

---

## 3) High: Comment stripping is not SQL-string aware

**Evidence**
- Global regex stripping in utility:
  - [src/lib/engine/sql-executor/utils.ts](src/lib/engine/sql-executor/utils.ts#L21)
- Translation always starts from stripped text:
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts#L110)

**Why this matters**
- `--` or `/* ... */` inside string literals can be removed as comments.
- Valid SQL can become malformed or semantically altered before execution.

**Recommendation**
- Replace regex stripping with lexer-aware comment handling that respects string/identifier contexts.

---

## 4) High: Multi-database persistence can replay statements in the wrong DB context

**Evidence**
- Statement persistence stores the current ref database for each statement result:
  - [src/hooks/use-sql-engine.ts](src/hooks/use-sql-engine.ts#L574)
  - [src/hooks/use-sql-engine.ts](src/hooks/use-sql-engine.ts#L580)
- Replay executes per persisted `record.database`:
  - [src/hooks/use-sql-engine.ts](src/hooks/use-sql-engine.ts#L211)
  - [src/hooks/use-sql-engine.ts](src/hooks/use-sql-engine.ts#L236)
  - [src/hooks/use-sql-engine.ts](src/hooks/use-sql-engine.ts#L248)

**Why this matters**
- If a script switches database using `USE ...` mid-batch, persisted entries may keep pre-switch DB context.
- Replay can rebuild objects in the wrong database.

**Recommendation**
- Persist per-statement execution database from executor state after each statement.
- Include effective database in `statementResults` and use that during replay.

---

## 5) High: Trigger normalization changes execution semantics

**Evidence**
- `SET NEW.col = ...` rewritten to UPDATE-by-rowid:
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts#L33)
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts#L43)
- BEFORE triggers may be forced to AFTER:
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts#L110)

**Why this matters**
- BEFORE semantics, constraint timing, and row identity behavior can diverge from MySQL.
- Rowid-based mutation assumptions may fail on edge schemas and advanced trigger bodies.

**Recommendation**
- Explicitly gate unsupported trigger forms with clear errors.
- Preserve BEFORE/AFTER semantics where possible; avoid implicit semantic rewrites.

---

## 6) High: Procedure/function parameter substitution is lexical, not syntax-aware

**Evidence**
- Regex replacement by word-boundary over full body text:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L859)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L878)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L882)

**Why this matters**
- Parameter names can be replaced inside string literals, aliases, or unintended tokens.
- This can produce malformed SQL or behavior drift in stored routine execution.

**Recommendation**
- Perform bind substitution with parser/token awareness.
- Restrict replacement to identifier tokens in expression contexts only.

---

## 7) Medium: DROP DATABASE metadata cleanup omits stored functions

**Evidence**
- DROP DATABASE cleanup removes procedures/triggers/cursors but not functions:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L2065)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L2070)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L2075)

**Why this matters**
- Function metadata can outlive dropped databases, causing stale references and memory/state drift.

**Recommendation**
- Add function-map cleanup in DROP DATABASE path by database prefix.

---

## 8) Medium: SQL splitters are not fully MySQL-accurate for comments/escaping

**Evidence**
- Statement splitter treats any `--` as line comment marker:
  - [src/lib/engine/sql-executor/statement-splitter.ts](src/lib/engine/sql-executor/statement-splitter.ts#L130)
- Runtime splitter has similar behavior and quote toggling without escape handling:
  - [src/lib/engine/sql-executor/plsql-runtime.ts](src/lib/engine/sql-executor/plsql-runtime.ts#L128)
  - [src/lib/engine/sql-executor/plsql-runtime.ts](src/lib/engine/sql-executor/plsql-runtime.ts#L146)

**Why this matters**
- MySQL `--` comment rules and escaped-quote handling are stricter than current parser logic.
- Edge-case scripts can split incorrectly.

**Recommendation**
- Use a unified lexer that supports MySQL comment rules and escaped string semantics.

---

## 9) Low: Duplicate CREATE FUNCTION parsing branches increase divergence risk

**Evidence**
- Two separate CREATE FUNCTION blocks in same command handler:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L2254)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L2328)

**Why this matters**
- Parallel logic paths are easy to drift and can produce inconsistent behavior over time.

**Recommendation**
- Consolidate CREATE FUNCTION parsing to one canonical path.

---

## 10) Low: User spec string construction in sandbox UI is not escaped

**Evidence**
- Raw interpolation for `SHOW GRANTS FOR` user spec:
  - [src/app/(dashboard)/sandbox/page.tsx](src/app/%28dashboard%29/sandbox/page.tsx#L464)
  - [src/app/(dashboard)/sandbox/page.tsx](src/app/%28dashboard%29/sandbox/page.tsx#L476)

**Why this matters**
- Quoted usernames/hosts containing special characters can generate malformed SQL in UI-issued grant queries.

**Recommendation**
- Escape single quotes when constructing SQL user specs in UI helper.

---

## Strengths Observed

- Broad compatibility test coverage for core SQL executor features.
- Clear error classification pipeline and error enrichment.
- Multi-database/session persistence architecture is robust in standard flows.
- Good modular decomposition of translator/splitter/runtime components.
