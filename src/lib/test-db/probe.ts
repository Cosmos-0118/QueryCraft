import { Client } from 'pg';
import { resolveTestDbConfig } from '@/lib/test-db/config';

const PROBE_QUERY = 'SELECT 1 AS probe';
const CONNECTION_NAME = 'test-module-postgres' as const;

interface BaseProbeShape {
  checkedAt: string;
}

export interface TestDbProbeDisabled extends BaseProbeShape {
  status: 'disabled';
  reason: string;
}

export interface TestDbProbeSuccess extends BaseProbeShape {
  status: 'ok';
  connectionName: typeof CONNECTION_NAME;
  host: string;
  port: number;
  database: string;
  ssl: boolean;
  query: typeof PROBE_QUERY;
  durationMs: number;
}

export interface TestDbProbeError extends BaseProbeShape {
  status: 'error';
  connectionName: typeof CONNECTION_NAME;
  host: string;
  port: number;
  database: string;
  ssl: boolean;
  durationMs: number;
  message: string;
  code?: string;
}

export type TestDbProbeResult = TestDbProbeDisabled | TestDbProbeSuccess | TestDbProbeError;

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === 'string' ? maybeCode : undefined;
}

export async function probeTestDbConnection(): Promise<TestDbProbeResult> {
  const checkedAt = new Date().toISOString();
  const config = resolveTestDbConfig();

  if (!config) {
    return {
      status: 'disabled',
      reason: 'TEST_DB_URL is not configured.',
      checkedAt,
    };
  }

  const startedAt = Date.now();
  const client = new Client({
    connectionString: config.connectionString,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    application_name: 'querycraft-test-db-probe',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
    query_timeout: 5_000,
  });

  try {
    await client.connect();
    await client.query(PROBE_QUERY);

    return {
      status: 'ok',
      connectionName: CONNECTION_NAME,
      host: config.host,
      port: config.port,
      database: config.database,
      ssl: config.ssl,
      query: PROBE_QUERY,
      durationMs: Date.now() - startedAt,
      checkedAt,
    };
  } catch (error) {
    return {
      status: 'error',
      connectionName: CONNECTION_NAME,
      host: config.host,
      port: config.port,
      database: config.database,
      ssl: config.ssl,
      durationMs: Date.now() - startedAt,
      checkedAt,
      message: error instanceof Error ? error.message : 'Unable to connect to Test DB.',
      code: getErrorCode(error),
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}