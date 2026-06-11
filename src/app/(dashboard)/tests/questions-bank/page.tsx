'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, FileJson, Loader2, Upload } from 'lucide-react';
import { useTestAuth } from '@/hooks/use-test-auth';

type BankQuestionType = 'mcq' | 'sql_fill';
type BankDifficulty = 'easy' | 'medium' | 'hard';

interface QuestionBankQuestion {
  id: string;
  text: string;
  question_type: BankQuestionType;
  options: Array<{ key: string; text: string }>;
  correct_answer: string | null;
  difficulty: BankDifficulty;
  marks: number;
  explanation: string | null;
  unit: number | null;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_display_name: string;
  origin: string;
}

interface QuestionBankResponse {
  questions: QuestionBankQuestion[];
  total: number;
  facets: {
    units: number[];
    difficulties: BankDifficulty[];
    question_types: BankQuestionType[];
  };
}

const SAMPLE_FORMAT = {
  questions: [
    {
      prompt: 'Which normal form removes transitive dependencies?',
      question_type: 'mcq',
      options: [
        { key: 'A', text: 'First Normal Form' },
        { key: 'B', text: 'Second Normal Form' },
        { key: 'C', text: 'Third Normal Form' },
        { key: 'D', text: 'Boyce-Codd Normal Form' },
      ],
      correct_answer: 'C',
      difficulty: 'medium',
      unit: 3,
      marks: 1,
      explanation: '3NF removes transitive dependencies on non-key attributes.',
    },
    {
      prompt: 'Write SQL to list students with marks above 80.',
      question_type: 'sql_fill',
      correct_answer: 'SELECT * FROM students WHERE marks > 80;',
      difficulty: 'easy',
      unit: 2,
      marks: 1,
    },
  ],
};

