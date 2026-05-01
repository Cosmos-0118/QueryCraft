"use client";

import Link from 'next/link';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Select, { type MultiValue, type SingleValue, type StylesConfig } from 'react-select';
import { useTestAuth as useAuth } from '@/hooks/use-test-auth';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  Send,
  Sparkles,
  Trophy,
  Trash2,
  Upload,
} from 'lucide-react';

interface Question {
  id: string;
  text: string;
  question_type: 'mcq' | 'sql_fill';
  options: Array<{
    key: string;
    text: string;
  }>;
  correct_answer?: string | null;
}

interface Test {
  id: string;
  title: string;
  status: string;
  created_by: string;
  updated_at: string;
  question_mode: 'mcq_only' | 'sql_only' | 'mixed';
  mix_mcq_percent: number | null;
  mix_sql_fill_percent: number | null;
  module_type?: 'classic' | 'interactive_quiz';
  interactive_settings?: {
    question_timer_seconds: number;
    max_points_per_question: number;
    randomize_questions: boolean;
    randomize_options: boolean;
    difficulty_profile: 'basic' | 'medium' | 'hard' | 'mixed';
  };
  test_code?: string | null;
}

interface ImportedQuestionPayload {
  text: string;
  question_type: 'mcq' | 'sql_fill';
  correct_answer: string;
  options?: Array<{
    key?: string;
    text: string;
  }>;
}

interface ImportedQuestionPreview extends ImportedQuestionPayload {
  sourceIndex: number;
}

type RandomQuestionType = 'mcq' | 'sql_fill' | 'mixed';
type DifficultyProfile = 'basic' | 'medium' | 'hard' | 'mixed';
type QuestionSourceMode = 'import' | 'database' | null;
type SelectOption = { value: string; label: string };

const MIN_MIX_MCQ_COUNT = 1;
const UNIT_OPTIONS: SelectOption[] = [
  { value: '1', label: 'Unit 1' },
  { value: '2', label: 'Unit 2' },
  { value: '3', label: 'Unit 3' },
  { value: '4', label: 'Unit 4' },
  { value: '5', label: 'Unit 5' },
];
const RANDOM_TYPE_OPTIONS: SelectOption[] = [
  { value: 'mixed', label: 'Mixed Questions (MCQ + SQL/TEXT)' },
  { value: 'mcq', label: 'MCQ only' },
  { value: 'sql_fill', label: 'SQL/TEXT only' },
];
const INTERACTIVE_RANDOM_TYPE_OPTIONS: SelectOption[] = [
  { value: 'mcq', label: 'MCQ only (Interactive Quiz)' },
];
const DIFFICULTY_OPTIONS: SelectOption[] = [
  { value: 'mixed', label: 'Difficulty: Mixed' },
  { value: 'basic', label: 'Difficulty: Basic (easy)' },
  { value: 'medium', label: 'Difficulty: Medium' },
  { value: 'hard', label: 'Difficulty: Hard' },
];
const MODERN_SELECT_STYLES: StylesConfig<SelectOption, boolean> = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 12,
    borderColor: state.isFocused
      ? 'color-mix(in oklab, var(--ring) 62%, var(--border))'
      : 'color-mix(in oklab, var(--border) 88%, transparent)',
    backgroundColor: 'color-mix(in oklab, var(--background) 78%, var(--card))',
    boxShadow: state.isFocused ? '0 0 0 2px color-mix(in oklab, var(--ring) 20%, transparent)' : 'none',
    '&:hover': {
      borderColor: 'color-mix(in oklab, var(--ring) 55%, var(--border))',
    },
  }),
  dropdownIndicator: (base) => ({ ...base, color: 'var(--muted-foreground)' }),
  indicatorSeparator: (base) => ({ ...base, backgroundColor: 'color-mix(in oklab, var(--border) 82%, transparent)' }),
  input: (base) => ({ ...base, color: 'var(--foreground)' }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid color-mix(in oklab, var(--border) 88%, transparent)',
    backgroundColor: 'var(--card)',
    boxShadow: '0 24px 54px -36px var(--shadow-color)',
  }),
  menuList: (base) => ({
    ...base,
    backgroundColor: 'var(--card)',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'color-mix(in oklab, var(--primary) 22%, transparent)'
      : state.isFocused
        ? 'color-mix(in oklab, var(--primary) 12%, transparent)'
        : 'transparent',
    color: 'var(--foreground)',
    cursor: 'pointer',
  }),
  singleValue: (base) => ({ ...base, color: 'var(--foreground)' }),
  placeholder: (base) => ({ ...base, color: 'var(--muted-foreground)' }),
  multiValue: (base) => ({
    ...base,
    borderRadius: 8,
    backgroundColor: 'color-mix(in oklab, var(--primary) 16%, transparent)',
  }),
  multiValueLabel: (base) => ({ ...base, color: 'var(--foreground)' }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'var(--muted-foreground)',
    ':hover': {
      backgroundColor: 'color-mix(in oklab, var(--danger) 16%, transparent)',
      color: 'var(--danger)',
    },
  }),
};

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case 'published':
      return 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-300';
    case 'draft':
      return 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-300';
    default:
      return 'border-border/70 bg-muted/40 text-muted-foreground';
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeOptionKey(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
}

