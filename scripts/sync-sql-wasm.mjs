import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// The browser runtime must use the WASM binary from the installed sql.js version.
copyFileSync(
  require.resolve('sql.js/dist/sql-wasm.wasm'),
  new URL('../public/sql-wasm.wasm', import.meta.url),
);
