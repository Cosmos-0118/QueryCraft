# QueryCraft Roadmap

Last updated: 2026-04-11

This roadmap reflects what is actually implemented in the current codebase and what is planned next.

## Current State (Shipped)

Core product:

- Multi-workspace dashboard for DBMS learning.
- Device-local accounts and per-user data isolation.
- Persisted workspace state across sessions.

Learning workspaces:

- SQL Sandbox with sql.js runtime, schema browsing, query history, import/export, and statement-level output.
- Relational Algebra workspace with parser, evaluator, tree visualization, and SQL conversion.
- Tuple Relational Calculus workspace with parser + SQL translation.
- ER Builder with drag-and-drop canvas, conversion to relational schema, and PNG export.
- Normalization workspace for FD analysis and decomposition.
- Table Generator with semantic column hints and Faker-backed data generation.
- SQL reference page for command lookup and examples.

Platform:

- Next.js 16 + React 19.
- Tailwind v4 styling system.
- CSP and secure headers via Next config.
- Unit tests for SQL executor, parser/runtime components, and generator utilities.

## Near-Term Priorities

1. SQL Engine Reliability and Coverage

- Harden compatibility edge cases for ALTER/DDL variants and procedural parsing.
- Expand regression coverage for mixed multi-statement scripts and error diagnostics.

2. Workspace UX Refinement

- Improve panel/popover alignment and readability in SQL Sandbox overlays.
- Improve control density and responsive layout in top action bars on smaller screens.

3. Learning Content Depth

- Expand reference content quality and consistency.
- Add guided walkthrough flows built on top of existing workspaces.

4. Testing Quality

- Replace placeholder validator test with meaningful validation tests.
- Add integration-oriented tests around persisted state replay and account switching behavior.

5. Test Module (Teacher and Student Assessment)

- Add a dedicated Test feature where teachers create and publish tests with shareable codes.
- Support teacher-selected question type mode per test: MCQ-only, SQL fill-in-only, or mixed.
- Keep mixed mode mostly MCQ by default while allowing bounded SQL fill-in composition.
- Include anti-cheat enforcement (first tab switch warning, second switch force-submit, clipboard restrictions).
- Implement student join-by-code, timed attempts, teacher review, and result publishing flow.
- Maintain detailed execution plan in docs/Roadmap.md.

## Mid-Term Milestones

1. Guided Lesson Engine (Structured Learning Mode)

- Topic-based progress flows.
- Repeatable step-state model and completion tracking.

2. Better Dataset Tooling

- Import validation and schema preview before load.
- Dataset management UX for custom user datasets.

3. Observability and Diagnostics

- Better surfaced parser/runtime errors with context snippets.
- Optional debug traces for translation/evaluation steps.

## Long-Term Directions

1. Collaboration Options

- Optional shared sessions for classroom use.
- Instructor presets and assignment templates.

2. Broader SQL Dialect Coverage

- Additional compatibility layers and dialect toggles.

3. Accessibility and Internationalization

- Keyboard-first workflows across all workspaces.
- Locale-aware formatting and translatable content structure.

## Non-Goals (Current Scope)

- Production-grade cloud authentication.
- Multi-tenant backend data storage.
- Running against live external databases.

The current product is designed as a local-first educational environment.
