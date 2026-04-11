import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const MIGRATIONS_TABLE = 'test_db_migrations';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const migrationsDir = path.join(projectRoot, 'src', 'lib', 'test-db', 'migrations');
const defaultEnvFiles = [path.join(projectRoot, '.env.local'), path.join(projectRoot, '.env')];

function parseArgs(rawArgs) {
  const [command = 'up', ...rest] = rawArgs;
  const options = {
    all: false,
    to: null,
  };

  for (const arg of rest) {
    if (arg === '--all') {
      options.all = true;
      continue;
    }

    if (arg.startsWith('--to=')) {
      options.to = arg.slice('--to='.length);
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, options };
}

function printHelp() {
  console.log('QueryCraft Test DB migrations');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/test-db/migrate.mjs up');
  console.log('  node scripts/test-db/migrate.mjs up --to=0002');
  console.log('  node scripts/test-db/migrate.mjs down');
  console.log('  node scripts/test-db/migrate.mjs down --all');
  console.log('  node scripts/test-db/migrate.mjs down --to=0001');
  console.log('  node scripts/test-db/migrate.mjs status');
  console.log('');
  console.log('Environment:');
  console.log('  TEST_DB_URL must be set to a postgres/postgresql connection string.');
}

function getConnectionString() {
  const value = process.env.TEST_DB_URL;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('TEST_DB_URL is required to run Test DB migrations.');
  }

  return value.trim();
}

function parseEnvLine(line) {
  const separatorIndex = line.indexOf('=');
  if (separatorIndex <= 0) return null;

  const key = line.slice(0, separatorIndex).trim();
  if (!key) return null;

  let value = line.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

async function hydrateEnvFromFiles() {
  for (const filePath of defaultEnvFiles) {
    const content = await fs.readFile(filePath, 'utf-8').catch((error) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return null;
      }

      throw error;
    });

    if (!content) continue;

    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parsed = parseEnvLine(trimmed);
      if (!parsed) continue;

      if (typeof process.env[parsed.key] === 'string') continue;
      process.env[parsed.key] = parsed.value;
    }
  }
}

function checksum(input) {
  return createHash('sha256').update(input).digest('hex');
}

function toMigrationMeta(fileName) {
  const matched = /^(\d{4,})_([a-z0-9_]+)\.up\.sql$/i.exec(fileName);
  if (!matched) return null;

  const [, version, slug] = matched;
  return {
    version,
    slug,
    upFileName: fileName,
    downFileName: `${version}_${slug}.down.sql`,
  };
}

async function loadMigrations() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });

  const migrations = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const meta = toMigrationMeta(entry.name);
    if (!meta) continue;

    const upPath = path.join(migrationsDir, meta.upFileName);
    const downPath = path.join(migrationsDir, meta.downFileName);
    const [upSql, downSqlOrNull] = await Promise.all([
      fs.readFile(upPath, 'utf-8'),
      fs.readFile(downPath, 'utf-8').catch((error) => {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
          return null;
        }

        throw error;
      }),
    ]);

    migrations.push({
      ...meta,
      name: meta.slug.replace(/_/g, '-'),
      upPath,
      downPath,
      upSql,
      downSql: downSqlOrNull,
      upChecksum: checksum(upSql),
    });
  }

  migrations.sort((a, b) => a.version.localeCompare(b.version));
  return migrations;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version text PRIMARY KEY,
      name text NOT NULL,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function loadAppliedMigrations(client) {
  const result = await client.query(
    `SELECT version, name, checksum, applied_at FROM ${MIGRATIONS_TABLE} ORDER BY version ASC;`,
  );
  return result.rows;
}

