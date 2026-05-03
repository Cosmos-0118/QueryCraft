#!/usr/bin/env node
/**
 * Seed catalogue/unit*.json MCQ data into question_bank/question_options.
 *
 * This script is idempotent:
 * - existing catalogue rows are updated in place when content changes;
 * - unchanged rows are skipped;
 * - duplicate catalogue ids in JSON are skipped gracefully.
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

function parseArgs(args) {
  const opts = { dryRun: false };
  for (const arg of args) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function printHelp() {
  console.log('Seed catalogue/unit*.json into question_bank/question_options.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/test-db/seed-catalogue-to-db.mjs');
  console.log('  node scripts/test-db/seed-catalogue-to-db.mjs --dry-run');
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
      const existingValue = process.env[parsed.key];
      if (typeof existingValue === 'string' && existingValue.trim().length > 0) continue;
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

function normalizeOption(option, idx) {
  if (!option || typeof option !== 'object') return null;
  const text = typeof option.text === 'string' ? option.text.trim() : '';
  if (!text) return null;
  const rawKey = typeof option.key === 'string' && option.key.trim().length > 0
    ? option.key.trim()
    : String.fromCharCode(65 + idx);
  const key = rawKey.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
  if (!key) return null;
  return { key, text };
}

function normalizeQuestion(raw, unit, fileName) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  const correct = typeof raw.correct_answer === 'string'
    ? raw.correct_answer.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1)
    : '';
  const optionsRaw = Array.isArray(raw.options) ? raw.options : [];

  if (!id || !prompt || !correct) return null;

  const options = optionsRaw.map((opt, idx) => normalizeOption(opt, idx)).filter(Boolean);
  const uniqueOptions = [];
  const seen = new Set();
  for (const opt of options) {
    if (seen.has(opt.key)) continue;
    seen.add(opt.key);
    uniqueOptions.push(opt);
  }

  if (uniqueOptions.length < 2) return null;
  if (!uniqueOptions.some((o) => o.key === correct)) return null;

  const difficulty = (raw.difficulty === 'easy' || raw.difficulty === 'medium' || raw.difficulty === 'hard')
    ? raw.difficulty
    : 'medium';
  const marks = typeof raw.marks === 'number' && Number.isFinite(raw.marks) ? raw.marks : 1;
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';

  const content_hash = createHash('sha256').update(JSON.stringify({
    id,
    unit,
    prompt,
    options: uniqueOptions,
    correct_answer: correct,
    difficulty,
    marks,
    explanation,
  })).digest('hex');

  return {
    id,
    unit,
    prompt,
    options: uniqueOptions,
    correct_answer: correct,
    difficulty,
    marks,
    explanation,
    source_file: fileName,
    content_hash,
  };
}

async function loadCatalogueFromDisk() {
  const entries = await fs.readdir(catalogueDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && /^unit\d+\.json$/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const questions = [];
  const seenIds = new Set();
  let totalSkipped = 0;
  let duplicateIds = 0;

  for (const fileEntry of files) {
    const fileName = fileEntry.name;
    const match = /^unit(\d+)\.json$/i.exec(fileName);
    if (!match) continue;
    const unit = Number.parseInt(match[1], 10);
    const filePath = path.join(catalogueDir, fileName);
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.questions) ? parsed.questions : [];

    let kept = 0;
    let skipped = 0;
    for (const item of items) {
      const normalized = normalizeQuestion(item, unit, fileName);
      if (!normalized) {
        skipped += 1;
        continue;
      }
      if (seenIds.has(normalized.id)) {
        duplicateIds += 1;
        skipped += 1;
        console.warn(`  - duplicate catalogue id "${normalized.id}" in ${fileName}; skipped`);
        continue;
      }
      seenIds.add(normalized.id);
      questions.push(normalized);
      kept += 1;
    }

    totalSkipped += skipped;
    console.log(`  • ${fileName}: ${kept} kept, ${skipped} skipped`);
  }

  return { questions, totalSkipped, duplicateIds };
}

async function ensurePrerequisites(client) {
  const requiredTables = ['question_bank', 'question_options', 'topics'];
  for (const tableName of requiredTables) {
    const result = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1;`,
      [tableName],
    );
    if (result.rowCount === 0) {
      throw new Error(`Table "${tableName}" does not exist. Run test DB migrations first.`);
    }
  }
}

async function ensureCatalogueTopic(client) {
  const slug = 'catalogue-mcq-bank';
  const existing = await client.query(
    `
    SELECT id
    FROM topics
    WHERE slug = $1
    LIMIT 1;
    `,
    [slug],
  );
  if (existing.rowCount && existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `
    INSERT INTO topics (slug, name, description, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, true, now(), now())
    RETURNING id;
    `,
    [
      slug,
      'Catalogue MCQ Bank',
      'Auto-seeded MCQ questions imported from catalogue/unit*.json.',
    ],
  );

  return inserted.rows[0].id;
}

async function loadExistingCatalogueRows(client) {
  const result = await client.query(
    `
    SELECT
      qb.id,
      qb.tags->>'catalogue_id' AS catalogue_id,
      qb.tags->>'content_hash' AS content_hash
    FROM question_bank qb
    WHERE qb.tags->>'origin' = 'catalogue'
      AND qb.tags ? 'catalogue_id'
    ORDER BY qb.created_at ASC;
    `,
  );

  const byCatalogueId = new Map();
  const duplicates = new Map();

  for (const row of result.rows) {
    const catalogueId = typeof row.catalogue_id === 'string' ? row.catalogue_id : '';
    if (!catalogueId) continue;
    if (!byCatalogueId.has(catalogueId)) {
      byCatalogueId.set(catalogueId, {
        questionBankId: row.id,
        contentHash: typeof row.content_hash === 'string' ? row.content_hash : null,
      });
      continue;
    }
    const arr = duplicates.get(catalogueId) ?? [];
    arr.push(row.id);
    duplicates.set(catalogueId, arr);
  }

  return { byCatalogueId, duplicates };
}

async function upsertQuestion(client, topicId, incoming, existing) {
  const tags = {
    origin: 'catalogue',
    catalogue_id: incoming.id,
    unit: incoming.unit,
    source_file: incoming.source_file,
    content_hash: incoming.content_hash,
    synced_by: 'scripts/test-db/seed-catalogue-to-db.mjs',
  };

  const answerKey = {
    correctOptionKey: incoming.correct_answer,
    expectedKeywords: [],
  };

  if (!existing) {
    const inserted = await client.query(
      `
      INSERT INTO question_bank (
        topic_id, question_type, prompt, difficulty, marks, expected_time_sec,
        answer_key, syntax_rules, explanation, tags, status, version, created_by, created_at, updated_at
      )
      VALUES (
        $1, 'mcq', $2, $3, $4, 90,
        $5::jsonb, NULL, $6, $7::jsonb, 'approved', 1, NULL, now(), now()
      )
      RETURNING id;
      `,
      [
        topicId,
        incoming.prompt,
        incoming.difficulty,
        Math.max(0.25, incoming.marks),
        JSON.stringify(answerKey),
        incoming.explanation || null,
        JSON.stringify(tags),
      ],
    );

    const questionBankId = inserted.rows[0].id;
    await insertOptions(client, questionBankId, incoming.options, incoming.correct_answer);
    return 'inserted';
  }

  await client.query(
    `
    UPDATE question_bank
    SET
      topic_id = $1,
      question_type = 'mcq',
      prompt = $2,
      difficulty = $3,
      marks = $4,
      expected_time_sec = 90,
      answer_key = $5::jsonb,
      syntax_rules = NULL,
      explanation = $6,
      tags = $7::jsonb,
      status = 'approved',
      updated_at = now()
    WHERE id = $8;
    `,
    [
      topicId,
      incoming.prompt,
      incoming.difficulty,
      Math.max(0.25, incoming.marks),
      JSON.stringify(answerKey),
      incoming.explanation || null,
      JSON.stringify(tags),
      existing.questionBankId,
    ],
  );

  await client.query(`DELETE FROM question_options WHERE question_id = $1;`, [existing.questionBankId]);
  await insertOptions(client, existing.questionBankId, incoming.options, incoming.correct_answer);
  return 'updated';
}

async function insertOptions(client, questionBankId, options, correctKey) {
  const values = [];
  const tuples = options.map((opt, index) => {
    const base = index * 5;
    values.push(questionBankId, opt.key, opt.text, opt.key === correctKey, index + 1);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  });

  await client.query(
    `
    INSERT INTO question_options (question_id, option_key, option_text, is_correct, display_order)
    VALUES ${tuples.join(', ')};
    `,
    values,
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
  const { questions, totalSkipped, duplicateIds } = await loadCatalogueFromDisk();
  console.log(`Loaded ${questions.length} valid questions (skipped ${totalSkipped}, duplicates ${duplicateIds}).`);
  if (questions.length === 0) {
    console.warn('No valid catalogue questions found. Exiting.');
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await ensurePrerequisites(client);
    const topicId = await ensureCatalogueTopic(client);
    const { byCatalogueId, duplicates } = await loadExistingCatalogueRows(client);

    for (const [catalogueId, rows] of duplicates) {
      console.warn(`  - duplicate DB rows for "${catalogueId}" (${rows.length + 1} rows); keeping oldest row`);
    }

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const q of questions) {
      const existing = byCatalogueId.get(q.id);
      if (existing && existing.contentHash === q.content_hash) {
        unchanged += 1;
        continue;
      }
      if (!existing) inserted += 1;
      else updated += 1;
    }

    console.log('');
    console.log('Plan:');
    console.log(`  inserts:   ${inserted}`);
    console.log(`  updates:   ${updated}`);
    console.log(`  unchanged: ${unchanged}`);

    if (opts.dryRun) {
      console.log('');
      console.log('--dry-run: no changes were applied.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const q of questions) {
        const existing = byCatalogueId.get(q.id);
        if (existing && existing.contentHash === q.content_hash) continue;
        await upsertQuestion(client, topicId, q, existing);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    console.log('');
    console.log('✔ Catalogue questions seeded into question_bank.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('seed-catalogue-to-db failed:', error?.message ?? error);
  process.exit(1);
});
