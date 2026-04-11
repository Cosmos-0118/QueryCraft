# API Reference

Last updated: 2026-04-11

QueryCraft currently exposes API routes for dataset loading and Test DB health diagnostics.

Planning note:

- Phase 0 draft contracts for the Test module are consolidated in:
  - `docs/Roadmap.md` (Section 14: Schema Draft)
  - `docs/Roadmap.md` (Section 15: API Contract Draft)

## Base Path

- `/api`

## Authentication

- No API authentication is implemented.
- The routes below are publicly readable in the app context.

## Endpoints

### GET /api/datasets

Loads seed datasets from JSON files in `seed/datasets`.

Source implementation: `src/app/api/datasets/route.ts`

#### Request

- Method: `GET`
- Body: none
- Query params: none

#### Success Response

Status: `200 OK`

```json
{
  "datasets": [
    {
      "name": "banking",
      "data": {
        "customers": [],
        "accounts": []
      }
    }
  ]
}
```

Notes:

- `name` is derived from each `.json` filename (lowercased, extension removed).
- Only JSON files that parse to objects are included.
- Files are sorted by filename.

#### Error Response

Status: `500 Internal Server Error`

```json
{
  "error": "Unable to read datasets",
  "datasets": []
}
```

The exact `error` string is based on the thrown filesystem/parsing error.

### GET /api/tests/health

Returns the Test DB bootstrap/configuration health state.

Source implementation: `src/app/api/tests/health/route.ts`

#### Request

- Method: `GET`
- Body: none
- Query params: none

#### Success Response (Configured)

Status: `200 OK`

```json
{
  "service": "test-db",
  "status": "ready",
  "connectionName": "test-module-postgres",
  "driver": "postgres",
  "host": "localhost",
  "port": 5432,
  "database": "querycraft_test",
  "ssl": false,
  "initializedAt": "2026-04-11T12:00:00.000Z",
  "checkedAt": "2026-04-11T12:00:00.000Z"
}
```

#### Success Response (Not Configured)

Status: `200 OK`

```json
{
  "service": "test-db",
  "status": "disabled",
  "reason": "TEST_DB_URL is not configured.",
  "checkedAt": "2026-04-11T12:00:00.000Z"
}
```

#### Error Response

Status: `500 Internal Server Error`

```json
{
  "service": "test-db",
  "status": "error",
  "checkedAt": "2026-04-11T12:00:00.000Z",
  "message": "TEST_DB_URL must use a PostgreSQL protocol (postgres:, postgresql:)"
}
```

### GET /api/tests/health/probe

Runs a live connectivity probe against Test DB using `SELECT 1`.

Source implementation: `src/app/api/tests/health/probe/route.ts`

#### Request

- Method: `GET`
- Body: none
- Query params: none

#### Success Response (Connected)

Status: `200 OK`

```json
{
  "status": "ok",
  "connectionName": "test-module-postgres",
  "host": "localhost",
  "port": 5432,
  "database": "querycraft_test",
  "ssl": false,
  "query": "SELECT 1 AS probe",
  "durationMs": 5,
  "checkedAt": "2026-04-11T12:00:00.000Z"
}
```

#### Success Response (Not Configured)

Status: `200 OK`

```json
{
  "status": "disabled",
  "reason": "TEST_DB_URL is not configured.",
  "checkedAt": "2026-04-11T12:00:00.000Z"
}
```

#### Error Response (Connection Failure)

Status: `503 Service Unavailable`

```json
{
  "status": "error",
  "connectionName": "test-module-postgres",
  "host": "localhost",
  "port": 5432,
  "database": "querycraft_test",
  "ssl": false,
  "durationMs": 14,
  "checkedAt": "2026-04-11T12:00:00.000Z",
  "message": "password authentication failed for user \"postgres\"",
  "code": "28P01"
}
```

#### Error Response (Unexpected)

Status: `500 Internal Server Error`

```json
{
  "status": "error",
  "checkedAt": "2026-04-11T12:00:00.000Z",
  "message": "Unexpected Test DB probe failure."
}
```

## Client Usage

The frontend helper `src/lib/seed-datasets.ts` calls this endpoint with:

- method `GET`
- `cache: no-store`
