import { type TestDbConfig, resolveTestDbConfig } from '@/lib/test-db/config';

export interface TestDbBootstrapReady {
  status: 'ready';
  connectionName: 'test-module-postgres';
  driver: 'postgres';
  host: string;
  port: number;
  database: string;
  ssl: boolean;
  initializedAt: string;
}

export interface TestDbBootstrapDisabled {
  status: 'disabled';
  reason: string;
}

export type TestDbBootstrapState = TestDbBootstrapReady | TestDbBootstrapDisabled;

let cachedConfig: TestDbConfig | null | undefined;
let cachedState: TestDbBootstrapState | null = null;

function getCachedConfig(): TestDbConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;

  cachedConfig = resolveTestDbConfig();
  return cachedConfig;
}

export function bootstrapTestDbConnection(): TestDbBootstrapState {
  if (cachedState) return cachedState;

  const config = getCachedConfig();
  if (!config) {
    cachedState = {
      status: 'disabled',
      reason: 'TEST_DB_URL is not configured.',
    };
    return cachedState;
  }

  cachedState = {
    status: 'ready',
    connectionName: 'test-module-postgres',
    driver: 'postgres',
    host: config.host,
    port: config.port,
    database: config.database,
    ssl: config.ssl,
    initializedAt: new Date().toISOString(),
  };

  return cachedState;
}

export function hasTestDbConfiguration(): boolean {
  return getCachedConfig() !== null;
}
