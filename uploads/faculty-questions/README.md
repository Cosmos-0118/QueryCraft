# Faculty question uploads (temporary)

Faculty members can upload question packs as JSON files. They land in this
folder and are **automatically pruned after a configurable number of days**
(default: 14) by `scripts/cleanup-faculty-uploads.mjs`.

These uploads are intentionally **not** part of the curated catalogue at
`/catalogue/`. The catalogue is the long-lived source of truth; this folder
is a scratch area for ad-hoc question packs that a faculty member wants to
use for a specific test before the questions are reviewed and (optionally)
promoted into the curated catalogue.

## File format

Each upload is a JSON file matching the same schema as `/catalogue/unitN.json`:

```json
{
  "uploaded_by": "teacher@example.com",
  "test_id": "optional-test-uuid",
  "unit": 99,
  "title": "Spring 2026 Mid-term — extra MCQs",
  "questions": [
    {
      "id": "fac-2026-q001",
      "prompt": "Which isolation level prevents phantom reads?",
      "options": [
        { "key": "A", "text": "Read Uncommitted" },
        { "key": "B", "text": "Read Committed" },
        { "key": "C", "text": "Repeatable Read" },
        { "key": "D", "text": "Serializable" }
      ],
      "correct_answer": "D",
      "difficulty": "medium",
      "marks": 1,
      "explanation": "Only Serializable prevents phantoms in the SQL standard."
    }
  ]
}
```

The `id` of each question must be unique within the file. Prefix it with
`fac-` (or any non-`u{N}-` prefix) to avoid colliding with curated catalogue
ids.

## File naming

Uploads are written by the upload API as:

```
<timestamp>-<faculty-id>-<random>.json
```

You may also drop files in manually with any name ending in `.json`.

## Retention

`scripts/cleanup-faculty-uploads.mjs` deletes any `.json` whose mtime is
older than the configured retention window (default 14 days). Set
`FACULTY_UPLOADS_RETENTION_DAYS` in `.env.local` to override.

Run it on a schedule (cron / scheduled task / Vercel Cron):

```sh
node scripts/cleanup-faculty-uploads.mjs
node scripts/cleanup-faculty-uploads.mjs --days=7
node scripts/cleanup-faculty-uploads.mjs --dry-run
```
