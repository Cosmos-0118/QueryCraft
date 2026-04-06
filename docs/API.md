# API Reference

Last updated: 2026-04-05

QueryCraft currently exposes one HTTP API route.

## Base Path

- `/api`

## Authentication

- No API authentication is implemented.
- The route below is publicly readable in the app context.

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

## Client Usage

The frontend helper `src/lib/seed-datasets.ts` calls this endpoint with:

- method `GET`
- `cache: no-store`
