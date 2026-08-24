# QueryCraft Feature Audit

**Date:** 2026-08-24  
**Scope:** Full application feature surface (labs, assessment stack, APIs, shared platform)  
**Sources:** Routes, feature modules, stores, engines, API routes, `package.json`, sidebar nav, README

---

## Executive summary

QueryCraft has two product layers:

1. **Browser labs** — SQL, algebra, TRC, ER, normalizer, generator, learn (work offline / local-first)
2. **Postgres Test Module** — classic tests, interactive quiz, question bank, admin (needs `TEST_DB_URL`)

Core learning labs are production-ready for demos and class use. The Test/Quiz/Admin stack is largely built but env-gated and underdocumented relative to the rest of the app. README still understates the real API and assessment surface.

---

## Tech stack

| Layer | Technology | Version / notes | Used for |
|-------|------------|-----------------|----------|
| Framework | Next.js (App Router) | `^16.2.9` | App shell, routes, API routes |
| UI library | React / React DOM | `19.2.3` | Client UI |
| Language | TypeScript | `^5` | Type-safe app + engines |
| Styling | Tailwind CSS | `^4` (+ `@tailwindcss/postcss`) | Design system / layout |
| Motion | Framer Motion | `^12` | Landing + UI motion |
| Icons | Lucide React | `^0.475` | Sidebar / UI icons |
| State | Zustand | `^5` | Feature stores + persistence |
| Validation | Zod | `^3.24` | Schemas / input validation |
| SQL editor | CodeMirror 6 | `codemirror` + `@codemirror/*` | Sandbox SQL editing |
| Diagrams | `@xyflow/react` (React Flow) | `^12.10` | ER Builder (+ normalizer canvas pieces) |
| In-browser SQL | sql.js (WASM SQLite) | `^1.14` | Sandbox / algebra / TRC execution |
| Synthetic data | `@faker-js/faker` | `^10.3` | Table Generator / normalizer samples |
| Export | html-to-image | `^1.11` | ER / canvas PNG export |
| Spreadsheet import | read-excel-file | `^9` | Admin / question bank Excel import |
| Select UI | react-select | `^5.10` | Form selects |
| Class helpers | clsx, tailwind-merge, CVA | — | Conditional / variant styles |
| Server DB | `pg` (node-postgres) | `^8.20` | Test Module Postgres |
| Optional AI | Groq API | env: `GROQ_API_KEY` | Normalizer “Analyze with AI” |
| Unit tests | Vitest | `^3` | Engine / SQL suite |
| Lint / format | ESLint 9, Prettier | Next ESLint config `16.1.6` | Code quality |
| Runtime target | Node.js | 20+ (README) | Dev / build / migrate scripts |

### Architecture pattern

| Concern | Approach |
|---------|----------|
| Labs SQL runtime | Browser WASM (sql.js), not a hosted DB |
| Lab persistence | Zustand + user-scoped `localStorage` |
| Device auth | Client SHA-256 accounts + `sessionStorage` session |
| Test Module auth | Server HMAC sessions, HTTP-only cookie, scrypt passwords |
| Test Module data | Postgres via `TEST_DB_URL` + SQL migrations |
| Seed datasets | JSON files under `seed/datasets` via `GET /api/datasets` |

---

## Feature scorecard

| Feature | Status | Needs |
|---------|--------|-------|
| Landing / Privacy / Terms | Shipped | — |
| Our Team | Shipped* | — (*mentor placeholders) |
| Device-local auth | Shipped | — |
| Dashboard | Shipped (thin) | — |
| SQL Sandbox + history | Shipped | datasets API |
| Algebra + history | Shipped | datasets API |
| Tuple Calculus + history | Shipped | datasets API |
| ER Builder | Shipped | — |
| Normalizer | Shipped UI, split architecture | Groq optional |
| Table Generator | Shipped | — |
| Learn | Shipped | — |
| Settings / Themes | Shipped | — |
| Test Module + Question Bank | Shipped if DB up | Postgres |
| Interactive Quiz | Shipped if DB up | Postgres |
| Admin | Shipped if DB up | Postgres + admin env |
| SQL engine (MySQL-on-SQLite) | Strong (~7.5/10) | WASM |

