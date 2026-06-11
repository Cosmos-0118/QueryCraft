## Test DB Migrations

Each migration lives in its own directory:

- `0001_some_change/up.sql`
- `0001_some_change/down.sql`

The directory name must be `NNNN_snake_case_description` (version prefix + slug). `up.sql` / `down.sql` are fixed filenames inside that folder.

Rules:

- Keep version numbers zero-padded and increasing.
- Every migration folder must include both `up.sql` and `down.sql`.
- Keep each migration focused and reversible in development.

Run commands:

- `npm run test-db:migrate:status`
- `npm run test-db:migrate`
- `npm run test-db:migrate:down`
- `npm run test-db:migrate:down:all`

The migration runner uses `TEST_DB_URL`.