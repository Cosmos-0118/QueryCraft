import { Pool, type PoolClient, type QueryResult } from 'pg';
import { resolveTestDbConfig } from '@/lib/test-db/config';

let pool: Pool | null = null;

function resolvePoolMax() {
  const raw = process.env.TEST_DB_POOL_MAX?.trim();
  if (!raw) return 20;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 20;
  }

  return Math.min(parsed, 40);
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
  });

  return pool;
}


export async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  const dbPool = getPool();
  // Simple template tag implementation
  let text = '';
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) text += `$${i + 1}`;
  }

  const res = await dbPool.query(text, values);
  return res;
}

sql.raw = async function (text: string, values: unknown[]) {
  const dbPool = getPool();
  const res = await dbPool.query(text, values);
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
