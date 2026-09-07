# MySQL Compatibility Layer — Known Limitations

QueryCraft does not run a MySQL server. SQL entered by the user executes
against `sql.js` (SQLite compiled to WASM), and the files under
`src/shared/engine/sql/` translate MySQL syntax into SQLite syntax and
emulate MySQL's admin/introspection commands (`SHOW ...`, `DESCRIBE`, etc.)
against SQLite's own catalog and this engine's own in-memory state
(`SqlExecutor` in `src/shared/engine/sql/index.ts`).

This document is the honest list of where that emulation **cannot** fully
match real MySQL, why, and — where relevant — what a future fix would look
like. It exists so these gaps don't need re-discovering. Anything not listed
here that behaves differently from real MySQL is a bug, not a known
limitation — please fix it or add it to this list.

Pipeline order, for context (`SqlExecutor.execute()`,
`src/shared/engine/sql/index.ts`):

1. PL/SQL block handling (procedures/triggers/cursors)
2. `handleDatabaseCommand()` → `internal/database-commands.ts` — the
   canonical, stateful home for `SHOW`/`DESCRIBE`/DCL emulation
3. Prepared-statement handling
4. `handleAlterTableCompatibility()` → `internal/alter-table-compat.ts`
5. View-targeting DML rewrites
6. `translateMySQL()` → `translation.ts` — regex-based syntax rewriting,
   function translation, and the handful of admin stubs not owned by
   `database-commands.ts` (see "Simulated output" below)

---

## A. Explicitly rejected constructs

These are real MySQL syntax with no SQLite equivalent. Rather than silently
mishandling them, the engine detects them up front and returns a clear error
naming the construct and why it's unsupported. The canonical list is
`UNSUPPORTED_MYSQL_PATTERNS` in `src/shared/engine/sql/index.ts` (with a
second, overlapping fallback list a bit further down in the same file for
patterns detected only after a raw SQLite error). As of this writing that
covers:

- Server/instance-level commands: `LOAD DATA/XML INFILE`, `HANDLER`, `XA ...`,
  `CHANGE MASTER/REPLICATION SOURCE`, `RESET SLAVE/REPLICA`, `FLUSH TABLES
  WITH READ LOCK`, `UNLOCK TABLES`, `BINLOG`, `INSTALL/UNINSTALL PLUGIN`,
  `SHUTDOWN`, `CLONE INSTANCE`
- Storage/schema features SQLite has no concept of: `PARTITION BY`,
  `TABLESPACE`, `FULLTEXT`/`SPATIAL` indexes, `MATCH ... AGAINST`
- Query features: `WITH ROLLUP`, `JSON_TABLE(...)`, `XOR`, `SOUNDS LIKE`,
  `PROCEDURE ANALYSE(...)`, `REGEXP`/`RLIKE` (see §F for why this one is
  actually fixable)
- DDL/DML forms: `CREATE TABLE ... LIKE`, `SELECT ... INTO OUTFILE/DUMPFILE`,
  `SELECT ... INTO @variable`, `UPDATE/DELETE ... LIMIT`

These raise an error naming the exact unsupported feature rather than
producing wrong output — this is the correct behavior and needs no fix.

`UPDATE/DELETE ... LIMIT` detection is end-anchored (`LIMIT n` must be the
statement's trailing clause) specifically so a correlated subquery with its
own `LIMIT` — e.g. `UPDATE t SET x = (SELECT y FROM z LIMIT 1)`, which real
MySQL supports fine — isn't false-flagged.

---

## B. Semantic divergences (not fixable within a SQLite-backed architecture)

These are cases where SQLite's own execution semantics differ from MySQL's
and there is no reasonable way to paper over the difference without a real
MySQL engine underneath. Documented rather than "fixed."

- **`VARCHAR(n)` length is never enforced.** SQLite has no native length
  limits. A `VARCHAR(5)` column silently accepts a 500-character string.
- **`ENUM`/`SET` values are never validated** against their declared value
  list — both map straight to `TEXT`.
- **Integer division and numeric edge cases** can differ between MySQL and
  SQLite's type-affinity model in corner cases (e.g. implicit
  float-vs-integer coercion rules).
- **String comparison / `LIKE` case-sensitivity** follows SQLite's rules
  (ASCII-only case-insensitivity for `LIKE`, case-sensitive `=` on TEXT by
  default) rather than MySQL's default collation (`utf8mb4_general_ci` /
  `_0900_ai_ci`), which is case- and (partially) accent-insensitive for both
  `=` and `LIKE`.
