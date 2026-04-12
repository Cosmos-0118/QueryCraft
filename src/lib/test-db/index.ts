import { Pool, type PoolClient, type QueryResult } from 'pg';
import { resolveTestDbConfig } from '@/lib/test-db/config';

let pool: Pool | null = null;

const TRANSIENT_NETWORK_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  '57P01',
]);

function resolvePoolMax() {
  const raw = process.env.TEST_DB_POOL_MAX?.trim();
  if (!raw) return 20;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 20;
  }

  return Math.min(parsed, 40);
}

function resolveQueryRetries() {
  const raw = process.env.TEST_DB_QUERY_RETRIES?.trim();
  if (!raw) return 2;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 2;
  }

  return Math.min(parsed, 5);
}

function resolveRetryDelayMs() {
  const raw = process.env.TEST_DB_RETRY_DELAY_MS?.trim();
  if (!raw) return 150;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 25) {
    return 150;
  }

  return Math.min(parsed, 1_000);
}

function extractErrorCodes(error: unknown): string[] {
  const codes = new Set<string>();

  const readCode = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const maybeCode = (value as { code?: unknown }).code;
    if (typeof maybeCode === 'string' && maybeCode.length > 0) {
      codes.add(maybeCode);
    }
  };

  readCode(error);

  if (error && typeof error === 'object') {
    const nestedErrors = (error as { errors?: unknown }).errors;
    if (Array.isArray(nestedErrors)) {
      for (const nested of nestedErrors) {
        readCode(nested);
      }
    }
  }

  return [...codes];
}

function isTransientDbError(error: unknown) {
  const codes = extractErrorCodes(error);
  if (codes.some((code) => TRANSIENT_NETWORK_ERROR_CODES.has(code))) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('timeout') || message.includes('connection terminated unexpectedly');
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runQueryWithRetry(text: string, values: unknown[] = []): Promise<QueryResult> {
  const retries = resolveQueryRetries();
  const baseDelayMs = resolveRetryDelayMs();

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const dbPool = getPool();
      return await dbPool.query(text, values);
    } catch (error) {
      const shouldRetry = attempt < retries && isTransientDbError(error);
      if (!shouldRetry) {
        throw error;
      }

      await wait(baseDelayMs * (attempt + 1));
    }
  }

  throw new Error('Database query retry loop exited unexpectedly.');
}

function getPool() {
  if (pool) return pool;

  const config = resolveTestDbConfig();
  if (!config) throw new Error('TEST_DB_URL is not configured.');

  pool = new Pool({
    connectionString: config.connectionString,
    max: resolvePoolMax(),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  return pool;
}


export async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  // Simple template tag implementation
  let text = '';
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) text += `$${i + 1}`;
  }

  const res = await runQueryWithRetry(text, values);
  return res;
}

sql.raw = async function (text: string, values: unknown[] = []) {
  const res = await runQueryWithRetry(text, values);
  return res;
};

export interface DbExecutor {
  raw: (text: string, values?: unknown[]) => Promise<QueryResult>;
}

export async function withTransaction<T>(
  run: (tx: DbExecutor) => Promise<T>,
): Promise<T> {
  const dbPool = getPool();
  const client: PoolClient = await dbPool.connect();

  const tx: DbExecutor = {
    raw: (text: string, values: unknown[] = []) => client.query(text, values),
  };

  try {
    await client.query('BEGIN');
    const result = await run(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures to preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}
