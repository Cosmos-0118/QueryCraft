# MySQL Sandbox Re-Audit Report (Post-Fix)

Date: 2026-05-04
Scope: QueryCraft SQL sandbox engine, parser/translator, privilege model, and sandbox persistence/integration.

## Overall Rating

**7.8 / 10**

The previous round of hardening closed most of the earlier high-risk issues, and the targeted regression suite is now broadly stable. One critical authorization flaw still remains, with a few medium/low compatibility gaps.

## Verification Snapshot

- Static re-review of:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts)
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts)
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts)
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts)
  - [src/lib/engine/sql-error-engine.ts](src/lib/engine/sql-error-engine.ts)
  - [src/hooks/use-sql-engine.ts](src/hooks/use-sql-engine.ts)
  - [src/app/(dashboard)/sandbox/page.tsx](src/app/%28dashboard%29/sandbox/page.tsx)
- Regression run:
  - `npm test -- tests/unit/sql-executor*.test.ts tests/unit/sql-splitter.test.ts tests/unit/plsql-runtime.test.ts`
  - Result: 13 test files, 94 tests passed.
- Focused privilege probe (ad-hoc, not committed):
  - A `SELECT`-only user was able to execute `WITH t AS (...) DELETE ...`, confirming a residual privilege bypass path.

## Findings (Ordered by Criticality)

## 1) Critical: CTE-prefixed DML can bypass privilege verb classification

**Evidence**
- Privilege detection marks any statement matching `WITH ... SELECT` as `SELECT`:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1207)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1211)
- Authorization enforcement relies on that classification:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1277)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1278)

**Impact**
- Statements like `WITH cte AS (SELECT ...) DELETE ...`, `WITH ... UPDATE ...`, or `WITH ... INSERT ...` can be evaluated under `SELECT` privilege requirements.
- This is a direct authorization bypass for non-admin users with limited grants.

**Recommendation**
- For `WITH` statements, parse through the full CTE list and classify by the first top-level executable verb after the CTE clause.
- Add explicit regression tests for `WITH ... DELETE/UPDATE/INSERT` under restricted users.

---

## 2) Medium: Unsupported trigger reasons are reduced to a generic primary error message

**Evidence**
- Trigger normalization emits specific incompatibility reasons:
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts#L49)
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts#L89)
- Those messages are passed into the SQL error engine:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L2127)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L2128)
- Error classification maps `unsupported/not supported` to a generic user-facing message:
  - [src/lib/engine/sql-error-engine.ts](src/lib/engine/sql-error-engine.ts#L228)
  - [src/lib/engine/sql-error-engine.ts](src/lib/engine/sql-error-engine.ts#L230)

**Impact**
- If callers only display `result.error`, users lose the precise remediation detail (even though `errorDetails.rawMessage` still preserves it).

**Recommendation**
- Preserve specific unsupported reason in the top-level `error` string, or append the raw reason to the classified message.

---

## 3) Medium: CREATE TRIGGER header parsing remains regex-limited for complex identifiers

**Evidence**
- Trigger header extraction depends on whitespace-delimited capture groups (`[^\s]+`) for trigger/table names:
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts#L69)
- Leading identifier parsing is simple-token oriented:
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts#L18)

**Impact**
- Valid MySQL-style quoted identifiers with spaces or more complex forms may fail normalization unexpectedly.

**Recommendation**
- Move CREATE TRIGGER header parsing to token/lexer-based logic consistent with the new SQL lexer utilities.

---

## 4) Low: CONCAT rewrite is shallow and skips nested/function arguments

**Evidence**
- Current rewrite matches only `CONCAT(...)` arguments without nested parentheses:
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts#L738)

**Impact**
- Nested expressions such as `CONCAT(first_name, CONCAT(' ', last_name))` are not consistently rewritten.

**Recommendation**
- Use an argument parser that tracks parentheses depth instead of a flat regex capture.

## Resolved Since Previous Audit

- Lexer-aware comment handling and safe segment transforms are now in place:
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts#L90)
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts#L126)
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts#L712)
- Type rewrite scope is constrained to CREATE TABLE contexts:
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts#L327)
  - [src/lib/engine/sql-executor/translation.ts](src/lib/engine/sql-executor/translation.ts#L750)
- Privilege checks now evaluate all referenced tables via lexer extraction:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1249)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L1257)
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts#L535)
- Routine parameter substitution is syntax-aware and avoids literal/comment mutation:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L860)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L882)
  - [src/lib/engine/sql-executor/sql-lexer.ts](src/lib/engine/sql-executor/sql-lexer.ts#L182)
- DROP DATABASE now cleans function metadata too:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L2100)
- Per-statement effective database context is persisted and replayed:
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L3053)
  - [src/lib/engine/sql-executor/index.ts](src/lib/engine/sql-executor/index.ts#L3060)
  - [src/hooks/use-sql-engine.ts](src/hooks/use-sql-engine.ts#L532)
  - [src/hooks/use-sql-engine.ts](src/hooks/use-sql-engine.ts#L581)
  - [src/types/database.ts](src/types/database.ts#L19)
- Unsupported trigger forms are explicitly rejected rather than semantically rewritten:
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts#L54)
  - [src/lib/engine/sql-executor/mysql-compat.ts](src/lib/engine/sql-executor/mysql-compat.ts#L58)
- UI user-spec SQL escaping is now handled safely for SHOW GRANTS:
  - [src/app/(dashboard)/sandbox/page.tsx](src/app/%28dashboard%29/sandbox/page.tsx#L464)

## Final Assessment

The hardening work materially improved robustness and removed most previously reported high-severity defects. The remaining blocker is the CTE privilege-classification bypass, which should be prioritized as the next fix before considering the sandbox authorization model production-safe.