export default function QuestionBankPage() {
  const router = useRouter();
  const { user, hydrated, isAuthenticated } = useTestAuth();

  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionBankQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [units, setUnits] = useState<number[]>([]);

  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'all' | BankDifficulty>('all');
  const [questionType, setQuestionType] = useState<'all' | BankQuestionType>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | number>('all');
  const [uploadedFrom, setUploadedFrom] = useState('');
  const [uploadedTo, setUploadedTo] = useState('');
  const [page, setPage] = useState(0);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadPayload, setUploadPayload] = useState<unknown[] | null>(null);
  const [uploading, setUploading] = useState(false);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace('/tests/login');
      return;
    }
    if (user.role !== 'teacher' && user.role !== 'admin') {
      router.replace('/tests');
    }
  }, [hydrated, isAuthenticated, router, user]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;
    if (user.role !== 'teacher' && user.role !== 'admin') return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (difficulty !== 'all') params.set('difficulty', difficulty);
        if (questionType !== 'all') params.set('question_type', questionType);
        if (unitFilter !== 'all') params.set('units', String(unitFilter));
        if (uploadedFrom) params.set('uploaded_from', uploadedFrom);
        if (uploadedTo) params.set('uploaded_to', uploadedTo);
        params.set('limit', String(pageSize));
        params.set('offset', String(page * pageSize));

        const res = await fetch(`/api/tests/questions-bank?${params.toString()}`);
        const data = await res.json() as QuestionBankResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load question bank.');
        }
        if (cancelled) return;
        setQuestions(data.questions);
        setTotal(data.total);
        setUnits(data.facets.units);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load question bank.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    isAuthenticated,
    user,
    query,
    difficulty,
    questionType,
    unitFilter,
    uploadedFrom,
    uploadedTo,
    page,
    refreshTick,
  ]);

  const sampleJson = useMemo(() => JSON.stringify(SAMPLE_FORMAT, null, 2), []);

  const handleUploadFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setUploadError(null);
    setUploadNotice(null);
    setUploadPayload(null);
    if (!file) {
      setUploadFileName('');
      return;
    }

    setUploadFileName(file.name);

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { questions?: unknown }).questions))
          ? (parsed as { questions: unknown[] }).questions
          : null;

      if (!list) {
        setUploadError('JSON must be an array or an object with a questions array.');
        return;
      }

      if (list.length === 0) {
        setUploadError('The selected file contains zero questions.');
        return;
      }

      setUploadPayload(list);
      setUploadNotice(`Ready to upload ${list.length} question${list.length === 1 ? '' : 's'}.`);
    } catch {
      setUploadError('Invalid JSON file. Please upload valid JSON.');
    }
  };

  const handleUpload = async () => {
    if (!uploadPayload || uploadPayload.length === 0) {
      setUploadError('Choose a valid questions JSON file first.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadNotice(null);
    try {
      const res = await fetch('/api/tests/questions-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: uploadPayload }),
      });
      const data = await res.json() as { ok?: boolean; inserted?: number; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Upload failed.');
      }

      setUploadNotice(`Uploaded ${data.inserted ?? 0} question${data.inserted === 1 ? '' : 's'} to database.`);
      setUploadPayload(null);
      setUploadFileName('');
      setRefreshTick((prev) => prev + 1);
      setPage(0);
    } catch (uploadErr) {
      setUploadError(uploadErr instanceof Error ? uploadErr.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (!hydrated || !isAuthenticated || !user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading question bank...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload faculty questions directly to database and browse all available questions.
          </p>
        </div>
        <Link
          href="/tests"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to Tests
        </Link>
      </div>

      <section className="mb-6 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-lg shadow-black/10">
        <div className="mb-4 flex items-center gap-2">
          <Upload size={16} className="text-primary" />
          <h2 className="text-lg font-semibold">Upload Questions</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Upload a JSON file in the sample format below. The questions are saved directly in database.
        </p>

        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Sample Format
          </p>
          <pre className="max-h-72 overflow-auto rounded-lg bg-black/20 p-3 text-xs leading-5 text-foreground">
            {sampleJson}
          </pre>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label
            htmlFor="bank-upload-file"
            className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-medium text-primary transition hover:bg-primary/15"
          >
            <FileJson size={14} className="mr-2" />
            Choose JSON
          </label>
          <input
            id="bank-upload-file"
            type="file"
            accept="application/json,.json"
            onChange={handleUploadFileChange}
            className="hidden"
          />
          <span className="truncate text-sm text-muted-foreground">
            {uploadFileName || 'No file selected'}
          </span>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !uploadPayload}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading...' : 'Upload to Database'}
          </button>
        </div>

        {uploadError && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {uploadError}
          </p>
        )}
        {uploadNotice && (
          <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {uploadNotice}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-lg shadow-black/10">
        <div className="mb-4 flex items-center gap-2">
          <Database size={16} className="text-primary" />
          <h2 className="text-lg font-semibold">All Questions in Database</h2>
          <span className="ml-auto rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {total}
          </span>
        </div>

        <div className="mb-4 grid gap-2 md:grid-cols-5">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search by prompt..."
            className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 md:col-span-2"
          />
          <select
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value as 'all' | BankDifficulty);
              setPage(0);
            }}
            className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select
            value={questionType}
            onChange={(event) => {
              setQuestionType(event.target.value as 'all' | BankQuestionType);
              setPage(0);
            }}
            className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All types</option>
            <option value="mcq">MCQ</option>
            <option value="sql_fill">SQL/TEXT</option>
          </select>
          <select
            value={String(unitFilter)}
            onChange={(event) => {
              const value = event.target.value;
              setUnitFilter(value === 'all' ? 'all' : Number(value));
              setPage(0);
            }}
            className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All units</option>
            {units.map((unit) => (
              <option key={unit} value={unit}>
                Unit {unit}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Uploaded from</p>
            <input
              type="date"
              value={uploadedFrom}
              onChange={(event) => {
                setUploadedFrom(event.target.value);
                setPage(0);
              }}
              className="h-10 w-full rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Uploaded to</p>
            <input
              type="date"
              value={uploadedTo}
              onChange={(event) => {
                setUploadedTo(event.target.value);
                setPage(0);
              }}
              className="h-10 w-full rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="md:col-span-2 md:self-end">
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setDifficulty('all');
                setQuestionType('all');
                setUnitFilter('all');
                setUploadedFrom('');
                setUploadedTo('');
                setPage(0);
              }}
              className="inline-flex h-10 items-center rounded-xl border border-border/70 bg-background/70 px-4 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Loading question bank...
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
            No questions match the current filters.
          </div>
        ) : (
          <div className="space-y-2.5">
            {questions.map((question) => (
              <article key={question.id} className="rounded-xl border border-border/70 bg-background/55 p-3.5">
                <p className="text-sm font-medium text-foreground">{question.text}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md border border-border/70 bg-background/60 px-2 py-0.5">{question.question_type}</span>
                  <span className="rounded-md border border-border/70 bg-background/60 px-2 py-0.5">{question.difficulty}</span>
                  <span className="rounded-md border border-border/70 bg-background/60 px-2 py-0.5">Marks {question.marks}</span>
                  <span className="rounded-md border border-border/70 bg-background/60 px-2 py-0.5">
                    {question.unit ? `Unit ${question.unit}` : 'Unit NA'}
                  </span>
                  <span className="rounded-md border border-border/70 bg-background/60 px-2 py-0.5">
                    {new Date(question.uploaded_at).toLocaleDateString()}
                  </span>
                  <span className="rounded-md border border-border/70 bg-background/60 px-2 py-0.5">
                    {question.uploaded_by_display_name}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {Math.min(page + 1, totalPages)} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={page === 0}
              className="inline-flex h-9 items-center rounded-lg border border-border/70 bg-background/70 px-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => (prev + 1 < totalPages ? prev + 1 : prev))}
              disabled={page + 1 >= totalPages}
              className="inline-flex h-9 items-center rounded-lg border border-border/70 bg-background/70 px-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
