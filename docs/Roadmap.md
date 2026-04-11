# Test Module Roadmap (Teacher and Student Assessment)

Last updated: 2026-04-11

## 1. Refined Vision

Build a full Test module where:
- Teachers create, schedule, and publish DBMS tests.
- Students log in, enter a test code, and complete the test in a controlled environment.
- Teachers review submissions, assign marks, and release results.
- Anti-cheating controls are enforced during test attempts.
- Teachers can set question type mode per test (MCQ-only, SQL fill-in-only, or mixed).
- Mixed mode defaults to mostly MCQs with a smaller SQL query text-box section scored for syntax accuracy.

UI direction:
- Reuse existing QueryCraft page layout, spacing, and component style for consistency.
- Keep flows simple, fast, and mobile-friendly while preserving exam integrity.

## 2. Core Roles and Workflows

Teacher workflow:
1. Log in as Teacher.
2. Create a new test from DBMS question bank and optional custom questions.
3. Configure duration, marks, schedule window, anti-cheat rules, and question type mode.
4. Publish test and generate shareable test code.
5. Monitor active attempts and violation events in real time.
6. Review answers and assign marks.
7. Publish scores and feedback.

Student workflow:
1. Log in as Student.
2. Enter test code.
3. Read instructions and start test.
4. Answer questions and submit before timer ends.
5. Get confirmation and later view result if teacher releases it.

## 3. Scope for V1

Include in V1:
- Teacher test creation and publishing with unique test code.
- Student join by code + login.
- Timed test attempt page.
- Manual and auto grading support.
- Teacher review dashboard.
- Violation tracking and enforcement.
- Teacher-selectable question type mode: MCQ-only, SQL fill-in-only, or mixed.
- Frozen V1 mode configuration:
	- MCQ-only mode: 100% MCQ questions.
	- SQL fill-in-only mode: 100% SQL fill-in questions.
	- Mixed mode default: 80% MCQ and 20% SQL fill-in.
	- Mixed mode bounds: 70 to 85 percent MCQ and 15 to 30 percent SQL fill-in.

Anti-cheat policy for V1 (mandatory):
- First tab switch: show warning and log violation.
- Second tab switch: auto-close attempt immediately by force-submitting and locking re-entry.
- Disable copy, paste, and cut operations during active attempt.
- Disable context menu during active attempt.

Out of scope for V1:
- Webcam/proctoring AI.
- Browser extension lock-down.
- Multi-device synchronized proctoring.

## 4. Separate Database Plan for Test Module

Requirement: use a separate database for the Test module.

Recommended architecture:
- Keep existing QueryCraft product data unchanged.
- Add a dedicated Test database (PostgreSQL, confirmed for V1).
- Access it via a separate data access layer and separate connection string.

Environment variables:
- TEST_DB_URL for Test module database.
- Keep main app database URL independent.

Suggested core tables:
- users_test_profile: role mirror and identity mapping for test domain.
- topics: DBMS topic catalog.
- question_bank: master questions with question_type (mcq or sql_fill), evaluation_mode, and scoring metadata.
- question_options: options for MCQ questions.
- tests: test metadata and schedule.
- test_questions: immutable snapshot of questions included in each test.
- test_invites: code, expiry, allowed cohorts.
- attempts: one row per student attempt.
- attempt_answers: one row per answer.
- answer_evaluations: syntax score, parse diagnostics, and optional semantic score for sql_fill answers.
- violation_events: tab-switch and policy violations.
- grades: evaluated marks, comments, and publish status.
- audit_logs: important teacher and student actions.

Indexing priorities:
- test_invites.code unique index.
- attempts on test_id + student_id.
- question_bank on topic_id + difficulty.
- violation_events on attempt_id + created_at.

## 5. DBMS Question Bank Strategy (50 to 100 per Topic)

Target:
- 50 to 100 validated questions for each DBMS topic.

Recommended topic list:
- Relational model fundamentals
- ER modeling
- Relational algebra
- Tuple and domain relational calculus
- SQL DDL and constraints
- SQL DML and joins
- Aggregation and subqueries
- Normalization and functional dependencies
- Transactions and concurrency control
- Indexing, views, triggers, and procedures

Question mix per topic:
- 70 to 85% MCQ (primary assessment mode)
- 15 to 30% SQL query fill-in (text box answers)

