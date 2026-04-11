## Test DB Migrations

Migration files follow this naming pattern:

- `0001_some_change.up.sql`
- `0001_some_change.down.sql`

Rules:

- Keep version numbers zero-padded and increasing.
- Every `up` file should have a matching `down` file.
- Keep each migration focused and reversible in development.

Run commands:

- `npm run test-db:migrate:status`
- `npm run test-db:migrate`
- `npm run test-db:migrate:down`
- `npm run test-db:migrate:down:all`

The migration runner uses `TEST_DB_URL`.