function buildOptionKey(index: number) {
  return String.fromCharCode(65 + index);
}

function parseImportedQuestions(options: {
  raw: unknown;
  interactiveOnly: boolean;
}): {
  payloads: ImportedQuestionPayload[];
  preview: ImportedQuestionPreview[];
  errors: string[];
} {
  const container = asObject(options.raw);
  const list = Array.isArray(options.raw)
    ? options.raw
    : Array.isArray(container?.questions)
      ? container.questions
      : null;

  if (!list) {
    return {
      payloads: [],
      preview: [],
      errors: ['JSON must be an array of questions or an object with a questions array.'],
    };
  }

  const payloads: ImportedQuestionPayload[] = [];
  const preview: ImportedQuestionPreview[] = [];
  const errors: string[] = [];

  list.forEach((row, index) => {
    const sourceIndex = index + 1;
    const item = asObject(row);

    if (!item) {
      errors.push(`Row ${sourceIndex}: each question must be an object.`);
      return;
    }

    const textCandidate =
      (typeof item.text === 'string' && item.text)
      || (typeof item.question === 'string' && item.question)
      || (typeof item.prompt === 'string' && item.prompt)
      || '';
    const text = textCandidate.trim();

    if (!text) {
      errors.push(`Row ${sourceIndex}: missing question text.`);
      return;
    }

    const requestedType =
      item.question_type === 'mcq' || item.question_type === 'sql_fill'
        ? item.question_type
        : item.type === 'mcq' || item.type === 'sql_fill'
          ? item.type
          : undefined;
    const isMcqFallback = Array.isArray(item.options);
    const questionType: 'mcq' | 'sql_fill' = requestedType ?? (isMcqFallback ? 'mcq' : 'sql_fill');

    if (options.interactiveOnly && questionType !== 'mcq') {
      errors.push(`Row ${sourceIndex}: interactive quiz allows only MCQ questions.`);
      return;
    }

    if (questionType === 'mcq') {
      const rawOptions = Array.isArray(item.options) ? item.options : [];
      const normalizedOptions = rawOptions
        .map((option, optionIndex) => {
          if (typeof option === 'string') {
            const textValue = option.trim();
            return textValue
              ? { key: buildOptionKey(optionIndex), text: textValue }
              : null;
          }

          const optionObject = asObject(option);
          if (!optionObject || typeof optionObject.text !== 'string') {
            return null;
          }

          const textValue = optionObject.text.trim();
          const keyValue = normalizeOptionKey(
            typeof optionObject.key === 'string' ? optionObject.key : buildOptionKey(optionIndex),
          );

          if (!textValue || !keyValue) {
            return null;
          }

          return { key: keyValue, text: textValue };
        })
        .filter((entry): entry is { key: string; text: string } => !!entry);

      const dedupedOptions: Array<{ key: string; text: string }> = [];
      const seenKeys = new Set<string>();
      for (const option of normalizedOptions) {
        if (seenKeys.has(option.key)) continue;
        seenKeys.add(option.key);
        dedupedOptions.push(option);
      }

      if (dedupedOptions.length < 2) {
        errors.push(`Row ${sourceIndex}: MCQ must include at least 2 options.`);
        return;
      }

      const answerCandidate =
        (typeof item.correct_answer === 'string' && item.correct_answer)
        || (typeof item.answer === 'string' && item.answer)
        || '';
      const normalizedAnswer = normalizeOptionKey(answerCandidate);

      if (!normalizedAnswer || !dedupedOptions.some((option) => option.key === normalizedAnswer)) {
        errors.push(`Row ${sourceIndex}: MCQ correct_answer must match one option key (A/B/C/D...).`);
        return;
      }

      const payload: ImportedQuestionPayload = {
        text,
        question_type: 'mcq',
        correct_answer: normalizedAnswer,
        options: dedupedOptions,
      };

      payloads.push(payload);
      preview.push({ ...payload, sourceIndex });
      return;
    }

    const answerCandidate =
      (typeof item.correct_answer === 'string' && item.correct_answer)
      || (typeof item.answer === 'string' && item.answer)
      || '';
    const answer = answerCandidate.trim();

    if (!answer) {
      errors.push(`Row ${sourceIndex}: SQL/TEXT question requires correct_answer.`);
      return;
    }

    const payload: ImportedQuestionPayload = {
      text,
      question_type: 'sql_fill',
      correct_answer: answer,
    };

    payloads.push(payload);
    preview.push({ ...payload, sourceIndex });
  });

  return {
    payloads,
    preview,
    errors,
  };
}