V1 grading policy (frozen):
- MCQ questions: exact-option match auto-grading (full marks for correct, zero for incorrect; no negative marking in V1).
- SQL fill-in questions: syntax-only auto scoring in V1 (100% syntax accuracy based on parser checks and diagnostics).
- Semantic or expected-result matching is deferred to V2 and does not affect V1 marks.

Metadata per question:
- topic, subtopic, difficulty, marks, expected time, tags, question_type, answer key, explanation, syntax_rules.

Quality workflow:
- Draft -> review -> approved.
- Two-level review before question is available for live tests.
- Version history for edited questions.

## 6. Backend and API Roadmap

Teacher APIs:
- POST /api/tests
- PATCH /api/tests/:id
- POST /api/tests/:id/publish
- GET /api/tests/:id/submissions
- POST /api/tests/:id/grade
- POST /api/questions/import

Student APIs:
- POST /api/tests/join
- POST /api/attempts/start
- PATCH /api/attempts/:id/answer
- POST /api/attempts/:id/answer/syntax-check
- POST /api/attempts/:id/submit
- POST /api/attempts/:id/violation

System APIs:
- GET /api/tests/:id/monitor
- GET /api/tests/:id/analytics
- POST /api/tests/:id/result-publish

Key backend rules:
- Enforce role-based access (Teacher, Student).
- Server-side timer validation (do not trust client timer only).
- One active attempt per student per test unless retake is explicitly allowed.
- Auto-submit on timeout or second violation.
- Validate selected question type mode during test publish (MCQ-only, SQL-only, mixed).
- If mixed mode is selected, enforce configured or default mix bounds server-side.
- If mixed mode ratios are not set by teacher, apply frozen V1 defaults (80% MCQ, 20% SQL fill-in).
- For sql_fill answers, compute syntax accuracy score using server-side parser and store diagnostics.

## 7. Frontend and UX Integration Plan

Suggested route additions:
- src/app/(dashboard)/test/page.tsx
- src/app/(dashboard)/test/create/page.tsx
- src/app/(dashboard)/test/[testId]/edit/page.tsx
- src/app/(dashboard)/test/[testId]/monitor/page.tsx
- src/app/(dashboard)/test/[testId]/review/page.tsx
- src/app/(dashboard)/test/join/page.tsx
- src/app/(dashboard)/test/attempt/[attemptId]/page.tsx
- src/app/(dashboard)/test/result/[attemptId]/page.tsx