async function runMigrationUp(client, migration) {
  await client.query('BEGIN');
  try {
    await client.query(migration.upSql);
    await client.query(
      `
      INSERT INTO ${MIGRATIONS_TABLE} (version, name, checksum)
      VALUES ($1, $2, $3);
      `,
      [migration.version, migration.name, migration.upChecksum],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function runMigrationDown(client, migration) {
  if (!migration.downSql) {
    throw new Error(`Down migration missing for version ${migration.version} (${migration.downFileName}).`);
  }

  await client.query('BEGIN');
  try {
    await client.query(migration.downSql);
    await client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE version = $1;`, [migration.version]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

function selectPendingMigrations(migrations, appliedSet, toVersion) {
  const pending = migrations.filter((migration) => !appliedSet.has(migration.version));
  if (!toVersion) return pending;

  return pending.filter((migration) => migration.version.localeCompare(toVersion) <= 0);
}

function selectRollbackMigrations(migrations, appliedRows, options) {
  const byVersion = new Map(migrations.map((migration) => [migration.version, migration]));
  const appliedInRepoOrder = [];

  for (const row of appliedRows) {
    const migration = byVersion.get(row.version);
    if (!migration) {
      throw new Error(
        `Applied migration ${row.version} exists in database but the SQL files are missing from ${migrationsDir}.`,
      );
    }

    appliedInRepoOrder.push(migration);
  }

  if (options.all) {
    return appliedInRepoOrder.reverse();
  }

  if (options.to) {
    return appliedInRepoOrder
      .filter((migration) => migration.version.localeCompare(options.to) > 0)
      .reverse();
  }

  return appliedInRepoOrder.length > 0 ? [appliedInRepoOrder[appliedInRepoOrder.length - 1]] : [];
}

function validateAppliedChecksums(migrations, appliedRows) {
  const byVersion = new Map(migrations.map((migration) => [migration.version, migration]));

  for (const row of appliedRows) {
    const migration = byVersion.get(row.version);
    if (!migration) {
      continue;
    }

    if (row.checksum !== migration.upChecksum) {
      throw new Error(
        `Checksum mismatch for applied migration ${row.version}. Expected ${migration.upChecksum}, found ${row.checksum}.`,
      );
    }
  }
}

function printStatus(migrations, appliedRows) {
  const appliedMap = new Map(appliedRows.map((row) => [row.version, row]));
  const payload = migrations.map((migration) => {
    const applied = appliedMap.get(migration.version);
    return {
      version: migration.version,
      name: migration.name,
      applied: Boolean(applied),
      appliedAt: applied ? applied.applied_at : null,
      hasDown: Boolean(migration.downSql),
    };
  });

  if (payload.length === 0) {
    console.log('No migration files found.');
    return;
  }

  console.table(payload);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (!['up', 'down', 'status'].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  await hydrateEnvFromFiles();
  const migrations = await loadMigrations();
  const client = new Client({
    connectionString: getConnectionString(),
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
    query_timeout: 30_000,
  });

  await client.connect();
  try {
    await ensureMigrationsTable(client);
    const appliedRows = await loadAppliedMigrations(client);
    validateAppliedChecksums(migrations, appliedRows);

    if (command === 'status') {
      printStatus(migrations, appliedRows);
      return;
    }

    if (command === 'up') {
      const appliedSet = new Set(appliedRows.map((row) => row.version));
      const pending = selectPendingMigrations(migrations, appliedSet, options.to);

      if (pending.length === 0) {
        console.log('No pending migrations.');
        return;
      }

      for (const migration of pending) {
        console.log(`Applying ${migration.version} (${migration.name})`);
        await runMigrationUp(client, migration);
      }

      console.log(`Applied ${pending.length} migration(s).`);
      return;
    }

    const rollbackList = selectRollbackMigrations(migrations, appliedRows, options);
    if (rollbackList.length === 0) {
      console.log('No applied migrations to roll back.');
      return;
    }

    for (const migration of rollbackList) {
      console.log(`Rolling back ${migration.version} (${migration.name})`);
      await runMigrationDown(client, migration);
    }

    console.log(`Rolled back ${rollbackList.length} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unexpected migration error.';
  console.error(message);
  process.exitCode = 1;
});