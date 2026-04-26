import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Catalogue is the source-of-truth for MCQ question content for the test
 * module. JSON files live in `<repo>/catalogue/unit{N}.json` and are loaded
 * lazily into a process-level cache.
 *
 * Tests reference catalogue questions by their stable string id (e.g.
 * "u1-q003"). At test-creation time the prompt/options/correct answer are
 * snapshotted into `test_questions.question_snapshot` so that grading is
 * stable even if a catalogue file is later edited.
 */

export type CatalogueDifficulty = 'easy' | 'medium' | 'hard';

export interface CatalogueOption {
  key: string;
  text: string;
}

export interface CatalogueQuestion {
  id: string;
  unit: number;
  prompt: string;
  options: CatalogueOption[];
  correct_answer: string;
  difficulty: CatalogueDifficulty;
  marks: number;
  explanation?: string;
}

export interface CatalogueUnit {
  unit: number;
  title: string;
  topics: string[];
  questions: CatalogueQuestion[];
}

interface RawCatalogueFile {
  unit: number;
  title?: unknown;
  topics?: unknown;
  questions?: unknown;
}

interface RawCatalogueQuestion {
  id?: unknown;
  prompt?: unknown;
  options?: unknown;
  correct_answer?: unknown;
  difficulty?: unknown;
  marks?: unknown;
  explanation?: unknown;
}

interface CatalogueIndex {
  units: Map<number, CatalogueUnit>;
  questionsById: Map<string, CatalogueQuestion>;
  byUnit: Map<number, CatalogueQuestion[]>;
}

const CATALOGUE_DIR = path.resolve(process.cwd(), 'catalogue');
const SUPPORTED_UNITS = [1, 2, 3, 4, 5] as const;

let catalogueCache: CatalogueIndex | null = null;
let catalogueLoading: Promise<CatalogueIndex> | null = null;

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeDifficulty(value: unknown): CatalogueDifficulty {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return 'medium';
}

function normalizeOption(value: unknown, fallbackIndex: number): CatalogueOption | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { key?: unknown; text?: unknown };
  const text = asString(row.text)?.trim();
  if (!text) return null;
  const rawKey = asString(row.key)?.trim() ?? String.fromCharCode(65 + fallbackIndex);
  const key = rawKey.toUpperCase();
  return { key, text };
}

function normalizeQuestion(raw: RawCatalogueQuestion, unit: number): CatalogueQuestion | null {
  const id = asString(raw.id)?.trim();
  const prompt = asString(raw.prompt)?.trim();
  const correctAnswerRaw = asString(raw.correct_answer)?.trim().toUpperCase() ?? null;
  const optionsRaw = Array.isArray(raw.options) ? raw.options : [];

  if (!id || !prompt || !correctAnswerRaw) return null;

  const options = optionsRaw
    .map((opt, idx) => normalizeOption(opt, idx))
    .filter((opt): opt is CatalogueOption => opt !== null);

  if (options.length < 2) return null;
  if (!options.some((opt) => opt.key === correctAnswerRaw)) return null;

  return {
    id,
    unit,
    prompt,
    options,
    correct_answer: correctAnswerRaw,
    difficulty: normalizeDifficulty(raw.difficulty),
    marks: asNumber(raw.marks) ?? 1,
    explanation: asString(raw.explanation)?.trim() || undefined,
  };
}

async function readUnitFile(unit: number): Promise<CatalogueUnit | null> {
  const filePath = path.join(CATALOGUE_DIR, `unit${unit}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  let parsed: RawCatalogueFile;
  try {
    parsed = JSON.parse(raw) as RawCatalogueFile;
  } catch (error) {
    throw new Error(
      `Catalogue file unit${unit}.json is not valid JSON: ${(error as Error).message}`,
    );
  }

  const questionsRaw = Array.isArray(parsed.questions) ? parsed.questions : [];
  const questions: CatalogueQuestion[] = [];
  const seenIds = new Set<string>();

  for (const item of questionsRaw) {
    const normalized = normalizeQuestion(item as RawCatalogueQuestion, unit);
    if (!normalized) continue;
    if (seenIds.has(normalized.id)) continue;
    seenIds.add(normalized.id);
    questions.push(normalized);
  }

  return {
    unit,
    title: asString(parsed.title) ?? `Unit ${unit}`,
    topics: asStringArray(parsed.topics),
    questions,
  };
}

async function buildCatalogueIndex(): Promise<CatalogueIndex> {
  const units = new Map<number, CatalogueUnit>();
  const questionsById = new Map<string, CatalogueQuestion>();
  const byUnit = new Map<number, CatalogueQuestion[]>();

  for (const unit of SUPPORTED_UNITS) {
    const unitData = await readUnitFile(unit);
    if (!unitData) continue;
    units.set(unit, unitData);
    byUnit.set(unit, unitData.questions);
    for (const question of unitData.questions) {
      questionsById.set(question.id, question);
    }
  }

  return { units, questionsById, byUnit };
}

async function getCatalogue(): Promise<CatalogueIndex> {
  if (catalogueCache) return catalogueCache;
  if (!catalogueLoading) {
    catalogueLoading = buildCatalogueIndex().then((index) => {
      catalogueCache = index;
      return index;
    });
  }
  return catalogueLoading;
}

/**
 * Force the next read to re-load files from disk. Useful for tests / hot-reload.
 */
export function invalidateCatalogueCache(): void {
  catalogueCache = null;
  catalogueLoading = null;
}

export async function listCatalogueUnits(): Promise<CatalogueUnit[]> {
  const index = await getCatalogue();
  return Array.from(index.units.values()).sort((a, b) => a.unit - b.unit);
}

export async function getCatalogueQuestionById(id: string): Promise<CatalogueQuestion | null> {
  const index = await getCatalogue();
  return index.questionsById.get(id) ?? null;
}

/**
 * Cryptographically-safe-ish in-place Fisher–Yates shuffle.
 * (For test-randomization workloads Math.random is acceptable.)
 */
function shuffleInPlace<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export interface RandomizeCatalogueOptions {
  count: number;
  units?: number[];
  difficulty?: CatalogueDifficulty | 'mixed';
  excludeIds?: Iterable<string>;
}

export async function randomizeCatalogueQuestions(
  options: RandomizeCatalogueOptions,
): Promise<CatalogueQuestion[]> {
  const index = await getCatalogue();
  const exclude = new Set<string>(options.excludeIds ?? []);

  const requestedUnits = (options.units && options.units.length > 0)
    ? options.units.filter((u) => index.byUnit.has(u))
    : Array.from(index.byUnit.keys());

  const candidates: CatalogueQuestion[] = [];
  for (const unit of requestedUnits) {
    const unitQuestions = index.byUnit.get(unit) ?? [];
    for (const question of unitQuestions) {
      if (exclude.has(question.id)) continue;
      if (
        options.difficulty
        && options.difficulty !== 'mixed'
        && question.difficulty !== options.difficulty
      ) {
        continue;
      }
      candidates.push(question);
    }
  }

  shuffleInPlace(candidates);
  const limit = Math.max(0, Math.min(options.count, candidates.length));
  return candidates.slice(0, limit);
}

/**
 * Shuffle the order of options for an MCQ snapshot at attempt time.
 * Returns a fresh array so the caller can store/use it without mutating
 * the catalogue cache.
 */
export function shuffleCatalogueOptions(question: CatalogueQuestion): CatalogueOption[] {
  const cloned = question.options.map((opt) => ({ ...opt }));
  shuffleInPlace(cloned);
  return cloned;
}
