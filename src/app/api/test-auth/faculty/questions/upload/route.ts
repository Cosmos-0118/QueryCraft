import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { requireTeacherOrAdminSession } from '@/lib/test-auth/session';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB — JSON of MCQs is small
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'faculty-questions');

interface NormalizedOption {
  key: string;
  text: string;
}

interface NormalizedQuestion {
  id: string;
  prompt: string;
  options: NormalizedOption[];
  correct_answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
  explanation?: string;
}

interface ValidationResult {
  ok: boolean;
  error?: string;
  questions?: NormalizedQuestion[];
}

function normalizeOption(value: unknown, idx: number): NormalizedOption | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { key?: unknown; text?: unknown };
  const text = typeof row.text === 'string' ? row.text.trim() : '';
  if (!text) return null;
  const rawKey = typeof row.key === 'string' && row.key.trim().length > 0
    ? row.key.trim()
    : String.fromCharCode(65 + idx);
  return { key: rawKey.toUpperCase(), text };
}

function normalizeQuestion(raw: unknown): NormalizedQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;

  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const prompt = typeof row.prompt === 'string' ? row.prompt.trim() : '';
  const correctRaw = typeof row.correct_answer === 'string' ? row.correct_answer.trim().toUpperCase() : '';
  const optionsArr = Array.isArray(row.options) ? row.options : [];
  if (!id || !prompt || !correctRaw) return null;

  const options = optionsArr
    .map((opt, idx) => normalizeOption(opt, idx))
    .filter((opt): opt is NormalizedOption => opt !== null);

  if (options.length < 2) return null;
  if (!options.some((opt) => opt.key === correctRaw)) return null;

  const difficulty = (row.difficulty === 'easy' || row.difficulty === 'medium' || row.difficulty === 'hard')
    ? row.difficulty
    : 'medium';
  const marks = typeof row.marks === 'number' && Number.isFinite(row.marks) ? row.marks : 1;
  const explanation = typeof row.explanation === 'string' ? row.explanation.trim() : '';

  return {
    id,
    prompt,
    options,
    correct_answer: correctRaw,
    difficulty,
    marks,
    explanation: explanation || undefined,
  };
}

function validatePayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'JSON payload must be an object.' };
  }
  const root = payload as { questions?: unknown };
  if (!Array.isArray(root.questions)) {
    return { ok: false, error: 'Payload must include a "questions" array.' };
  }
  if (root.questions.length === 0) {
    return { ok: false, error: 'At least one question is required.' };
  }
  if (root.questions.length > 500) {
    return { ok: false, error: 'A single upload may contain at most 500 questions.' };
  }

  const questions: NormalizedQuestion[] = [];
  const seenIds = new Set<string>();

  for (const item of root.questions) {
    const normalized = normalizeQuestion(item);
    if (!normalized) {
      return {
        ok: false,
        error: 'One or more questions are invalid (need id, prompt, ≥2 options, and a matching correct_answer key).',
      };
    }
    if (seenIds.has(normalized.id)) {
      return { ok: false, error: `Duplicate question id "${normalized.id}".` };
    }
    seenIds.add(normalized.id);
    questions.push(normalized);
  }

  return { ok: true, questions };
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 40) || 'anon';
}

async function readJsonBody(req: NextRequest): Promise<{ payload: unknown; rawText: string } | { error: string; status: number }> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return { error: 'Multipart upload must include a "file" field.', status: 400 };
    }
    if (file.size === 0) return { error: 'Uploaded file is empty.', status: 400 };
    if (file.size > MAX_FILE_BYTES) return { error: 'Uploaded file exceeds 2 MB.', status: 413 };
    const rawText = await file.text();
    try {
      return { payload: JSON.parse(rawText), rawText };
    } catch (error) {
      return { error: `Uploaded file is not valid JSON: ${(error as Error).message}`, status: 400 };
    }
  }

  // Fallback: raw JSON body
  const rawText = await req.text();
  if (!rawText) return { error: 'Empty request body.', status: 400 };
  if (rawText.length > MAX_FILE_BYTES) return { error: 'Payload exceeds 2 MB.', status: 413 };
  try {
    return { payload: JSON.parse(rawText), rawText };
  } catch (error) {
    return { error: `Body is not valid JSON: ${(error as Error).message}`, status: 400 };
  }
}

export async function POST(req: NextRequest) {
  const session = requireTeacherOrAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Teacher or admin session required.' }, { status: 401 });
  }

  const bodyResult = await readJsonBody(req);
  if ('error' in bodyResult) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  const validation = validatePayload(bodyResult.payload);
  if (!validation.ok || !validation.questions) {
    return NextResponse.json({ error: validation.error ?? 'Invalid payload.' }, { status: 400 });
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const facultyId = sanitizeForFilename(session.email || session.sub || 'faculty');
  const random = randomBytes(4).toString('hex');
  const fileName = `${timestamp}-${facultyId}-${random}.json`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  // Always write a normalized payload (uploaded_by + checked questions) so
  // the cleanup script and any downstream consumer can rely on the schema.
  const persisted = {
    uploaded_by: session.email || session.sub,
    uploaded_at: new Date().toISOString(),
    questions: validation.questions,
  };

  await fs.writeFile(filePath, JSON.stringify(persisted, null, 2), 'utf-8');

  return NextResponse.json({
    ok: true,
    file: fileName,
    question_count: validation.questions.length,
    uploaded_by: persisted.uploaded_by,
    uploaded_at: persisted.uploaded_at,
  });
}