- **`DATE`/`DATETIME`/`TIMESTAMP` are stored as `TEXT`.** There is no
  type-level validation of date values, and MySQL's automatic
  `TIMESTAMP`-column update-on-row-change behavior isn't replicated.
- **No `DELIMITER` statement support** — this is intentional, not a gap.
  `DELIMITER` is a MySQL *CLI client* convenience for typing multi-statement
  routine bodies interactively; it isn't server syntax, and the app drives
  SQL programmatically (whole statements arrive pre-split), so there's
  nothing for it to do here.
- **`ANY`/`ALL` subquery rewrites are exact except for the empty-subquery
  edge case.** `rewriteSubqueryOperators()` in `subquery-rewriter.ts`
  correctly rewrites `= ALL (subq)` as
  `val = MIN(subq) AND val = MAX(subq)` and `<> ANY (subq)` as
  `val <> MIN(subq) OR val <> MAX(subq)` (fixed from an earlier, wrong
  `NOT IN` approximation). But in real MySQL, `= ALL`/`<> ALL` against an
  **empty** subquery is vacuously `TRUE`; here, `MIN()`/`MAX()` of an empty
  set is `NULL` in both MySQL and SQLite, so the rewritten expression
  evaluates to `NULL` (treated as not-true) instead. Only matters for
  `ALL`/`ANY` against a subquery that can be empty at runtime.
- **`JSON_EXTRACT()` needs no translation — it already works natively**
  (`sql.js` is built with the JSON1 extension) — but its return-value
  quoting differs subtly from MySQL: `JSON_EXTRACT('{"a":"hi"}', '$.a')`
  returns the SQL text value `hi` (type `TEXT`) in SQLite, whereas real
  MySQL returns the *JSON* value `"hi"` (still quoted, type `JSON`) unless
  you also apply `JSON_UNQUOTE()`. Anyone comparing a `JSON_EXTRACT()`
  result to a quoted string literal will see different behavior than real
  MySQL.
- **`SHOW OPEN TABLES`'s `In_use`/`Name_locked` columns are always `0`** —
  there's no real lock manager to report on, so this isn't "fake data" so
  much as "the only truthful value in an architecture with no table
  locking."

---

## C. Simulated / approximate output for admin & introspection commands

For a *learning* tool, the worst failure mode isn't an error — it's
plausible-looking fake data with no signal that it's fake. Where MySQL's own
result schema has room for it, these commands now include an explicit
disclosure. Where the schema is rigid (MySQL clients/scripts expect an exact
column shape), the disclosure is an extra row instead of an extra column, or
the values themselves are already self-describing.

| Command | Where | Status |
|---|---|---|
| `SHOW VARIABLES` | `translation.ts` | Fixed row set (`version`, `max_connections`, etc.) plus a `querycraft_emulation_notice` row stating these are static placeholders, not live server state. |
| `SHOW STATUS` | `translation.ts` | Same pattern — `Uptime` plus a `querycraft_emulation_notice` row. |
| `SHOW [FULL] PROCESSLIST` | `translation.ts` | Single synthetic row; `State` column now reads `"simulated — no real server process list is tracked"` instead of blank. |
| `SHOW ENGINES` / `SHOW STORAGE ENGINES` | `translation.ts` | Already honest — `Comment` column says `"SQLite WASM backend (MySQL-compatible mode)"`. No change needed. |
| `SHOW GRANTS` | `internal/database-commands.ts` | **Not fabricated** — reflects this engine's real, internally-tracked grant state (`getGrantEntries()`), which is accurate relative to what the engine itself enforces. Earlier audit passes flagged this as fake; it isn't (or is no longer). |
| `SHOW CHARACTER SET` / `SHOW COLLATION` | `internal/database-commands.ts` | Lists 3 real, correctly-described charsets/collations (`utf8mb4`, `utf8`, `latin1`) rather than MySQL's full list of 40+. Not misleading (the entries are accurate), just incomplete — left as-is; noted here so it doesn't look like an oversight. |
| `SHOW PLUGINS` | `internal/database-commands.ts` | Single row named `querycraft_emulator` — the name itself discloses what it is. Real MySQL lists dozens of built-in plugins; a 1-row response is itself a strong tell this isn't a real server. Left as-is. |
| `OPTIMIZE`/`CHECK`/`REPAIR TABLE` | `translation.ts` | Already returns `"OK (simulated for SQLite backend)"` — already honest, no change needed. |

---

## D. Partial function support: `DATE_FORMAT()` / `STR_TO_DATE()`

