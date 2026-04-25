const SUPPORTED_TEST_DB_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const SSL_MODE_TRUE_VALUES = new Set(['prefer', 'require', 'verify-ca', 'verify-full']);
const SSL_BOOL_TRUE_VALUES = new Set(['1', 'true', 'yes']);

function normalizeConnectionString(rawConnectionString: string) {
  const parsed = new URL(rawConnectionString);
  const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase().trim() ?? '';

  if (sslMode === 'prefer' || sslMode === 'require' || sslMode === 'verify-ca') {
    parsed.searchParams.set('sslmode', 'verify-full');
  }

  return parsed;
}

export interface TestDbConfig {
  connectionString: string;
  host: string;
  port: number;
  database: string;
  ssl: boolean;
}

export function readTestDbUrlFromEnv(): string | null {
  const raw = process.env.TEST_DB_URL;
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveTestDbConfig(): TestDbConfig | null {
  const rawConnectionString = readTestDbUrlFromEnv();
  if (!rawConnectionString) return null;

  const parsed = normalizeConnectionString(rawConnectionString);
  if (!SUPPORTED_TEST_DB_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(
      `TEST_DB_URL must use a PostgreSQL protocol (${Array.from(SUPPORTED_TEST_DB_PROTOCOLS).join(', ')})`,
    );
  }

  const database = parsed.pathname.replace(/^\//, '');
  if (!database) {
    throw new Error('TEST_DB_URL must include a database name in the path segment.');
  }

  const port = parsed.port ? Number(parsed.port) : 5432;
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('TEST_DB_URL must include a valid port when specified.');
  }

  const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase().trim() ?? '';
  const sslFlag = parsed.searchParams.get('ssl')?.toLowerCase().trim() ?? '';
  const ssl = SSL_MODE_TRUE_VALUES.has(sslMode) || SSL_BOOL_TRUE_VALUES.has(sslFlag);

  return {
    connectionString: parsed.toString(),
    host: parsed.hostname,
    port,
    database,
    ssl,
  };
}
