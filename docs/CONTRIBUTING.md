# Contributing to QueryCraft

Last updated: 2026-04-05

Thanks for contributing.

## Prerequisites

- Node.js 20+
- npm

## Local Setup

1. Clone the repository.
2. Install dependencies.
3. Start the development server.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

No environment variables are required for local development.

## Common Commands

```bash
npm run lint
npm run test
npm run test:watch
npm run build
npm run format
```

## Project Conventions

### TypeScript and Imports

- Use strict TypeScript patterns.
- Use the path alias `@/` for source imports where appropriate.

### State Persistence

- User-workspace stores are persisted with user-scoped keys.
- For new persisted stores, use `userScopedStateStorage` and a key from `STORAGE_BASE_KEYS`.
- Do not introduce shared localStorage keys that can leak state across accounts.

### SQL Runtime Changes

- If you modify SQL executor behavior, add or update tests in `tests/unit`.
- Keep statement splitting, compatibility translation, and runtime behavior in sync.

### UI/UX Changes

- Keep behavior responsive for desktop and smaller screens.
- Avoid introducing controls that break keyboard navigation.

### Documentation Changes

- Update docs for any change in routes, APIs, auth behavior, persistence, or scripts.
- Keep `README.md`, `docs/API.md`, and `docs/SECURITY.md` aligned with implementation.

## Pull Request Checklist

Before opening a PR, ensure:

- Lint passes.
- Relevant tests pass.
- New behavior has tests when practical.
- Documentation is updated for user-visible or architecture-impacting changes.
- PR description includes:
  - what changed
  - why it changed
  - how it was tested

## Areas That Need Help

- SQL compatibility edge cases.
- Parser/runtime test coverage expansion.
- Mobile layout polish across workspaces.
- Guided learning content and structured exercises.