Suggested supporting modules:
- src/types/test.ts
- src/stores/test-store.ts
- src/lib/test/validation.ts
- src/lib/test/anti-cheat.ts
- src/lib/test/grading.ts
- src/app/api/tests/*
- src/app/api/attempts/*

UX details:
- Keep visual language aligned with existing feature pages.
- Show persistent timer and save status.
- Use autosave every few seconds and on answer change.
- In test creation, provide question type selector (MCQ-only, SQL-only, mixed) and mix controls for mixed mode.
- Pre-fill mixed mode controls with frozen V1 defaults (80% MCQ, 20% SQL fill-in) and enforce bounds in UI.
- For sql_fill questions, show a text area with syntax feedback indicator (valid or invalid + error hint).
- Use frozen V1 warning/final-notice copy for tab-switch violations (defined in Section 8).

## 8. Anti-Cheat Technical Design

Client events to track:
- visibilitychange
- window blur/focus
- copy, paste, cut, contextmenu
- restricted keyboard shortcuts for clipboard actions

Enforcement state machine:
1. Attempt starts with violation_count = 0.
2. On first tab switch event: violation_count = 1, show warning, send event to server.
3. On second tab switch event: violation_count = 2, force-submit attempt, set status to terminated_violation, redirect to lock screen.

Frozen V1 anti-cheat message copy:
- First tab-switch warning modal title: "Warning: Tab Switch Detected (1 of 2)"
- First tab-switch warning modal body: "Leaving the test tab is not allowed. One more tab switch will auto-submit your test and lock this attempt."
- First tab-switch warning modal primary action: "Return to Test"
- Second tab-switch final notice title: "Test Auto-Submitted"
- Second tab-switch final notice body: "A second tab switch was detected. Your test has been submitted automatically, and this attempt is now locked."
- Second tab-switch final notice action: "View Submission Status"

Server safeguards:
- Persist every violation event with timestamp.
- Ignore duplicate rapid events within small debounce window.
- Validate final attempt status transition server-side.

Important note:
- Browser anti-cheat is deterrence, not absolute prevention.
- Add audit trails for transparency during teacher review.

## 9. Security and Compliance

- Enforce strict authorization checks on every teacher and student endpoint.
- Use short-lived signed test/session tokens for active attempt context.
- Rate-limit join and submission endpoints.
- Encrypt sensitive fields at rest where needed.
- Maintain immutable logs for grading and status changes.

## 10. Testing Strategy

Unit tests:
- Anti-cheat state transitions.
- Timer and auto-submit logic.
- Grading calculations and mark boundaries.
- SQL syntax checker behavior for valid and invalid query inputs.

Integration tests:
- Teacher publish -> student join -> attempt -> submit -> teacher grade.
- Auto-submit on second tab switch.
- Auto-submit on timeout.
- SQL fill-in answer submission with syntax scoring persistence.

E2E tests:
- Full teacher flow with question assignment.
- Full student flow with code entry and attempt completion.
- Result publish and student visibility.

Performance tests:
- Concurrent attempts for a single test.
- Review dashboard loading with large submission sets.

## 11. Implementation Phases (Step-by-Step Build Plan)

This section is the execution-ready sequence to build the Test module incrementally.
Each phase has explicit tasks, outputs, and exit criteria.

### Phase 0: Finalize Product Contract (1 to 2 days)

Build steps:
1. Freeze V1 policies already decided in this document (DB choice, question modes, grading, anti-cheat messages).
2. Confirm open contract decisions listed in Section 15.8.
3. Lock naming conventions for DB tables and API payload fields.

Outputs:
- This roadmap is treated as the single source of truth.
- Team sign-off on schema and API contract sections.

Exit criteria:
- No unresolved V1 policy ambiguity remains.

### Phase 1: Test Database Foundation (2 to 3 days)

Build steps:
1. Add separate Test DB connection configuration using `TEST_DB_URL`.
2. Implement connection bootstrap and health-check path for Test DB.
3. Add migration scaffolding for Test module schema rollout.

Outputs:
- Working DB connectivity isolated from the main app DB.
- Migration execution path ready.

Exit criteria:
- Health check can connect and query Test DB.
- Migrations can be applied and rolled back in dev.

### Phase 2: Core Schema Implementation (3 to 5 days)

Build steps:
1. Create enum/check-constraint layer from Section 14.3.
2. Create core tables from Section 14.4 in migration order (identity -> authoring -> runtime -> logs).
3. Add indexes from Section 14.5.
4. Seed baseline topics and sample question bank entries.

Outputs:
- Fully created Test module schema.
- Seeded topic data available for authoring.

Exit criteria:
- All migrations run successfully on clean DB.
- Constraints for mode bounds and attempt states behave correctly.

### Phase 3: Teacher Authoring and Publish APIs (4 to 6 days)

Build steps:
1. Implement teacher endpoints in Section 15.4 (`POST /api/tests`, `PATCH /api/tests/:id`, `POST /api/tests/:id/publish`).
2. Enforce question mode validation and mixed bounds at create/update/publish time.
3. Implement question import endpoint (`POST /api/questions/import`).
4. Implement submission listing endpoint (`GET /api/tests/:id/submissions`).

Outputs:
- Teachers can create draft tests, edit, publish, and receive invite code.

Exit criteria:
- Publish is blocked if mode composition violates frozen V1 rules.
- Teacher endpoints reject student role access.

### Phase 4: Student Join and Attempt APIs (4 to 6 days)

Build steps:
1. Implement `POST /api/tests/join` and validate code eligibility.
2. Implement `POST /api/attempts/start` with one-active-attempt guard.
3. Implement `PATCH /api/attempts/:id/answer` autosave for MCQ and SQL fill.
4. Implement `POST /api/attempts/:id/submit` for finalization.

Outputs:
- End-to-end attempt lifecycle (join -> start -> answer -> submit).

Exit criteria:
- Attempt states transition correctly.
- Timeout and lock guards prevent invalid updates to closed attempts.

### Phase 5: Syntax Evaluation and Anti-Cheat Engine (4 to 6 days)

Build steps:
1. Implement `POST /api/attempts/:id/answer/syntax-check` with response model in Section 15.5.4.
2. Persist syntax evaluation diagnostics to `answer_evaluations`.
3. Implement `POST /api/attempts/:id/violation` with first-warning and second-force-submit behavior.
4. Persist violation events and update attempt state atomically.

Outputs:
- SQL syntax scoring in V1 (syntax-only).
- Anti-cheat enforcement on second tab switch.

Exit criteria:
- Frozen warning/final notice copy returns exactly as defined.
- Second tab-switch sets `terminated_violation` and locks attempt updates.

### Phase 6: Grading, Monitor, Analytics, and Result Publish (3 to 5 days)

Build steps:
1. Implement `POST /api/tests/:id/grade` for manual adjustments and feedback.
2. Implement `GET /api/tests/:id/monitor` and `GET /api/tests/:id/analytics`.
3. Implement `POST /api/tests/:id/result-publish`.
4. Ensure grade visibility follows publish status.

Outputs:
- Teacher review and result release workflows.

Exit criteria:
- Published results are visible to students.
- Monitor/analytics returns accurate attempt and violation stats.

### Phase 7: Frontend Integration (5 to 8 days)

Build steps:
1. Build teacher pages: create/edit/publish/monitor/review.
2. Build student pages: join/attempt/result.
3. Integrate autosave, timer, and syntax feedback indicator.
4. Integrate anti-cheat event tracking and warning/lock UI.

Outputs:
- Complete UI flow connected to backend contracts.

Exit criteria:
- Teacher and student V1 workflows operate end-to-end from UI.
- Anti-cheat messages match frozen copy and behavior.

### Phase 8: QA, Security Hardening, and Release (4 to 6 days)

Build steps:
1. Add unit, integration, and E2E suites for critical flows.
2. Add rate limiting and endpoint authorization audits.
3. Run load tests for concurrent attempts and review dashboard.
4. Execute release checklist and rollback plan.

Outputs:
- Release candidate with verified quality and security baseline.

Exit criteria:
- Critical tests pass and no P1/P2 blockers remain.

## 12. Definition of Done

The module is done when all conditions are met:
- Teacher can create and publish tests with code.
- Teacher can set question type mode for each test (MCQ-only, SQL-only, or mixed).
- Student can join by code, attempt, and submit.
- First tab switch warns, second tab switch force-submits and locks attempt.
- Copy and paste are blocked during active test.
- Teacher can review answers and publish marks.
- Separate Test database is live with initial DBMS question bank.
- Automated tests pass for critical flows.
- Mixed mode supports mostly MCQ defaults while allowing teacher-configured type selection.

## 13. Immediate Next Actions

1. Done (2026-04-11): Confirmed PostgreSQL as the Test module database.
2. Done (2026-04-11): Froze V1 question type modes, mixed-mode defaults/bounds (default 80% MCQ and 20% SQL fill-in), and grading policy.
3. Done (2026-04-11): Finalized exact anti-cheat warning and final-notice message copy for tab-switch violations.
4. Done (2026-04-11): Completed Phase 0 schema and API contract drafting in this file (Sections 14 and 15).
5. Done (2026-04-11): Completed Phase 1, Step 1 (`TEST_DB_URL` wiring + separate Test DB connection bootstrap) in `src/lib/test-db/config.ts` and `src/lib/test-db/bootstrap.ts`.
6. Done (2026-04-11): Completed Phase 1, Step 2 (Test DB health-check path and connectivity probe endpoint) in `src/app/api/tests/health/route.ts`, `src/app/api/tests/health/probe/route.ts`, and `src/lib/test-db/probe.ts`.
7. Done (2026-04-11): Completed Phase 1, Step 3 (migration scaffolding for Test module schema rollout) with `scripts/test-db/migrate.mjs` and `src/lib/test-db/migrations/*`.
8. Done (2026-04-11): Completed Phase 2, Step 1 (enum domain layer from Section 14.3) in `src/lib/test-db/migrations/0002_create_test_enum_domains.up.sql` and `src/lib/test-db/migrations/0002_create_test_enum_domains.down.sql`.
9. Done (2026-04-11): Completed Phase 2, Step 2 (core tables from Section 14.4 in migration order) in `src/lib/test-db/migrations/0003_create_test_core_tables.up.sql` and `src/lib/test-db/migrations/0003_create_test_core_tables.down.sql`.
10. Done (2026-04-11): Completed Phase 2, Step 3 (indexes from Section 14.5) in `src/lib/test-db/migrations/0004_add_test_module_indexes.up.sql` and `src/lib/test-db/migrations/0004_add_test_module_indexes.down.sql`.
11. Done (2026-04-11): Completed Phase 2, Step 4 (seed baseline topics and sample question bank entries) in `src/lib/test-db/migrations/0005_seed_topics_and_sample_questions.up.sql` and `src/lib/test-db/migrations/0005_seed_topics_and_sample_questions.down.sql`.
12. Next build action: Start Phase 3, Step 1 (teacher authoring/publish APIs: `POST /api/tests`, `PATCH /api/tests/:id`, `POST /api/tests/:id/publish`).

## 14. Consolidated Phase 0 Schema Draft

### 14.1 Scope

This schema covers V1 Test module requirements:
- Teacher test authoring and publishing
- Student join and attempt lifecycle
- Answer persistence and evaluation
- Anti-cheat event capture and enforcement history
- Grade publication and auditability

### 14.2 Global Conventions

- Database: PostgreSQL
- Primary keys: `uuid` with `gen_random_uuid()` default
- Timestamps: `timestamptz` in UTC
- Flexible payloads: `jsonb`
- Score fields: `numeric(5,2)`
- Soft delete: out of scope for V1; use explicit statuses

### 14.3 Enum Domains (Logical)

Use PostgreSQL enums or `text` + check constraints.

- `test_role`: `teacher`, `student`
- `question_type`: `mcq`, `sql_fill`
- `question_status`: `draft`, `review`, `approved`, `retired`
- `test_status`: `draft`, `published`, `closed`, `archived`
- `question_mode`: `mcq_only`, `sql_only`, `mixed`
- `attempt_status`: `in_progress`, `submitted`, `terminated_violation`, `terminated_timeout`
- `evaluation_type`: `mcq_auto`, `sql_syntax`, `sql_semantic`, `manual`
- `evaluation_mode`: `syntax_only`, `semantic_expected_result`
- `violation_event_type`: `tab_switch`, `blur`, `copy`, `paste`, `cut`, `context_menu`
- `violation_action`: `logged`, `warned`, `blocked`, `force_submitted`

### 14.4 Tables and Constraints

#### 14.4.1 `users_test_profile`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `app_user_id text not null unique`
- `role text not null check (role in ('teacher', 'student'))`
- `display_name text not null`
- `email text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Purpose:
- Maps app identities to Test-domain user profiles and roles.

#### 14.4.2 `topics`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `slug text not null unique`
- `name text not null`
- `description text null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

#### 14.4.3 `question_bank`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `topic_id uuid not null references topics(id)`
- `question_type text not null check (question_type in ('mcq', 'sql_fill'))`
- `prompt text not null`
- `difficulty text not null check (difficulty in ('easy', 'medium', 'hard'))`
- `marks numeric(5,2) not null default 1.00`
- `expected_time_sec int null`
- `answer_key jsonb not null`
- `syntax_rules jsonb null`
- `explanation text null`
- `tags jsonb null`
- `status text not null check (status in ('draft', 'review', 'approved', 'retired'))`
- `version int not null default 1`
- `created_by uuid null references users_test_profile(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Notes:
- MCQ answer key is option-based.
- SQL fill answer key contains parser/syntax expectations for V1.

#### 14.4.4 `question_options`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `question_id uuid not null references question_bank(id) on delete cascade`
- `option_key text not null`
- `option_text text not null`
- `is_correct boolean not null default false`
- `display_order int not null`
- `created_at timestamptz not null default now()`

Constraints:
- `unique (question_id, option_key)`
- `unique (question_id, display_order)`

#### 14.4.5 `tests`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `created_by uuid not null references users_test_profile(id)`
- `title text not null`
- `description text null`
- `question_mode text not null check (question_mode in ('mcq_only', 'sql_only', 'mixed'))`
- `mix_mcq_percent int null`
- `mix_sql_fill_percent int null`
- `duration_minutes int not null check (duration_minutes > 0)`
- `starts_at timestamptz null`
- `ends_at timestamptz null`
- `anti_cheat_policy jsonb not null`
- `status text not null check (status in ('draft', 'published', 'closed', 'archived')) default 'draft'`
- `published_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Mode rules:
- If mode is `mixed`, both mix fields are required and must sum to 100.
- Frozen defaults: 80/20 when omitted in request layer.
- Frozen bounds: MCQ 70 to 85, SQL fill 15 to 30.

#### 14.4.6 `test_questions`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `test_id uuid not null references tests(id) on delete cascade`
- `question_bank_id uuid not null references question_bank(id)`
- `question_snapshot jsonb not null`
- `marks numeric(5,2) not null`
- `display_order int not null`
- `created_at timestamptz not null default now()`

Constraints:
- `unique (test_id, display_order)`

Purpose:
- Immutable question snapshot for attempt-time consistency.

#### 14.4.7 `test_invites`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `test_id uuid not null references tests(id) on delete cascade`
- `invite_code text not null unique`
- `expires_at timestamptz null`
- `max_attempts_per_student int not null default 1`
- `allowed_cohorts jsonb null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`

#### 14.4.8 `attempts`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `test_id uuid not null references tests(id)`
- `student_profile_id uuid not null references users_test_profile(id)`
- `attempt_number int not null default 1`
- `status text not null check (status in ('in_progress', 'submitted', 'terminated_violation', 'terminated_timeout'))`
- `started_at timestamptz not null`
- `ended_at timestamptz null`
- `submitted_at timestamptz null`
- `violation_count int not null default 0 check (violation_count >= 0)`
- `auto_score numeric(5,2) null`
- `manual_score numeric(5,2) null`
- `final_score numeric(5,2) null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- `unique (test_id, student_profile_id, attempt_number)`

#### 14.4.9 `attempt_answers`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `attempt_id uuid not null references attempts(id) on delete cascade`
- `test_question_id uuid not null references test_questions(id)`
- `question_type text not null check (question_type in ('mcq', 'sql_fill'))`
- `selected_option_key text null`
- `sql_text text null`
- `is_final boolean not null default false`
- `answered_at timestamptz null`
- `updated_at timestamptz not null default now()`

Constraints:
- `unique (attempt_id, test_question_id)`
- For MCQ answers, use `selected_option_key` and keep `sql_text` null.
- For SQL fill answers, use `sql_text` and keep `selected_option_key` null.

#### 14.4.10 `answer_evaluations`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `attempt_answer_id uuid not null references attempt_answers(id) on delete cascade`
- `evaluation_type text not null check (evaluation_type in ('mcq_auto', 'sql_syntax', 'sql_semantic', 'manual'))`
- `evaluation_mode text not null check (evaluation_mode in ('syntax_only', 'semantic_expected_result'))`
- `syntax_score numeric(5,2) null`
- `semantic_score numeric(5,2) null`
- `awarded_score numeric(5,2) not null`
- `max_score numeric(5,2) not null`
- `is_valid boolean null`
- `diagnostics jsonb null`
- `evaluated_by uuid null references users_test_profile(id)`
- `evaluated_at timestamptz not null default now()`

V1 rules:
- SQL fill uses `evaluation_type='sql_syntax'` and `evaluation_mode='syntax_only'`.
- `semantic_score` remains null in V1.

#### 14.4.11 `violation_events`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `attempt_id uuid not null references attempts(id) on delete cascade`
- `event_type text not null check (event_type in ('tab_switch', 'blur', 'copy', 'paste', 'cut', 'context_menu'))`
- `action_taken text not null check (action_taken in ('logged', 'warned', 'blocked', 'force_submitted'))`
- `event_payload jsonb null`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null default now()`

#### 14.4.12 `grades`

Columns:
- `id uuid primary key default gen_random_uuid()`
- `attempt_id uuid not null unique references attempts(id) on delete cascade`
- `auto_score numeric(5,2) not null default 0.00`
- `manual_adjustment numeric(5,2) not null default 0.00`
- `final_score numeric(5,2) not null default 0.00`
- `feedback text null`
- `is_published boolean not null default false`
- `published_at timestamptz null`
- `graded_by uuid null references users_test_profile(id)`
- `graded_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

#### 14.4.13 `audit_logs`

Columns:
- `id bigserial primary key`
- `actor_profile_id uuid null references users_test_profile(id)`
- `actor_role text null`
- `action text not null`
- `resource_type text not null`
- `resource_id uuid null`
- `metadata jsonb null`
- `created_at timestamptz not null default now()`

### 14.5 Indexing Plan

- `test_invites(invite_code)` unique
- `attempts(test_id, student_profile_id, attempt_number)` unique
- `attempts(test_id, status)`
- `question_bank(topic_id, difficulty, status)`
- `test_questions(test_id, display_order)` unique
- `attempt_answers(attempt_id, test_question_id)` unique
- `answer_evaluations(attempt_answer_id, evaluation_type, evaluated_at desc)`
- `violation_events(attempt_id, occurred_at)`
- `grades(attempt_id)` unique
- `audit_logs(resource_type, resource_id, created_at)`

### 14.6 Data Integrity Rules (V1)

- One active attempt per student per test unless retake is explicitly enabled.
- Second tab-switch violation forces attempt status to `terminated_violation`.
- Mixed mode bounds are enforced server-side and validated pre-publish.
- SQL fill grading in V1 is syntax-only.

### 14.7 Migration Execution Order

1. Create enum types (or check constraints).
2. Create identity tables: `users_test_profile`, `topics`.
3. Create authoring tables: `question_bank`, `question_options`, `tests`, `test_questions`, `test_invites`.
4. Create runtime tables: `attempts`, `attempt_answers`, `answer_evaluations`, `violation_events`, `grades`.
5. Create `audit_logs` and all secondary indexes.
6. Seed baseline topics and starter question fixtures.

### 14.8 Open Schema Decisions

- Use PostgreSQL enums vs text + check for easier future evolution.
- Compute `final_score` on write vs derive on read.
- Keep invite codes globally unique vs unique per test.
- Keep retake model via `attempt_number` only vs dedicated retake policy table.

## 15. Consolidated Phase 0 API Contract Draft

### 15.1 Purpose

This section defines V1 API contracts for the Test module.
It aligns with frozen mode defaults/bounds, anti-cheat behavior, and syntax-only SQL scoring.

### 15.2 Auth and Authorization

- All Test endpoints require authenticated users.
- Teacher-only endpoints: authoring, publishing, grading, monitoring, analytics, result publish.
- Student-only endpoints: join, start attempt, save answer, syntax check, submit, violation logging.

### 15.3 Common Conventions

Content type:
- Request and response bodies use `application/json`.

Standard error shape:

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Human-readable message",
		"details": {
			"field": "questionMode"
		}
	}
}
```

Common error codes:
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `ATTEMPT_LOCKED`
- `TEST_NOT_OPEN`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

Frozen mode rules for requests:
- `mcq_only`: all selected questions must be MCQ.
- `sql_only`: all selected questions must be SQL fill-in.
- `mixed`: default 80/20 with bounds MCQ 70 to 85 and SQL fill 15 to 30; sum must be 100.

### 15.4 Teacher Endpoints

#### 15.4.1 `POST /api/tests`

Purpose:
- Create draft test.

Request fields:
- `title`, `description`
- `questionMode`
- `mix.mcqPercent`, `mix.sqlFillPercent` (required for mixed unless defaults applied)
- `durationMinutes`
- `schedule.startsAt`, `schedule.endsAt`
- `antiCheatPolicy.tabSwitchMax`, `antiCheatPolicy.blockClipboard`, `antiCheatPolicy.blockContextMenu`
- `questionSelection.topicIds`, `questionSelection.totalQuestions`

Success response:
- Returns created `test.id`, `status=draft`, resolved `questionMode` and mix.

Validation:
- Apply frozen mixed defaults when mix omitted.
- Reject out-of-bound mixed ratios.

#### 15.4.2 `PATCH /api/tests/:id`

Purpose:
- Update draft test metadata, mode, schedule, and composition.

Success response:
- Returns updated test envelope with timestamp.

#### 15.4.3 `POST /api/tests/:id/publish`

Purpose:
- Publish test and generate invite code.

Request fields:
- `expiresAt`
- `maxAttemptsPerStudent`
- `allowedCohorts`

Success response:
- Returns updated test status and generated invite code.

Publish checks:
- Question set must match selected mode.
- Mixed mode composition must satisfy frozen bounds.

#### 15.4.4 `GET /api/tests/:id/submissions`

Purpose:
- List attempts for teacher review.

Success response includes:
- `attemptId`, student summary, status, score, submit timestamp.

#### 15.4.5 `POST /api/tests/:id/grade`

Purpose:
- Apply manual grade adjustments and feedback.

Request fields:
- `attemptId`
- `manualAdjustment`
- `feedback`

Success response includes:
- `autoScore`, `manualAdjustment`, `finalScore`, `isPublished`.

#### 15.4.6 `POST /api/questions/import`

Purpose:
- Bulk import question bank entries.

Request fields:
- `topicId`
- `questions[]` payload with type-specific structure.

Success response:
- `imported` count and `failed` count.

### 15.5 Student Endpoints

#### 15.5.1 `POST /api/tests/join`

Purpose:
- Validate invite code, schedule window, and eligibility.

Request:
- `code`

Success response:
- Test summary and `joinAllowed` boolean.

#### 15.5.2 `POST /api/attempts/start`

Purpose:
- Create a new in-progress attempt.

Request:
- `testId`

Success response:
- Attempt metadata (`id`, status, start/end times) and rendered question set.

#### 15.5.3 `PATCH /api/attempts/:id/answer`

Purpose:
- Autosave one answer.

MCQ payload:
- `testQuestionId`, `questionType=mcq`, `selectedOptionKey`

SQL fill payload:
- `testQuestionId`, `questionType=sql_fill`, `sqlText`

Success response:
- `saved` with `updatedAt` timestamp.

#### 15.5.4 `POST /api/attempts/:id/answer/syntax-check`

Purpose:
- Run parser-based syntax check for SQL fill answer.

Request:
- `testQuestionId`
- `sqlText`

Success response shape:

```json
{
	"syntaxCheck": {
		"attemptId": "uuid-attempt",
		"testQuestionId": "uuid-tq",
		"isValid": true,
		"syntaxScore": 1.0,
		"maxSyntaxScore": 1.0,
		"normalizedSql": "SELECT ...",
		"diagnostics": [],
		"parser": {
			"engine": "querycraft-sql-parser",
			"version": "v1"
		},
		"evaluatedAt": "2026-04-20T10:13:00Z"
	}
}
```

Syntax-check response model:
- `isValid`: parser pass/fail
- `syntaxScore`: value in `[0,1]` for V1 syntax-only scoring
- `maxSyntaxScore`: fixed `1.0` in V1
- `normalizedSql`: canonical SQL text or null
- `diagnostics[]`: `code`, `message`, `line`, `column`, `severity`
- `parser.engine` and `parser.version` for traceability
- `evaluatedAt`: UTC timestamp

V1 scoring rule:
- Semantic/expected-result matching is excluded from V1 marks.

#### 15.5.5 `POST /api/attempts/:id/submit`

Purpose:
- Finalize attempt and compute auto score.

Request:
- `finalize=true`

Success response:
- Attempt status and score summary.

#### 15.5.6 `POST /api/attempts/:id/violation`

Purpose:
- Log anti-cheat events and return enforcement action.

Request fields:
- `eventType`
- `occurredAt`
- `eventPayload`

Behavior:
- First tab switch returns warning action + frozen warning copy.
- Second tab switch returns force-submitted action + frozen final notice copy.

First warning message copy:
- Title: `Warning: Tab Switch Detected (1 of 2)`
- Body: `Leaving the test tab is not allowed. One more tab switch will auto-submit your test and lock this attempt.`
- Action: `Return to Test`

Second violation message copy:
- Title: `Test Auto-Submitted`
- Body: `A second tab switch was detected. Your test has been submitted automatically, and this attempt is now locked.`
- Action: `View Submission Status`

### 15.6 System Endpoints

#### 15.6.1 `GET /api/tests/:id/monitor`

Purpose:
- Return real-time test progress summary for teacher monitoring.

Response includes:
- Active/submitted attempt counts and violation counters.

#### 15.6.2 `GET /api/tests/:id/analytics`

Purpose:
- Return score distribution and attempt status aggregates.

#### 15.6.3 `POST /api/tests/:id/result-publish`

Purpose:
- Publish selected attempt grades for student visibility.

Request:
- `attemptIds[]`

Response:
- Published count, failed count, and timestamp.

### 15.7 Status Code Summary

- `200 OK` successful read/update action
- `201 Created` resource created
- `400 Bad Request` validation failures
- `401 Unauthorized` auth missing/invalid
- `403 Forbidden` role mismatch
- `404 Not Found` unknown resource
- `409 Conflict` state transition conflict
- `429 Too Many Requests` throttled
- `500 Internal Server Error` unhandled failure

### 15.8 Open API Decisions

- Final auth transport details for route guards.
- Keep syntax-check as `200` with `isValid=false` for parser failures vs `400` only for malformed payload.
- Monitoring transport model: polling vs server-sent updates.
- Whether V1 grading supports per-question manual overrides or attempt-level adjustment only.
