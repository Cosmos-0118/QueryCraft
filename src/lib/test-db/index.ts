import { Pool } from 'pg';
import { resolveTestDbConfig } from '@/lib/test-db/config';

let pool: Pool | null = null;

function getPool() {
  if (pool) return pool;

  const config = resolveTestDbConfig();
  if (!config) throw new Error('TEST_DB_URL is not configured.');

  pool = new Pool({
    connectionString: config.connectionString,
    max: 8,
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
