#!/usr/bin/env node
/**
 * clear-question-bank.mjs — wipe the legacy MCQ question bank.
 *
 * After moving to the catalogue/ folder as the source-of-truth, the rows in
 * `question_bank` and `question_options` (seeded by old migrations 0005,
 * 0007, 0009) are no longer needed.
 *
 * Existing tests still grade correctly because every test_questions row
 * carries an immutable `question_snapshot` of the prompt/options/correct
 * answer. We just have to NULL out the legacy `question_bank_id` reference
 * before we can drop the bank rows it points to.
 *
 * Usage:
 *   node scripts/test-db/clear-question-bank.mjs --dry-run
 *   node scripts/test-db/clear-question-bank.mjs --confirm
 *
 * The script is intentionally NOT destructive without --confirm.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const defaultEnvFiles = [path.join(projectRoot, '.env.local'), path.join(projectRoot, '.env')];

function parseArgs(args) {
  const opts = { dryRun: false, confirm: false };
  for (const arg of args) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--confirm') opts.confirm = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function printHelp() {
  console.log('Wipe the legacy MCQ question_bank / question_options rows.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/test-db/clear-question-bank.mjs --dry-run   # preview row counts');
  console.log('  node scripts/test-db/clear-question-bank.mjs --confirm   # actually delete');
  console.log('');
  console.log('Snapshots in test_questions.question_snapshot keep all existing tests gradable.');
}

function parseEnvLine(line) {
  const i = line.indexOf('=');
  if (i <= 0) return null;
  const key = line.slice(0, i).trim();
  if (!key) return null;
  let value = line.slice(i + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

async function hydrateEnv() {
  for (const f of defaultEnvFiles) {
    const content = await fs.readFile(f, 'utf-8').catch((e) => {
      if (e?.code === 'ENOENT') return null;
      throw e;
    });
    if (!content) continue;
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (typeof process.env[parsed.key] === 'string') continue;
      process.env[parsed.key] = parsed.value;
    }
  }
}

function getConnectionString() {
  const v = process.env.TEST_DB_URL;
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new Error('TEST_DB_URL is required.');
  }
  return v.trim();
}

async function countRow(client, sqlText, params = []) {
  const result = await client.query(sqlText, params);
  return Number.parseInt(result.rows[0]?.count ?? '0', 10) || 0;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Argument error: ${error.message}`);
    printHelp();
    process.exit(1);
  }

  if (opts.help) {
    printHelp();
    return;
  }

  if (!opts.dryRun && !opts.confirm) {
    console.log('Refusing to run without --dry-run or --confirm.');
    printHelp();
    process.exit(1);
  }

  await hydrateEnv();
  const connectionString = getConnectionString();

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const totalBank = await countRow(client, 'SELECT COUNT(*)::text AS count FROM question_bank;');
    const totalOptions = await countRow(client, 'SELECT COUNT(*)::text AS count FROM question_options;');
    const linkedTestQuestions = await countRow(
      client,
      'SELECT COUNT(*)::text AS count FROM test_questions WHERE question_bank_id IS NOT NULL;',
    );
    const orphanCheck = await countRow(
      client,
      `SELECT COUNT(*)::text AS count
       FROM test_questions
       WHERE question_bank_id IS NOT NULL
         AND catalogue_question_id IS NULL
         AND (question_snapshot IS NULL OR question_snapshot->>'text' IS NULL);`,
    );

    console.log('Current state:');
    console.log(`  question_bank rows                 : ${totalBank}`);
    console.log(`  question_options rows              : ${totalOptions}`);
    console.log(`  test_questions referencing the bank: ${linkedTestQuestions}`);
    console.log('');

    if (orphanCheck > 0) {
      console.error(
        `✖ ${orphanCheck} test_questions row(s) reference the bank but have no usable snapshot.`,
      );
      console.error('  Aborting to avoid breaking those tests.');
      console.error('  Investigate `test_questions` rows where question_snapshot is empty before retrying.');
      process.exit(2);
    }

    if (opts.dryRun) {
      console.log('--dry-run: nothing was deleted.');
      console.log('Run again with --confirm to actually clear the question bank.');
      return;
    }

    console.log('Clearing legacy question bank...');
    await client.query('BEGIN');
    try {
      // 1) Detach test_questions from the legacy bank rows. Snapshots remain intact.
      const detachRes = await client.query(
        `UPDATE test_questions
         SET question_bank_id = NULL
         WHERE question_bank_id IS NOT NULL;`,
      );
      console.log(`  detached ${detachRes.rowCount ?? 0} test_questions row(s) from question_bank.`);

      // 2) Drop the bank itself. ON DELETE CASCADE on question_options handles its rows.
      const optionRes = await client.query('DELETE FROM question_options;');
      console.log(`  deleted ${optionRes.rowCount ?? 0} question_options row(s).`);

      const bankRes = await client.query('DELETE FROM question_bank;');
      console.log(`  deleted ${bankRes.rowCount ?? 0} question_bank row(s).`);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    console.log('');
    console.log('✔ Legacy question bank cleared. Catalogue is now the only source of MCQs.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('clear-question-bank failed:', error?.message ?? error);
  process.exit(1);
});
