#!/usr/bin/env node
/**
 * sync-catalogue.mjs — index the file-backed MCQ catalogue into the DB.
 *
 * Usage:
 *   node scripts/test-db/sync-catalogue.mjs           # sync (upsert + delete-stale)
 *   node scripts/test-db/sync-catalogue.mjs --dry-run # show what would change
 *   node scripts/test-db/sync-catalogue.mjs --keep-stale  # don't delete missing rows
 *
 * The catalogue files live in <repo-root>/catalogue/unit{N}.json.
 * Run this whenever you add / edit / remove a question in those files.
 *
 * Source-of-truth: the JSON files. The DB row is just a queryable index.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const catalogueDir = path.join(projectRoot, 'catalogue');
const defaultEnvFiles = [path.join(projectRoot, '.env.local'), path.join(projectRoot, '.env')];

const PREVIEW_MAX = 240;

function parseArgs(args) {
  const opts = { dryRun: false, keepStale: false };
  for (const arg of args) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--keep-stale') opts.keepStale = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function printHelp() {
  console.log('Sync catalogue/*.json into the catalogue_question_index table.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/test-db/sync-catalogue.mjs');
  console.log('  node scripts/test-db/sync-catalogue.mjs --dry-run');
  console.log('  node scripts/test-db/sync-catalogue.mjs --keep-stale');
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

function clip(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function hashPayload(payload) {
  // payload is a deterministic JSON string of the catalogue question.
  return createHash('sha256').update(payload).digest('hex');
}

function normalizeOption(option, idx) {
  if (!option || typeof option !== 'object') return null;
  const text = typeof option.text === 'string' ? option.text.trim() : '';
  if (!text) return null;
  const rawKey = typeof option.key === 'string' && option.key.trim().length > 0
    ? option.key.trim()
    : String.fromCharCode(65 + idx);
  return { key: rawKey.toUpperCase(), text };
}

function normalizeQuestion(raw, unit) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  const correct = typeof raw.correct_answer === 'string' ? raw.correct_answer.trim().toUpperCase() : '';
  const optionsRaw = Array.isArray(raw.options) ? raw.options : [];
  if (!id || !prompt || !correct) return null;

  const options = optionsRaw.map((opt, idx) => normalizeOption(opt, idx)).filter(Boolean);
  if (options.length < 2) return null;
  if (!options.some((o) => o.key === correct)) return null;

  const difficulty = (raw.difficulty === 'easy' || raw.difficulty === 'medium' || raw.difficulty === 'hard')
    ? raw.difficulty
    : 'medium';
  const marks = typeof raw.marks === 'number' && Number.isFinite(raw.marks) ? raw.marks : 1;
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';

  return {
    id,
    unit,
    prompt,
    options,
    correct_answer: correct,
    difficulty,
    marks,
    explanation,
  };
}

async function loadCatalogueFromDisk() {
  let entries;
  try {
    entries = await fs.readdir(catalogueDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Catalogue folder not found: ${catalogueDir}`);
    }
    throw error;
  }

  const files = entries
    .filter((e) => e.isFile() && /^unit\d+\.json$/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const questions = [];
  const seenIds = new Set();
  let totalSkipped = 0;

  for (const fileEntry of files) {
    const fileName = fileEntry.name;
    const match = /^unit(\d+)\.json$/i.exec(fileName);
    if (!match) continue;
    const unit = Number.parseInt(match[1], 10);

    const filePath = path.join(catalogueDir, fileName);
    const raw = await fs.readFile(filePath, 'utf-8');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${fileName} is not valid JSON: ${error.message}`);
    }

    const items = Array.isArray(parsed?.questions) ? parsed.questions : [];
    let kept = 0;
    let skipped = 0;
    for (const item of items) {
      const normalized = normalizeQuestion(item, unit);
      if (!normalized) {
        skipped += 1;
        continue;
      }
      if (seenIds.has(normalized.id)) {
        console.warn(`  ⚠ duplicate catalogue id "${normalized.id}" in ${fileName} — skipped`);
        skipped += 1;
        continue;
      }
      seenIds.add(normalized.id);

      const payload = JSON.stringify({
        id: normalized.id,
        unit: normalized.unit,
        prompt: normalized.prompt,
        options: normalized.options,
        correct_answer: normalized.correct_answer,
        difficulty: normalized.difficulty,
        marks: normalized.marks,
        explanation: normalized.explanation,
      });

      questions.push({
        ...normalized,
        source_file: fileName,
        content_hash: hashPayload(payload),
      });
      kept += 1;
    }

    totalSkipped += skipped;
    console.log(`  • ${fileName}: ${kept} kept, ${skipped} skipped`);
  }

  return { questions, totalSkipped };
}

async function ensureIndexTable(client) {
  const result = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1;`,
    ['catalogue_question_index'],
  );
  if (result.rowCount === 0) {
    throw new Error(
      'Table "catalogue_question_index" does not exist. Run `node scripts/test-db/migrate.mjs up` first.',
    );
  }
}

async function loadExistingIndex(client) {
  const result = await client.query(
    `SELECT catalogue_id, content_hash FROM catalogue_question_index;`,
  );
  const map = new Map();
  for (const row of result.rows) {
    map.set(row.catalogue_id, row.content_hash);
  }
  return map;
}

async function upsertQuestion(client, question) {
  const preview = clip(question.prompt, PREVIEW_MAX);
  await client.query(
    `
    INSERT INTO catalogue_question_index (
      catalogue_id, unit, difficulty, marks, prompt_preview,
      option_count, correct_answer, has_explanation, source_file, content_hash,
      imported_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
    ON CONFLICT (catalogue_id) DO UPDATE SET
      unit = EXCLUDED.unit,
      difficulty = EXCLUDED.difficulty,
      marks = EXCLUDED.marks,
      prompt_preview = EXCLUDED.prompt_preview,
      option_count = EXCLUDED.option_count,
      correct_answer = EXCLUDED.correct_answer,
      has_explanation = EXCLUDED.has_explanation,
      source_file = EXCLUDED.source_file,
      content_hash = EXCLUDED.content_hash,
      updated_at = now();
    `,
    [
      question.id,
      question.unit,
      question.difficulty,
      question.marks,
      preview,
      question.options.length,
      question.correct_answer,
      Boolean(question.explanation),
      question.source_file,
      question.content_hash,
    ],
  );
}

async function deleteStale(client, staleIds) {
  if (staleIds.length === 0) return;
  await client.query(
    `DELETE FROM catalogue_question_index WHERE catalogue_id = ANY($1::text[]);`,
    [staleIds],
  );
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

  await hydrateEnv();
  const connectionString = getConnectionString();

  console.log('Reading catalogue files...');
  const { questions, totalSkipped } = await loadCatalogueFromDisk();
  console.log(`Loaded ${questions.length} valid questions (skipped ${totalSkipped}).`);

  if (questions.length === 0) {
    console.warn('No questions to sync. Exiting.');
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await ensureIndexTable(client);
    const existing = await loadExistingIndex(client);

    const incomingIds = new Set(questions.map((q) => q.id));
    const staleIds = [...existing.keys()].filter((id) => !incomingIds.has(id));

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const q of questions) {
      const prevHash = existing.get(q.id);
      if (!prevHash) {
        inserted += 1;
      } else if (prevHash !== q.content_hash) {
        updated += 1;
      } else {
        unchanged += 1;
      }
    }

    console.log('');
    console.log('Plan:');
    console.log(`  inserts:   ${inserted}`);
    console.log(`  updates:   ${updated}`);
    console.log(`  unchanged: ${unchanged}`);
    console.log(`  stale:     ${staleIds.length}${opts.keepStale ? ' (will be kept)' : ' (will be deleted)'}`);

    if (opts.dryRun) {
      console.log('');
      console.log('--dry-run: no changes were applied.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const q of questions) {
        const prevHash = existing.get(q.id);
        if (prevHash === q.content_hash) continue;
        await upsertQuestion(client, q);
      }
      if (!opts.keepStale) {
        await deleteStale(client, staleIds);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    console.log('');
    console.log('✔ Catalogue index synchronized.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('sync-catalogue failed:', error?.message ?? error);
  process.exit(1);
});
