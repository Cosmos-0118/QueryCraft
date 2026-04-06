# Security Model

Last updated: 2026-04-05

This document describes the security properties that are currently implemented in QueryCraft.

## Scope and Threat Model

QueryCraft is a local-first educational app. It is designed for single-device learning workflows, not enterprise identity or multi-tenant backend security.

Main security goals in the current architecture:

- Keep user workspace data separated per local account.
- Prevent accidental cross-account localStorage leakage.
- Apply baseline browser security headers.
- Keep SQL execution isolated from external databases.

## Implemented Controls

### 1. Browser Security Headers

Configured in `next.config.ts` via `headers()`:

- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security
- Permissions-Policy

### 2. Local Account Model

Implemented in `src/stores/auth-store.ts`:

- Accounts are stored locally on-device.
- Passwords are hashed in-browser using SHA-256 (`crypto.subtle.digest`).
- Active session user is tracked in sessionStorage.

Important: this is not a server-validated authentication model.

### 3. Per-User Data Scoping

Implemented by `src/lib/utils/user-storage.ts` and user-scoped persisted stores:

- Persisted data keys are namespaced as `querycraft:<userId>:<featureKey>`.
- Account deletion removes all scoped keys for that user.
- Store rehydration runs when active user scope changes.

### 4. SQL Execution Isolation

- SQL executes via sql.js (WASM SQLite) in browser memory.
- There is no connection to an external production database.
- The only API route (`/api/datasets`) reads local JSON seed files.

## Known Limitations

The following are currently not implemented:

- JWT or server-side session validation.
- HTTP-only auth cookies.
- Rate limiting.
- MFA.
- Server-side audit trails.

Additional practical considerations:

- localStorage/sessionStorage data can be exposed if the browser context is compromised.
- Account export/import transfers account metadata and password hash; treat export codes as sensitive.
- SHA-256 hashing here is for local verification, not a substitute for production password storage standards.

## Operational Guidance

If deployed publicly:

- Serve only over HTTPS.
- Keep dependencies up to date.
- Review CSP when adding third-party scripts.
- Avoid storing real personal or production data in local accounts.

## Reporting Security Issues

If you find a security issue, report it privately to project maintainers first, then coordinate disclosure and fix release.