---

## Navigation

Sidebar (`src/app/(dashboard)/layout.tsx`):

- **Main:** Dashboard, Learn
- **Labs:** SQL Sandbox, Table Generator, Test Module, Question Bank
- **Theory:** Algebra, Tuple Calculus, ER Builder, Normalizer
- **Account:** Settings

**Not in sidebar:** `/admin`, `/interactive-quiz` (reached via Test Module), history sub-routes, privacy/terms/team.

Dashboard home tiles omit Generator and Test Module despite sidebar links.

---

## 1. Landing / marketing (`/`, `/privacy`, `/terms`, `/our-team`)

**Status:** Fully shipped (mentors: placeholder)

**Capabilities**
- Animated landing with tool cards and CTA to login/dashboard
- Theme picker / lite mode for reduced motion
- Privacy + Terms via shared legal UI
- Our Team with developer profiles

**Gaps**
- Mentors are `"Mentor Name"` placeholders
- Landing omits Test Module / Interactive Quiz
- Marketing stats (“86+ commands”, “13 categories”) slightly stale vs Learn catalog

**Dependencies:** Browser-only

---

## 2. Auth (device-local) — `/login`, `/register`

**Status:** Fully shipped

**Capabilities**
- Multi-account on one device; password check; session restore
- Export/import account codes
- Per-account workspace isolation in localStorage
- Dashboard layout client auth guard → `/login`

**Gaps**
- Educational auth only (SHA-256 client hash), not production identity
- Register min password length (4) vs Settings (`minLength={8}`) mismatch
- Separate from Test Module auth

**Dependencies:** Browser-only

---

## 3. Dashboard home — `/dashboard`

**Status:** Fully shipped (thin hub)

**Capabilities**
- Static workspace chooser / “Learning Command Center” grid

**Gaps**
- No recent activity; missing Generator / Test Module tiles; stats slightly stale

**Dependencies:** Browser-only (auth-gated)

---

## 4. SQL Sandbox (+ history)

**Status:** Fully shipped — strongest lab module

**Capabilities**
- In-browser sql.js with MySQL-style emulation
- CodeMirror editor, multi-statement execution, schema browser
- Seed datasets, SQL import, CSV export
- Query history (persisted, user-scoped)
- Panels for triggers, procedures, cursors, grants/security
- Statement-level results and SQL error details

**Gaps**
- Not real MySQL (SQLite/WASM + emulation)
- Long-tail `SHOW` / server-only syntax gaps (see historical SQL emulator notes)

**Dependencies:** Browser-only + `GET /api/datasets`

---

## 5. Relational Algebra (+ history)

**Status:** Fully shipped

**Capabilities**
- Parser, expression tree, step-by-step evaluation, SQL translation
- Ops: σ π γ τ, joins (natural/outer/semi/anti), ∪ ∩ − ÷ × ρ, sort/agg
- Shares sql.js tables/seeds; history persistence

**Gaps**
- Condition evaluation is JS-based (edge-case limits)
- Division/rename depth limited vs textbook edge cases

**Dependencies:** Browser-only (+ datasets API)

---

## 6. Tuple Calculus (+ history)

**Status:** Fully shipped

**Capabilities**
- TRC → SQL → execute (`{ t | … }`, ∃/∀, ∧∨¬)
- Examples per seed dataset; history pages
- Shared table browser / create-table patterns

**Gaps**
- Translation heuristics (not a full TRC prover)
- Complex nested ∀/∃ may fail; depends on SQL engine for correctness

**Dependencies:** Browser-only (+ datasets API)

---

## 7. ER Diagram Builder

**Status:** Fully shipped

**Capabilities**
- React Flow canvas: entities (weak), attributes (key/multi/derived/composite)
- Relationships 1:1 / 1:N / M:N
- Presets: University, Banking, Credentia
- Undo/redo, properties panel
- ER → relational conversion + SQL; PNG export

