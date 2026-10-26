import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';

const require = createRequire(import.meta.url);
const deployedWasmPath = fileURLToPath(new URL('../../../public/sql-wasm.wasm', import.meta.url));
const deployedWasm = readFileSync(deployedWasmPath);

describe('deployed SQL runtime', () => {
  it('ships the WASM binary matching the installed JavaScript runtime', () => {
    expect(deployedWasm.equals(readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm')))).toBe(true);
  });

  it('initializes and executes SQL with the public WASM asset', async () => {
    const SQL = await initSqlJs({ locateFile: () => deployedWasmPath });
    const db = new SQL.Database();
    try {
      expect(db.exec('SELECT 1 + 1 AS result')).toEqual([
        { columns: ['result'], values: [[2]] },
      ]);
    } finally {
      db.close();
    }
  });
});
