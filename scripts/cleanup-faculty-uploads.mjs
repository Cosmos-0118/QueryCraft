#!/usr/bin/env node
/**
 * cleanup-faculty-uploads.mjs — prune old faculty-uploaded question packs.
 *
 * Usage:
 *   node scripts/cleanup-faculty-uploads.mjs
 *   node scripts/cleanup-faculty-uploads.mjs --days=7
 *   node scripts/cleanup-faculty-uploads.mjs --dry-run
 *
 * Retention defaults:
 *   1. --days=N CLI flag wins (if provided)
 *   2. FACULTY_UPLOADS_RETENTION_DAYS env var
 *   3. Hard-coded fallback: 14 days
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const uploadsDir = path.join(projectRoot, 'uploads', 'faculty-questions');
const defaultEnvFiles = [path.join(projectRoot, '.env.local'), path.join(projectRoot, '.env')];

const DEFAULT_RETENTION_DAYS = 14;

function parseArgs(args) {
  const opts = { dryRun: false, days: null };
  for (const arg of args) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--days=')) {
      const value = Number.parseInt(arg.slice('--days='.length), 10);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('--days must be a non-negative integer.');
      }
      opts.days = value;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function printHelp() {
  console.log('Prune old faculty-uploaded question packs from uploads/faculty-questions/.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/cleanup-faculty-uploads.mjs');
  console.log('  node scripts/cleanup-faculty-uploads.mjs --days=7');
  console.log('  node scripts/cleanup-faculty-uploads.mjs --dry-run');
  console.log('');
  console.log(`Default retention: ${DEFAULT_RETENTION_DAYS} days`);
  console.log('Override via env: FACULTY_UPLOADS_RETENTION_DAYS=7');
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

function resolveRetentionDays(cliDays) {
  if (cliDays !== null && cliDays !== undefined) return cliDays;
  const fromEnv = process.env.FACULTY_UPLOADS_RETENTION_DAYS;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    const parsed = Number.parseInt(fromEnv, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_RETENTION_DAYS;
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
  const retentionDays = resolveRetentionDays(opts.days);
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  console.log(`Pruning faculty uploads older than ${retentionDays} day(s) (cutoff ${cutoffIso}).`);

  let entries;
  try {
    entries = await fs.readdir(uploadsDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.log(`Uploads dir does not exist yet: ${uploadsDir}. Nothing to do.`);
      return;
    }
    throw error;
  }

  let inspected = 0;
  let removed = 0;
  let kept = 0;
  let skipped = 0;
  let bytesFreed = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.json')) {
      skipped += 1;
      continue;
    }
    const filePath = path.join(uploadsDir, entry.name);
    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      skipped += 1;
      continue;
    }

    inspected += 1;
    if (stat.mtimeMs >= cutoffMs) {
      kept += 1;
      continue;
    }

    if (opts.dryRun) {
      console.log(`  would delete: ${entry.name} (${stat.size} bytes, mtime=${stat.mtime.toISOString()})`);
      removed += 1;
      bytesFreed += stat.size;
      continue;
    }

    try {
      await fs.unlink(filePath);
      console.log(`  deleted: ${entry.name}`);
      removed += 1;
      bytesFreed += stat.size;
    } catch (error) {
      console.warn(`  ⚠ failed to delete ${entry.name}: ${error.message}`);
    }
  }

  console.log('');
  console.log('Summary:');
  console.log(`  inspected: ${inspected}`);
  console.log(`  ${opts.dryRun ? 'would delete' : 'deleted'}: ${removed} (${bytesFreed} bytes)`);
  console.log(`  kept     : ${kept}`);
  console.log(`  skipped  : ${skipped}`);
  if (opts.dryRun) {
    console.log('');
    console.log('--dry-run: no files were actually removed.');
  }
}

main().catch((error) => {
  console.error('cleanup-faculty-uploads failed:', error?.message ?? error);
  process.exit(1);
});