**Gaps**
- Composite attrs not fully expanded in conversion
- Identifying/weak relationship nuances simplified; column types mostly TEXT

**Dependencies:** Browser-only

---

## 8. Normalizer Studio

**Status:** Shipped UI with split / unfinished architecture

**What users get**
- Large monolithic page: stage canvases UNF → 1NF → 2NF → 3NF → 4NF → 5NF
- Verification via `verifyNormalForm`
- Faker sample data; import from Table Generator
- Optional **Analyze with AI** → `POST /api/normalizer/analyze-ai`

**Also present but mostly unwired**
- Full engine (`normalize()`, decompose, lossless / dependency preservation)
- Canvas components (`normalizer-canvas`, `nf-stepper`, toolbar, store, etc.)

**Gaps**
- No dedicated BCNF stage in the UI (BCNF exists in engine order)
- Page uses verification more than the auto-`normalize()` pipeline
- Orphan / ROADMAP UI under `features/normalizer/components/`
- AI needs `GROQ_API_KEY` (not listed in `.env.example`)

**Dependencies:** Browser-only core; Groq optional for AI

---

## 9. Table Generator

**Status:** Fully shipped

**Capabilities**
- Multi-table definitions, semantic hints, Faker values, FK inference
- Templates (students / employees / ecommerce / university / hospital)
- Copy generated SQL; Zustand persistence; Normalizer import source

**Gaps**
- No one-click “load into Sandbox” (copy/paste workflow)

**Dependencies:** Browser-only

---

## 10. Learn page

**Status:** Fully shipped (reference, not interactive tutor)

**Capabilities**
- Large static searchable catalog (~100 command entries)
- DDL, constraints, DML, SELECT, aggregates, joins, subqueries, set ops, TCL, MySQL routines, DCL, metadata, algebra, normal forms
- Search, copy examples, category UI

**Gaps**
- Not interactive lessons; marketing “visual walkthroughs” oversells UI chrome

**Dependencies:** Browser-only

---

## 11. Settings

**Status:** Fully shipped

**Capabilities**
- Display name, change password, 6 theme palettes

**Gaps**
- No workspace data export/wipe from Settings
- Password length inconsistency with register

**Dependencies:** Browser-only

---

## 12. Admin — `/admin`

**Status:** Fully shipped when env configured

**Capabilities**
- Admin-only (Test Module auth)
- CRUD teachers/students; Excel/CSV import; search/filter

**Gaps**
- Not in main sidebar
- Platform admin via env (`ADMIN_EMAIL` / `ADMIN_PASSWORD`), not a DB role row alone

**Dependencies:** Postgres `TEST_DB_URL`, admin env, `TEST_AUTH_SECRET` (prod)

---

## 13. Test Module (`/tests/*`)

**Status:** Fully shipped when DB configured; unusable without `TEST_DB_URL` + migrations

| Route | Role |
|-------|------|
| `/tests/login` | Email lookup → password / first-time setup |
| `/tests` | Teacher list + create/publish; student join + past tests; chooser → Interactive Quiz |
| `/tests/questions-bank` | Browse/upload MCQ + sql_fill |
| `/tests/[id]` | Questions, bank select/randomize, modes, publish code |
| `/tests/[id]/attempt` | Proctored attempt (fullscreen, blur, paste block, violations, autosave, auto-submit) |
| `/tests/[id]/result` | Scores, per-question feedback, violations |
| `/tests/[id]/review` | Teacher review / publish results |

**Capabilities**
- Roles admin / teacher / student
- Classic MCQ + sql_fill; mix modes; assignments; join codes
- Integrity monitoring; seeded question bank
- Migrations `0001`–`0015`

**Gaps**
- Dual auth (device-local vs Test Module) is confusing
- README underdocuments Test APIs / env
- sql_fill grading is string-oriented (not live SQL sandbox grading)
- Question Bank in sidebar for all device-authed users, but still needs Test login + DB