Both were added in this pass via literal-format-string translation into
`strftime()`/`CASE`/`substr()` expressions (`translation.ts`,
`translateDateFormatCall` / `translateStrToDateCall`). Coverage is
intentionally bounded: **if the format string isn't a plain single-quoted
literal, or contains a specifier that can't be represented this way, the
call is left untranslated** — it then fails loudly at execution (SQLite
"no such function" or similar) rather than silently producing wrong dates.
This is a deliberate fail-loud choice, consistent with the rest of the
audit's philosophy.

**`DATE_FORMAT()` supported specifiers:** `%Y %y %m %c %d %e %H %h %I %i %s
%S %p %j %w %M %b %W %a %%`

**`DATE_FORMAT()` unsupported (left untranslated):** `%U %u %V %v %X %x`
(MySQL/ISO week-numbering variants — no direct SQLite equivalent without
reimplementing MySQL's several week-numbering modes).

**`STR_TO_DATE()` supported:** only **fixed-width** field specifiers —
`%Y` (4 chars), `%y %m %d %H %i %s` (2 chars each) — because the
implementation works by slicing the input string at fixed character offsets
computed from the literal format string at translate time. A year field is
required (`%Y` or `%y`); date-only or full datetime formats both work.

**`STR_TO_DATE()` unsupported:** any variable-width or name-based specifier
(`%c %e %M %b %W %a %p %j`, etc.) — these can't be positionally sliced, so
the call is left untranslated.

Both are covered by regression tests in
`tests/sql/executor/core/sql-executor-mysql-audit.test.ts` (the "Pass 6"
`describe` block), including one test per function asserting the
unsupported-specifier case fails loudly rather than returning silently wrong
data.

---

## E. Confirmed working natively (don't re-litigate these)

Verified directly against the `sql.js` build this project uses — no
translation layer needed:

- **Window functions** (`SUM(...) OVER (...)`, etc.) — SQLite's native
  window-function support is close enough to MySQL 8+ that these pass
  through untranslated and work correctly.
- **`WITH RECURSIVE`** — passes through untranslated; SQLite's recursive CTE
  support is standard-SQL-compatible with MySQL's.
- **`JSON_EXTRACT()`** and the rest of SQLite's JSON1 functions — present in
  this `sql.js` build (see the quoting caveat in §B).

---

## F. Ideas for future fixes (not yet done)

Things that are **not** fundamental SQLite limitations — just not
implemented yet:

- **`REGEXP`/`RLIKE`** is currently in the hard-rejected list
  (`UNSUPPORTED_MYSQL_PATTERNS`), but this is *not* a real SQLite
  limitation — `sql.js` supports registering a custom SQL function via
  `db.create_function('REGEXP', (pattern, value) => ...)`, confirmed working
  in this build. Registering a JS-`RegExp`-backed `REGEXP` function on every
  `SqlJsDatabase` at creation time (in `SqlExecutor`'s DB-init path) would
  let this be a real, correct feature instead of a rejection. Moderate
  effort, high value — likely the best next fix.
- **`SOUNDS LIKE`** could similarly be implemented by registering a
  `SOUNDEX`-equivalent JS function via `create_function` (SQLite's compiled
  `soundex()` isn't available in this `sql.js` build, confirmed) and
  rewriting `a SOUNDS LIKE b` to `SOUNDEX(a) = SOUNDEX(b)`. Needs a small
  JS Soundex implementation; moderate effort.
- **`UNSIGNED` enforcement** — currently stripped, not enforced (a negative
  insert into an `UNSIGNED` column silently succeeds). Could be implemented
  by injecting a `CHECK (col >= 0)` constraint when rewriting `CREATE TABLE`/
  `ALTER TABLE ... ADD COLUMN`. Deferred in this pass as a judgment call
  (changes constraint-violation error messages/shape); worth reconsidering.
- **`VARCHAR(n)`/`ENUM`/`SET` validation** — same idea, via generated `CHECK`
  constraints (`length(col) <= n` for `VARCHAR`, `col IN (...)` for `ENUM`).
  Bigger lift since it touches every `CREATE TABLE`/`ALTER TABLE` rewrite
  path, but would close a real, commonly-hit gap for learners.
- **Fuller `SHOW CHARACTER SET`/`SHOW COLLATION`/`SHOW PLUGINS` lists** — not
  misleading today, just thin. Could be expanded to a larger static table if
  it turns out to matter for any lesson content.
- **`MATCH ... AGAINST` full-text search** — SQLite has FTS5 as a virtual
  table module, but mapping `MATCH ... AGAINST` onto it would require
  restructuring the target table as (or alongside) an FTS5 virtual table at
  `CREATE TABLE` time. Substantial architectural change, not a quick fix.