export default function TestDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const testId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const teacherAccessQuery = isTeacher && user?.id
    ? `?role=teacher&userId=${encodeURIComponent(user.id)}`
    : '';
  const teacherQuestionsQuery = isTeacher && user?.id
    ? `?view=teacher&role=teacher&userId=${encodeURIComponent(user.id)}`
    : '';
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);

  const [importFileName, setImportFileName] = useState('');
  const [importPreview, setImportPreview] = useState<ImportedQuestionPreview[]>([]);
  const [importQueue, setImportQueue] = useState<ImportedQuestionPayload[]>([]);
  const [parsingImport, setParsingImport] = useState(false);
  const [importingQuestions, setImportingQuestions] = useState(false);
  const [importInputKey, setImportInputKey] = useState(0);
  const [questionSourceMode, setQuestionSourceMode] = useState<QuestionSourceMode>(null);
  const [randomCount, setRandomCount] = useState('5');
  const [randomQuestionType, setRandomQuestionType] = useState<RandomQuestionType>('mixed');
  const [randomDifficulty, setRandomDifficulty] = useState<DifficultyProfile>('mixed');
  const [mixMcqCountInput, setMixMcqCountInput] = useState('3');
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);

  const [randomizingQuestions, setRandomizingQuestions] = useState(false);
  const [removingQuestionId, setRemovingQuestionId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const isInteractiveQuiz = test?.module_type === 'interactive_quiz';
  const isPublished = (test?.status ?? '').toLowerCase() === 'published';
  const canEditQuestions = isTeacher && !isPublished;

  const normalizedRandomCountPreview = useMemo(() => {
    const parsed = Number(randomCount);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.min(50, Math.floor(parsed)));
  }, [randomCount]);

  const normalizedMixMcqCountPreview = useMemo(() => {
    const maxMcqCount = Math.max(MIN_MIX_MCQ_COUNT, normalizedRandomCountPreview - 1);
    const parsed = Number(mixMcqCountInput);
    if (!Number.isFinite(parsed)) {
      return Math.min(3, maxMcqCount);
    }

    return Math.max(MIN_MIX_MCQ_COUNT, Math.min(maxMcqCount, Math.floor(parsed)));
  }, [mixMcqCountInput, normalizedRandomCountPreview]);

  const normalizedMixSqlCountPreview = Math.max(0, normalizedRandomCountPreview - normalizedMixMcqCountPreview);
  const randomTypeSelectOptions = isInteractiveQuiz ? INTERACTIVE_RANDOM_TYPE_OPTIONS : RANDOM_TYPE_OPTIONS;
  const selectedQuestionTypeOption = randomTypeSelectOptions.find((option) => option.value === randomQuestionType) ?? randomTypeSelectOptions[0];
  const selectedDifficultyOption = DIFFICULTY_OPTIONS.find((option) => option.value === randomDifficulty) ?? DIFFICULTY_OPTIONS[0];
  const selectedUnitOptions = UNIT_OPTIONS.filter((option) => selectedUnits.includes(Number(option.value)));

  useEffect(() => {
    if (!testId) return;

    const controller = new AbortController();

    const loadTest = async () => {
      setLoading(true);
      setError(null);

      try {
        const [testRes, questionsRes] = await Promise.all([
          fetch(`/api/tests/${testId}${teacherAccessQuery}`, { signal: controller.signal }),
          fetch(`/api/tests/${testId}/questions${teacherQuestionsQuery}`, { signal: controller.signal }),
        ]);

        const [testData, questionsData] = await Promise.all([
          testRes.json(),
          questionsRes.json(),
        ]);

        const loadedQuestions = (questionsData.questions || []) as Question[];

        const loadedTest = (testData.test || null) as Test | null;
        setTest(loadedTest);
        setQuestions(loadedQuestions);

        if (loadedTest?.module_type === 'interactive_quiz') {
          setRandomQuestionType('mcq');
          setRandomDifficulty(loadedTest.interactive_settings?.difficulty_profile ?? 'mixed');
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Failed to load test');
        }
      } finally {
        setLoading(false);
      }
    };

    loadTest();

    return () => controller.abort();
  }, [teacherAccessQuery, teacherQuestionsQuery, testId]);

  const stats = useMemo(
    () => ({
      questionCount: questions.length,
    }),
    [questions.length],
  );

  const resetImportSelection = () => {
    setImportQueue([]);
    setImportPreview([]);
    setImportFileName('');
    setImportInputKey((previous) => previous + 1);
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setParsingImport(true);
    setActionError(null);
    setActionNotice(null);

    try {
      const fileText = await file.text();
      const parsedJson = JSON.parse(fileText) as unknown;
      const parsed = parseImportedQuestions({
        raw: parsedJson,
        interactiveOnly: isInteractiveQuiz,
      });

      if (parsed.errors.length > 0) {
        setImportFileName(file.name);
        setImportQueue([]);
        setImportPreview([]);
        setActionError(parsed.errors.slice(0, 3).join(' '));
        return;
      }

      if (parsed.payloads.length === 0) {
        setImportFileName(file.name);
        setImportQueue([]);
        setImportPreview([]);
        setActionError('No valid questions were found in the selected JSON file.');
        return;
      }

      setImportFileName(file.name);
      setImportQueue(parsed.payloads);
      setImportPreview(parsed.preview);
      setActionNotice(`Loaded ${parsed.payloads.length} question${parsed.payloads.length === 1 ? '' : 's'} for import preview.`);
    } catch {
      setImportFileName(file.name);
      setImportQueue([]);
      setImportPreview([]);
      setActionError('Invalid JSON file. Please upload a valid questions JSON file.');
    } finally {
      setParsingImport(false);
    }
  };

  const handleImportQuestions = async () => {
    if (!canEditQuestions || !testId) {
      return;
    }

    if (importQueue.length === 0) {
      setActionError('Upload a JSON file first to import questions.');
      return;
    }

    setImportingQuestions(true);
    setActionError(null);
    setActionNotice(null);

    const imported: Question[] = [];
    const failures: string[] = [];

    for (let index = 0; index < importQueue.length; index += 1) {
      const payload = importQueue[index];

      try {
        const res = await fetch(`/api/tests/${testId}/questions${teacherAccessQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok && data.question) {
          imported.push(data.question as Question);
        } else {
          failures.push(`Row ${index + 1}: ${data.error || 'Unable to add question.'}`);
        }
      } catch {
        failures.push(`Row ${index + 1}: Network error while importing question.`);
      }
    }

    if (imported.length > 0) {
      setQuestions((previous) => [...previous, ...imported]);
    }

    if (failures.length > 0) {
      setActionError(
        `Imported ${imported.length}/${importQueue.length} question${importQueue.length === 1 ? '' : 's'}. ${failures[0]}`,
      );
      return;
    }

    setActionNotice(`Imported ${imported.length} question${imported.length === 1 ? '' : 's'} successfully.`);
    resetImportSelection();
  };

  const handleRemoveQuestion = async (id: string) => {
    if (!canEditQuestions || !testId) return;

    setRemovingQuestionId(id);
    setActionError(null);
    setActionNotice(null);

    try {
      const res = await fetch(`/api/tests/${testId}/questions${teacherAccessQuery}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setQuestions((prev) => prev.filter((question) => question.id !== id));
        setActionNotice('Question removed.');
      } else {
        const data = await res.json();
        setActionError(data.error || 'Unable to remove question');
      }
    } catch {
      setActionError('Unable to remove question');
    } finally {
      setRemovingQuestionId(null);
    }
  };

  const handleAddRandomQuestions = async () => {
    if (!canEditQuestions || !testId) return;

    if (selectedUnits.length === 0) {
      setActionError('Select at least one unit before adding random questions.');
      return;
    }

    const parsedCount = Number(randomCount);
    if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
      setActionError('Random count must be a positive number.');
      return;
    }

    const normalizedCount = Math.max(1, Math.min(50, Math.floor(parsedCount)));
    const effectiveQuestionType: RandomQuestionType = isInteractiveQuiz ? 'mcq' : randomQuestionType;

    if (effectiveQuestionType === 'mixed' && normalizedCount < 2) {
      setActionError('Mixed questions require at least 2 questions to include both types.');
      return;
    }

    let requestedMixMcqCount: number | undefined;
    if (effectiveQuestionType === 'mixed') {
      const parsedMcqCount = Number(mixMcqCountInput);
      if (!Number.isFinite(parsedMcqCount)) {
        setActionError('Set a valid MCQ question count for mixed mode.');
        return;
      }

      requestedMixMcqCount = Math.floor(parsedMcqCount);
      if (requestedMixMcqCount < MIN_MIX_MCQ_COUNT || requestedMixMcqCount >= normalizedCount) {
        setActionError(`MCQ count must be between ${MIN_MIX_MCQ_COUNT} and ${normalizedCount - 1} for ${normalizedCount} mixed questions.`);
        return;
      }
    }

    setRandomizingQuestions(true);
    setActionError(null);
    setActionNotice(null);

    try {
      const res = await fetch(`/api/tests/${testId}/questions/randomize${teacherAccessQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: normalizedCount,
          question_type: effectiveQuestionType,
          mix_mcq_count: requestedMixMcqCount,
          difficulty: randomDifficulty,
          units: selectedUnits,
        }),
      });
      const data = await res.json();

      if (!res.ok || !Array.isArray(data.questions)) {
        setActionError(data.error || 'Unable to randomize questions from database.');
        return;
      }

      const randomQuestions = data.questions as Question[];

      if (randomQuestions.length === 0) {
        setActionError('No more matching question bank entries are available for this test.');
        return;
      }

      setQuestions((prev) => {
        const existingIds = new Set(prev.map((question) => question.id));
        const incoming = randomQuestions.filter((question) => !existingIds.has(question.id));
        return [...prev, ...incoming];
      });
      setActionNotice(`Added ${randomQuestions.length} random question${randomQuestions.length === 1 ? '' : 's'}.`);
    } catch {
      setActionError('Unable to randomize questions from database.');
    } finally {
      setRandomizingQuestions(false);
    }
  };

  const handlePublishTest = async () => {
    if (!isTeacher || !testId || !test || isPublished || publishing) return;
    if (!window.confirm('Publish this test? This action cannot be undone.')) return;

    setPublishing(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/publish${teacherAccessQuery}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data?.test) {
        setActionError(data.error || 'Unable to publish test.');
        return;
      }

      setTest(data.test as Test);
      setActionNotice('Test published. Questions and answers are now read-only.');
    } catch {
      setActionError('Unable to publish test.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Loading test details...
          </div>
          <div className="mt-4 grid gap-3">
            <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
            <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
            <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load test</p>
              <p className="mt-1 text-sm text-red-300/90">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-10 text-center">
          <h2 className="text-lg font-semibold tracking-tight">Test not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">The requested test does not exist or was removed.</p>
          <Link
            href="/tests"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={15} />
            Back to Tests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_45%)]" />

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/tests"
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Back to Tests
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{test.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage questions and publishing context from one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(test.status)}`}
          >
            {formatStatus(test.status)}
          </span>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {isInteractiveQuiz && isPublished && (
          <Link
            href={`/interactive-quiz/${test.id}/leaderboard`}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/12 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            <Trophy size={14} />
            View Leaderboard
          </Link>
        )}
        {isTeacher && isPublished && (
          <Link
            href={`/tests/${test.id}/review`}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-3 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
          >
            <CheckCircle2 size={14} />
            Review Submissions
          </Link>
        )}
        {isTeacher && (
          <button
            type="button"
            onClick={handlePublishTest}
            disabled={isPublished || publishing}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:border-primary/60 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {isPublished ? 'Published' : publishing ? 'Publishing...' : 'Publish'}
          </button>
        )}
      </div>

      {isTeacher && (
        <div className="mb-4 rounded-xl border border-border/70 bg-card/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Student Access Code</p>
          <p className="mt-1 text-sm font-semibold text-teal-300">
            {test.test_code ?? 'Publish this test to generate a code.'}
          </p>
        </div>
      )}

      {isInteractiveQuiz && (
        <div className="mb-4 rounded-xl border border-orange-400/20 bg-orange-400/[0.06] p-3 text-xs text-orange-100">
          <p className="font-semibold uppercase tracking-[0.12em]">Interactive Quiz Rules</p>
          <p className="mt-1">
            Timer: {test.interactive_settings?.question_timer_seconds ?? 40}s per question, Max points: {test.interactive_settings?.max_points_per_question ?? 500},
            Difficulty: {test.interactive_settings?.difficulty_profile ?? 'mixed'},
            Randomize questions: {test.interactive_settings?.randomize_questions ? 'Yes' : 'No'},
            Randomize options: {test.interactive_settings?.randomize_options ? 'Yes' : 'No'}.
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 rounded-2xl border border-border/75 bg-card/75 p-2.5">
        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background/65 px-3 py-1.5 text-center text-xs font-semibold text-foreground">
          Questions <span className="text-primary">{stats.questionCount}</span>
        </span>
        <span className={`inline-flex w-full items-center justify-center rounded-xl border px-3 py-1.5 text-center text-xs font-semibold ${getStatusClasses(test.status)}`}>
          {formatStatus(test.status)}
        </span>
        <span className="inline-flex w-full items-center gap-1.5 rounded-xl border border-border/70 bg-background/65 px-3 py-1.5 text-xs text-muted-foreground">
          <Clock3 size={12} />
          Updated {new Date(test.updated_at).toLocaleDateString()}
        </span>
        <span className="inline-flex w-full items-center gap-1.5 rounded-xl border border-border/70 bg-background/65 px-3 py-1.5 text-xs text-muted-foreground">
          Author {test.created_by.slice(0, 8)}
        </span>
      </div>

      {actionError && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      {actionNotice && (
        <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {actionNotice}
        </div>
      )}

      <div className="grid gap-4">
        <section className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Questions</h2>
              <p className="mt-1 text-xs text-muted-foreground">Build the question set that students will attempt.</p>
            </div>
            <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {questions.length}
            </span>
          </div>

          {isTeacher ? (
            <div className="mb-4 space-y-3">
              {canEditQuestions ? (
                <>
                  <div className="rounded-xl border border-border/70 bg-card/85 p-4 shadow-sm shadow-black/10">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-xs font-semibold text-primary">1</span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                          Step 1: Choose How You Want To Add Questions
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pick one method first. The next steps will adapt automatically.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setQuestionSourceMode('import')}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          questionSourceMode === 'import'
                            ? 'border-primary/45 bg-primary/10 shadow-sm'
                            : 'border-border/70 bg-background/40 hover:border-primary/35'
                        }`}
                      >
                        <p className="text-sm font-semibold text-foreground">Import from JSON</p>
                        <p className="mt-1 text-xs text-muted-foreground">Upload your own prepared question file.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuestionSourceMode('database')}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          questionSourceMode === 'database'
                            ? 'border-primary/45 bg-primary/10 shadow-sm'
                            : 'border-border/70 bg-background/40 hover:border-primary/35'
                        }`}
                      >
                        <p className="text-sm font-semibold text-foreground">Use Question Bank</p>
                        <p className="mt-1 text-xs text-muted-foreground">Choose units and pull approved random questions.</p>
                      </button>
                    </div>
                  </div>

                  {questionSourceMode === 'import' && (
                    <div className="rounded-xl border border-border/70 bg-card/85 p-4 shadow-sm shadow-black/10">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-xs font-semibold text-primary">2</span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                            Import Questions From JSON
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Upload an array of questions (or object with questions array). A preview is shown before import.
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                        <input
                          key={importInputKey}
                          type="file"
                          accept="application/json,.json"
                          onChange={handleImportFileChange}
                          disabled={parsingImport || importingQuestions}
                          className="h-10 w-full rounded-xl border border-border bg-background/90 px-3 text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-cyan-500/20 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-cyan-100 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={handleImportQuestions}
                          disabled={parsingImport || importingQuestions || importQueue.length === 0}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {importingQuestions ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          {importingQuestions ? 'Importing...' : `Import (${importQueue.length})`}
                        </button>
                        <button
                          type="button"
                          onClick={resetImportSelection}
                          disabled={parsingImport || importingQuestions || importQueue.length === 0}
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-border/80 bg-background/70 px-4 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </div>

                      {importFileName && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          File: {importFileName}
                        </p>
                      )}

                      {importPreview.length > 0 && (
                        <div className="mt-3 space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Preview Before Import
                          </p>
                          {importPreview.slice(0, 20).map((question) => (
                            <div
                              key={`${question.sourceIndex}_${question.text}`}
                              className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2"
                            >
                              <p className="text-xs font-medium text-foreground">
                                #{question.sourceIndex} {question.text}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Type: {question.question_type === 'mcq' ? 'MCQ' : 'SQL/TEXT'} | Correct Answer: {question.correct_answer}
                              </p>
                              {question.question_type === 'mcq' && question.options && (
                                <div className="mt-1 grid gap-1">
                                  {question.options.map((option) => (
                                    <p key={`${question.sourceIndex}_${option.key}`} className="text-[11px] text-muted-foreground">
                                      {option.key}. {option.text}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          {importPreview.length > 20 && (
                            <p className="text-[11px] text-muted-foreground">
                              Showing first 20 of {importPreview.length} questions.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {questionSourceMode === 'database' && (
                    <div className="space-y-3 rounded-xl border border-border/70 bg-card/85 p-4 shadow-sm shadow-black/10">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-xs font-semibold text-primary">2</span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                            Step 2: Choose Units
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Select one or more syllabus units to pull questions from.
                          </p>
                        </div>
                      </div>
                      <Select<SelectOption, true>
                        isMulti
                        styles={MODERN_SELECT_STYLES}
                        value={selectedUnitOptions}
                        options={UNIT_OPTIONS}
                        closeMenuOnSelect={false}
                        placeholder="Select units (for example: Unit 1, Unit 3)..."
                        onChange={(options: MultiValue<SelectOption>) => {
                          const parsed = options
                            .map((option) => Number(option.value))
                            .filter((value) => Number.isFinite(value));
                          setSelectedUnits(parsed);
                        }}
                        noOptionsMessage={() => 'No more units to choose'}
                      />

                      <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                        <div className="mb-2 flex items-center gap-3">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-xs font-semibold text-primary">3</span>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                              Step 3: Configure Random Questions
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Choose count, type, and difficulty.
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)]">
                          <input
                            type="number"
                            min={1}
                            max={50}
                            aria-label="Number of random questions"
                            className="h-10 w-full rounded-xl border border-border bg-background/90 px-3 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                            value={randomCount}
                            onChange={(e) => setRandomCount(e.target.value)}
                          />
                          <Select<SelectOption, false>
                            isDisabled={isInteractiveQuiz}
                            styles={MODERN_SELECT_STYLES}
                            value={selectedQuestionTypeOption}
                            options={randomTypeSelectOptions}
                            onChange={(option: SingleValue<SelectOption>) => {
                              if (!option) return;
                              setRandomQuestionType(option.value as RandomQuestionType);
                            }}
                          />
                          <Select<SelectOption, false>
                            styles={MODERN_SELECT_STYLES}
                            value={selectedDifficultyOption}
                            options={DIFFICULTY_OPTIONS}
                            onChange={(option: SingleValue<SelectOption>) => {
                              if (!option) return;
                              setRandomDifficulty(option.value as DifficultyProfile);
                            }}
                          />
                        </div>

                        {!isInteractiveQuiz && randomQuestionType === 'mixed' && (
                          <div className="mt-3 space-y-3 rounded-xl border border-primary/20 bg-primary/[0.05] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                                Mixed-Mode Split
                              </p>
                              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                {normalizedMixMcqCountPreview} MCQ + {normalizedMixSqlCountPreview} SQL/TEXT
                              </span>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                              <input
                                type="number"
                                min={MIN_MIX_MCQ_COUNT}
                                max={Math.max(MIN_MIX_MCQ_COUNT, normalizedRandomCountPreview - 1)}
                                step={1}
                                value={mixMcqCountInput}
                                onChange={(e) => setMixMcqCountInput(e.target.value)}
                                className="h-10 w-full rounded-xl border border-border bg-background/90 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                              />
                              <p className="text-xs text-muted-foreground">
                                Choose how many MCQ questions to include out of {normalizedRandomCountPreview}. The remaining {normalizedMixSqlCountPreview} question(s) will be SQL/TEXT.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3">
                        <div className="mb-2 flex items-center gap-3">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-xs font-semibold text-primary">4</span>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                              Step 4: Preview and Add
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Units: {selectedUnits.length > 0 ? selectedUnits.join(', ') : 'None selected'} | Count: {normalizedRandomCountPreview} | Type: {isInteractiveQuiz ? 'mcq' : randomQuestionType} | Difficulty: {randomDifficulty}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddRandomQuestions}
                          disabled={randomizingQuestions || parsingImport || importingQuestions || selectedUnits.length === 0}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {randomizingQuestions ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          {randomizingQuestions ? 'Adding...' : 'Add Questions from Database'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  This test is published. Questions and answer keys are now read-only.
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
              Question management is available to teachers only.
            </div>
          )}

          <div className="space-y-2">
            {questions.length === 0 && (
              <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
                No questions added yet.
              </div>
            )}
            {questions.map((question) => {
              const isRemoving = removingQuestionId === question.id;
              const questionTypeLabel = question.question_type === 'mcq' ? 'MCQ' : 'SQL/TEXT';
              const resolvedAnswer = question.correct_answer?.trim() || 'Not set';
              return (
                <div
                  key={question.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-foreground">{question.text}</p>
                      <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {questionTypeLabel}
                      </span>
                    </div>

                    {question.question_type === 'mcq' && question.options.length > 0 && (
                      <div className="mt-2 grid gap-1">
                        {question.options.map((option) => (
                          <p key={`${question.id}_${option.key}`} className="text-xs text-muted-foreground">
                            {option.key}. {option.text}
                          </p>
                        ))}
                      </div>
                    )}

                    {isTeacher && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Answer Key: {resolvedAnswer}
                      </p>
                    )}
                  </div>
                  {canEditQuestions && (
                    <button
                      onClick={() => handleRemoveQuestion(question.id)}
                      disabled={isRemoving}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-300 bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 transition hover:border-rose-400 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:border-red-500/35 dark:hover:bg-red-500/20"
                    >
                      {isRemoving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