**Dependencies:** Postgres, migrations, `TEST_AUTH_SECRET`, admin env for admin flows

---

## 14. Interactive Quiz

**Status:** Fully shipped (Postgres)

**Capabilities**
- Create with timer / max points / difficulty / randomize
- Per-question timer; live scoring via `/interactive/check`
- Leaderboard with live refresh
- MCQ-only

**Gaps**
- Not in main sidebar (via Test chooser)
- No sql_fill; lighter proctoring than classic attempt

**Dependencies:** Same as Test Module

---

## 15. API routes

| Route group | Status | Purpose |
|-------------|--------|---------|
| `GET /api/datasets` | Shipped | Seed JSON |
| `POST /api/normalizer/analyze-ai` | Shipped | Groq FD/MVD/JD assist |
| `/api/test-auth/*` | Shipped | lookup, login, setup-password, session, me, logout, admin users/import |
| `/api/tests/*` | Shipped | CRUD tests, questions, randomize/select, publish, join, attempts, submit, violations, review, assignments, leaderboard, interactive/check, health/probe |

**Gap:** README still claims only datasets + health APIs.

---

## 16. Shared SQL engine / MySQL emulation

**Status:** Fully shipped as an emulator (not mysqld) — prior deep review ~**7.5 / 10**

**Capabilities**
- Multi-DB ATTACH, users/grants, procedures/functions/triggers/cursors
- PL/SQL-ish blocks, ALTER compatibility, view DML rewrite
- MySQL translation layer, subquery ANY/ALL, unsupported-pattern guards
- Vitest coverage under `tests/sql/`

**Gaps**
- Incomplete SHOW/metadata parity
- Server-only ops rejected; SQLite semantics underneath
- Upsert / exotic ALTER / long-tail functions remain fragile

**Dependencies:** Browser WASM (`public/sql-wasm.wasm`)

---

## 17. Seed datasets

**Status:** Fully shipped

| Dataset | File |
|---------|------|
| Banking | `seed/datasets/banking.json` |
| Credentia | `seed/datasets/credentia.json` |
| University | `seed/datasets/university.json` |

Used by Sandbox, Algebra, and Tuple Calculus via `/api/datasets`.

---

## 18. Theme / sync / legal UI

**Status:** Fully shipped

- **Theme:** 6 palettes via CSS variables (landing, dashboard, settings)
- **Sync:** `UserScopedStateSync` rehydrates lab stores on account switch
- **Legal:** shared `LegalPage` + content for Privacy / Terms

**Dependencies:** Browser-only

---

## Highest-signal findings

1. **README lag** — Documents only datasets + health; real surface includes full Test Module + AI normalizer APIs.
2. **Normalizer split-brain** — Production UI is one huge page; ROADMAP components/store are unused / underused.
3. **Two auth systems** — Device-local SHA-256 vs Postgres scrypt Test Module.
4. **Labs are solid offline; assessments need Postgres** — Neon/local + migrate + secrets.
5. **Nav vs marketing** — Tests / Admin / Interactive Quiz under-linked on home/landing; Admin not in sidebar.
6. **`.env.example` incomplete** — Missing documented `GROQ_*`, `ADMIN_*`, `TEST_AUTH_SECRET`.

---

## Recommended next priorities

| Priority | Item |
|----------|------|
| P0 | Document Test Module + env vars in README / `.env.example` |
| P0 | Treat Postgres as a hard dependency whenever demoing tests/quiz |
| P1 | Resolve Normalizer architecture (wire engine/canvas or delete orphans) |
| P1 | Align dashboard/landing/nav with Generator, Tests, Quiz, Admin |
| P2 | Unify or clearly separate the two auth experiences for students |
| P2 | Improve sql_fill grading (live SQL check vs string match) |
| P2 | Continue MySQL SHOW / metadata parity in the sandbox engine |

---

## Bottom line

Learning labs are **demo-ready**. Test/Quiz/Admin is **largely built** but **env-gated and poorly documented**. Normalizer **works**, with unfinished architectural debt.
