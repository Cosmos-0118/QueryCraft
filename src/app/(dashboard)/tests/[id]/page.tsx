"use client";

import Link from 'next/link';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Select, { type MultiValue, type SingleValue, type StylesConfig } from 'react-select';
import { useTestAuth as useAuth } from '@/features/test-module/hooks/use-test-auth';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Database,
  FileJson,
  Hash,
  Info,
  Loader2,
  Send,
  Sparkles,
  Trophy,
  Trash2,
  Upload,
  User,
  X,
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

interface QuestionBankEntry {
  id: string;
  text: string;
  question_type: 'mcq' | 'sql_fill';
  options: Array<{ key: string; text: string }>;
  difficulty: 'easy' | 'medium' | 'hard';
  unit: number | null;
  uploaded_at: string;
  uploaded_by_display_name: string;
}

type RandomQuestionType = 'mcq' | 'sql_fill' | 'mixed';
type DifficultyProfile = 'basic' | 'medium' | 'hard' | 'mixed';
type QuestionSourceMode = 'import' | 'database' | null;
type SelectOption = { value: string; label: string };

const MIN_MIX_MCQ_COUNT = 1;
const FALLBACK_UNITS = [1, 2, 3, 4, 5];
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
  const router = useRouter();
  const { user, hydrated, isAuthenticated } = useAuth();
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
  const [availableUnits, setAvailableUnits] = useState<number[]>(FALLBACK_UNITS);

  const [showQuestionBankModal, setShowQuestionBankModal] = useState(false);
  const [questionBankQuery, setQuestionBankQuery] = useState('');
  const [questionBankDifficulty, setQuestionBankDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [questionBankType, setQuestionBankType] = useState<'all' | 'mcq' | 'sql_fill'>('all');
  const [questionBankUnit, setQuestionBankUnit] = useState<'all' | number>('all');
  const [questionBankUploadedFrom, setQuestionBankUploadedFrom] = useState('');
  const [questionBankUploadedTo, setQuestionBankUploadedTo] = useState('');
  const [questionBankPage, setQuestionBankPage] = useState(0);
  const [questionBankTotal, setQuestionBankTotal] = useState(0);
  const [questionBankItems, setQuestionBankItems] = useState<QuestionBankEntry[]>([]);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionBankError, setQuestionBankError] = useState<string | null>(null);
  const [questionBankSelectedIds, setQuestionBankSelectedIds] = useState<string[]>([]);
  const [addingSelectedQuestions, setAddingSelectedQuestions] = useState(false);

  const [randomizingQuestions, setRandomizingQuestions] = useState(false);
  const [removingQuestionId, setRemovingQuestionId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);

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
  const unitOptions = useMemo<SelectOption[]>(
    () => availableUnits.map((unit) => ({ value: String(unit), label: `Unit ${unit}` })),
    [availableUnits],
  );
  const selectedUnitOptions = unitOptions.filter((option) => selectedUnits.includes(Number(option.value)));

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace(`/login?next=${encodeURIComponent(`/tests/${testId ?? ''}`)}`);
      return;
    }
  }, [hydrated, isAuthenticated, router, testId, user]);

  useEffect(() => {
    if (!testId || !hydrated || !isAuthenticated) return;

    const controller = new AbortController();

    const loadTest = async () => {
      setLoading(true);
      setError(null);

      try {
        const [testRes, questionsRes] = await Promise.all([
          fetch(`/api/tests/${testId}${teacherAccessQuery}`, { signal: controller.signal }),
          fetch(`/api/tests/${testId}/questions${teacherQuestionsQuery}`, { signal: controller.signal }),
        ]);

        if (testRes.status === 401 || questionsRes.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/tests/${testId}`)}`);
          return;
        }

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
  }, [hydrated, isAuthenticated, teacherAccessQuery, teacherQuestionsQuery, testId, router]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !isTeacher) return;

    let cancelled = false;
    const loadUnits = async () => {
      try {
        const res = await fetch('/api/tests/questions-bank?limit=1');
        const data = await res.json() as {
          facets?: { units?: number[] };
        };
        if (!res.ok || cancelled) return;
        const fetchedUnits = Array.isArray(data.facets?.units)
          ? data.facets.units
              .filter((value) => Number.isFinite(value))
              .map((value) => Math.floor(value))
              .filter((value) => value >= 1 && value <= 99)
          : [];
        if (fetchedUnits.length > 0) {
          setAvailableUnits(Array.from(new Set(fetchedUnits)).sort((a, b) => a - b));
        }
      } catch {
        // Keep fallback unit list.
      }
    };

    void loadUnits();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isAuthenticated, isTeacher]);

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

  useEffect(() => {
    if (!showQuestionBankModal || !isTeacher) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadQuestionBank = async () => {
      setQuestionBankLoading(true);
      setQuestionBankError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', '20');
        params.set('offset', String(questionBankPage * 20));
        if (questionBankQuery.trim()) params.set('q', questionBankQuery.trim());
        if (questionBankDifficulty !== 'all') params.set('difficulty', questionBankDifficulty);
        const effectiveBankType = isInteractiveQuiz ? 'mcq' : questionBankType;
        if (effectiveBankType !== 'all') params.set('question_type', effectiveBankType);
        if (questionBankUnit !== 'all') params.set('units', String(questionBankUnit));
        if (questionBankUploadedFrom) params.set('uploaded_from', questionBankUploadedFrom);
        if (questionBankUploadedTo) params.set('uploaded_to', questionBankUploadedTo);

        const res = await fetch(`/api/tests/questions-bank?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json() as {
          questions?: QuestionBankEntry[];
          total?: number;
          facets?: { units?: number[] };
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || 'Unable to load question bank.');
        }
        if (cancelled) return;

        setQuestionBankItems(Array.isArray(data.questions) ? data.questions : []);
        setQuestionBankTotal(typeof data.total === 'number' ? data.total : 0);

        const fetchedUnits = Array.isArray(data.facets?.units)
          ? data.facets.units
              .filter((value) => Number.isFinite(value))
              .map((value) => Math.floor(value))
              .filter((value) => value >= 1 && value <= 99)
          : [];
        if (fetchedUnits.length > 0) {
          setAvailableUnits(Array.from(new Set(fetchedUnits)).sort((a, b) => a - b));
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (!cancelled) {
          setQuestionBankError(err instanceof Error ? err.message : 'Unable to load question bank.');
        }
      } finally {
        if (!cancelled) {
          setQuestionBankLoading(false);
        }
      }
    };

    void loadQuestionBank();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    showQuestionBankModal,
    isTeacher,
    questionBankPage,
    questionBankQuery,
    questionBankDifficulty,
    questionBankType,
    questionBankUnit,
    questionBankUploadedFrom,
    questionBankUploadedTo,
    isInteractiveQuiz,
  ]);

  useEffect(() => {
    setQuestionBankPage(0);
  }, [
    questionBankQuery,
    questionBankDifficulty,
    questionBankType,
    questionBankUnit,
    questionBankUploadedFrom,
    questionBankUploadedTo,
  ]);

  const toggleQuestionBankSelection = (questionId: string) => {
    setQuestionBankSelectedIds((prev) => (
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    ));
  };

  const handleAddSelectedQuestions = async () => {
    if (!canEditQuestions || !testId) return;
    if (questionBankSelectedIds.length === 0) {
      setQuestionBankError('Select at least one question.');
      return;
    }

    setAddingSelectedQuestions(true);
    setQuestionBankError(null);
    setActionError(null);
    setActionNotice(null);

    try {
      const res = await fetch(`/api/tests/${testId}/questions/select${teacherAccessQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_bank_ids: questionBankSelectedIds }),
      });
      const data = await res.json() as { questions?: Question[]; error?: string };
      if (!res.ok || !Array.isArray(data.questions)) {
        setQuestionBankError(data.error || 'Unable to add selected questions.');
        return;
      }

      const selectedQuestions = data.questions;
      setQuestions((prev) => {
        const existing = new Set(prev.map((question) => question.id));
        const incoming = selectedQuestions.filter((question) => !existing.has(question.id));
        return [...prev, ...incoming];
      });
      setActionNotice(`Added ${selectedQuestions.length} selected question${selectedQuestions.length === 1 ? '' : 's'}.`);
      setQuestionBankSelectedIds([]);
      setShowQuestionBankModal(false);
    } catch {
      setQuestionBankError('Unable to add selected questions.');
    } finally {
      setAddingSelectedQuestions(false);
    }
  };

  const handlePublishTest = async () => {
    if (!isTeacher || !testId || !test || isPublished || publishing) return;
    setShowPublishDialog(false);

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

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            {hydrated ? 'Redirecting to sign in...' : 'Checking your session...'}
          </div>
        </div>
      </div>
    );
  }

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
              <Link
                href="/tests"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
              >
                <ArrowLeft size={15} />
                Back to Tests
              </Link>
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
    <div className="relative mx-auto flex min-h-full w-full max-w-[1320px] flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12 2xl:px-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_top_left,rgba(45,212,191,0.06),transparent),radial-gradient(ellipse_60%_40%_at_bottom_right,rgba(56,189,248,0.05),transparent)]" />

      {/* Back link */}
      <Link
        href="/tests"
        className="mb-8 inline-flex w-fit items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
      >
        <ArrowLeft size={13} />
        Back to Tests
      </Link>

      {/* Page header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(test.status)}`}>
              {formatStatus(test.status)}
            </span>
            {isInteractiveQuiz && (
              <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
                Interactive Quiz
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl xl:text-4xl">{test.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage questions and publishing for this assessment.
          </p>
        </div>

        {isTeacher && (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            {isInteractiveQuiz && isPublished && (
              <Link
                href={`/interactive-quiz/${test.id}/leaderboard`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/18 sm:w-auto"
              >
                <Trophy size={14} />
                Leaderboard
              </Link>
            )}
            {isPublished && (
              <Link
                href={`/tests/${test.id}/review`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 sm:w-auto"
              >
                <CheckCircle2 size={14} />
                Review Submissions
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowPublishDialog(true)}
              disabled={isPublished || publishing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/12 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {isPublished ? 'Published' : publishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        )}
      </div>

      {/* Metadata chips */}
      <div className="mb-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3.5 py-2 text-sm">
          <Hash size={13} className="text-primary" />
          <span className="font-semibold text-foreground">{stats.questionCount}</span>
          <span className="text-muted-foreground">questions</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3.5 py-2 text-sm text-muted-foreground">
          <Clock3 size={13} />
          Updated {new Date(test.updated_at).toLocaleDateString()}
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3.5 py-2 text-sm text-muted-foreground">
          <User size={13} />
          {test.created_by.slice(0, 8)}
        </div>
      </div>

      {/* Student access code */}
      {isTeacher && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-card/70 p-5 sm:p-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Student Access Code
          </p>
          {test.test_code ? (
            <p className="font-mono text-2xl font-bold tracking-[0.2em] text-primary">{test.test_code}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Publish this test to generate a code.</p>
          )}
        </div>
      )}

      {/* Interactive quiz rules */}
      {isInteractiveQuiz && (
        <div className="mb-6 rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Info size={14} className="shrink-0 text-violet-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-300">Interactive Quiz Rules</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200">
              Timer: {test.interactive_settings?.question_timer_seconds ?? 40}s / question
            </span>
            <span className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200">
              Max: {test.interactive_settings?.max_points_per_question ?? 500} pts
            </span>
            <span className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200">
              Difficulty: {test.interactive_settings?.difficulty_profile ?? 'mixed'}
            </span>
            <span className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200">
              Shuffle questions: {test.interactive_settings?.randomize_questions ? 'Yes' : 'No'}
            </span>
            <span className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200">
              Shuffle options: {test.interactive_settings?.randomize_options ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      )}

      {/* Notifications */}
      {actionError && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/[0.08] p-4 text-sm text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionNotice && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4 text-sm text-emerald-300">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Questions section */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-xl shadow-black/10 sm:p-6 xl:p-8">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Questions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Build the question set that students will attempt.</p>
          </div>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70 text-sm font-semibold text-muted-foreground">
            {questions.length}
          </span>
        </div>

        {isTeacher ? (
          <div className="mb-8 space-y-4">
            {canEditQuestions ? (
              <>
                {/* Step 1: Choose method */}
                <div className="rounded-2xl border border-border/60 bg-background/30 p-4 sm:p-6">
                  <div className="mb-5 flex items-start gap-4">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-bold text-primary">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">Choose How You Want To Add Questions</p>
                      <p className="mt-1 text-xs text-muted-foreground">Pick one method first. The next steps will adapt automatically.</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setQuestionSourceMode('import')}
                      className={`group rounded-xl border p-5 text-left transition ${questionSourceMode === 'import'
                          ? 'border-primary/50 bg-primary/[0.08] shadow-sm shadow-primary/10'
                          : 'border-border/60 bg-background/50 hover:border-primary/30 hover:bg-background/70'
                        }`}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${questionSourceMode === 'import'
                            ? 'border-primary/40 bg-primary/15 text-primary'
                            : 'border-border/70 bg-background/60 text-muted-foreground group-hover:border-primary/30 group-hover:text-primary'
                          }`}>
                          <FileJson size={16} />
                        </div>
                        <p className="font-semibold text-foreground">Import from JSON</p>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">Upload your own prepared question file.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuestionSourceMode('database')}
                      className={`group rounded-xl border p-5 text-left transition ${questionSourceMode === 'database'
                          ? 'border-primary/50 bg-primary/[0.08] shadow-sm shadow-primary/10'
                          : 'border-border/60 bg-background/50 hover:border-primary/30 hover:bg-background/70'
                        }`}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${questionSourceMode === 'database'
                            ? 'border-primary/40 bg-primary/15 text-primary'
                            : 'border-border/70 bg-background/60 text-muted-foreground group-hover:border-primary/30 group-hover:text-primary'
                          }`}>
                          <Database size={16} />
                        </div>
                        <p className="font-semibold text-foreground">Use Question Bank</p>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">Choose units and pull approved random questions.</p>
                    </button>
                  </div>
                </div>

                {/* Import flow */}
                {questionSourceMode === 'import' && (
                  <div className="rounded-2xl border border-border/60 bg-background/30 p-4 sm:p-6">
                    <div className="mb-5 flex items-start gap-4">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-bold text-primary">
                        2
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">Import Questions From JSON</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Upload an array of questions (or object with questions array). A preview is shown before import.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                      <div className="flex min-w-0 items-center rounded-xl border border-border bg-background/90 px-3 py-2.5 transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
                        <input
                          key={importInputKey}
                          id="import-questions-json"
                          type="file"
                          accept="application/json,.json"
                          onChange={handleImportFileChange}
                          disabled={parsingImport || importingQuestions}
                          className="sr-only"
                        />
                        <label
                          htmlFor="import-questions-json"
                          className={`inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-primary/25 bg-primary/15 px-3 text-xs font-semibold text-primary transition hover:bg-primary/20 ${
                            parsingImport || importingQuestions ? 'pointer-events-none opacity-60' : ''
                          }`}
                        >
                          Choose File
                        </label>
                        <p className="ml-3 min-w-0 truncate text-sm text-muted-foreground">
                          {importFileName || 'No file chosen'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 xl:flex-nowrap">
                        <button
                          type="button"
                          onClick={handleImportQuestions}
                          disabled={parsingImport || importingQuestions || importQueue.length === 0}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {importingQuestions ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          {importingQuestions ? 'Importing...' : `Import (${importQueue.length})`}
                        </button>
                        <button
                          type="button"
                          onClick={resetImportSelection}
                          disabled={parsingImport || importingQuestions || importQueue.length === 0}
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-border/80 bg-background/70 px-4 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {importFileName && (
                      <p className="mt-3 text-xs text-muted-foreground">File: {importFileName}</p>
                    )}

                    {importPreview.length > 0 && (
                      <div className="mt-5 rounded-xl border border-border/60 bg-background/40 p-5">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Preview Before Import
                        </p>
                        <div className="space-y-3">
                          {importPreview.slice(0, 20).map((question) => (
                            <div
                              key={`${question.sourceIndex}_${question.text}`}
                              className="rounded-xl border border-border/50 bg-background/70 p-4"
                            >
                              <p className="text-sm font-medium text-foreground">
                                #{question.sourceIndex} {question.text}
                              </p>
                              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                  {question.question_type === 'mcq' ? 'MCQ' : 'SQL/TEXT'}
                                </span>
                                <span className="text-xs text-muted-foreground">Answer: {question.correct_answer}</span>
                              </div>
                              {question.question_type === 'mcq' && question.options && (
                                <div className="mt-3 grid gap-1.5">
                                  {question.options.map((option) => (
                                    <p key={`${question.sourceIndex}_${option.key}`} className="text-xs text-muted-foreground">
                                      <span className="font-semibold text-foreground/60">{option.key}.</span> {option.text}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {importPreview.length > 20 && (
                          <p className="mt-3 text-xs text-muted-foreground">Showing first 20 of {importPreview.length} questions.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Database flow */}
                {questionSourceMode === 'database' && (
                  <div className="rounded-2xl border border-border/60 bg-background/30 p-4 sm:p-6">
                    {/* Step 2: Choose Units */}
                    <div className="mb-6 flex items-start gap-4">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-bold text-primary">
                        2
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 font-semibold text-foreground">Choose Units (Optional)</p>
                        <p className="mb-4 text-xs text-muted-foreground">Pick units to narrow results, or leave empty to randomize from all units.</p>
                        <Select<SelectOption, true>
                          isMulti
                          styles={MODERN_SELECT_STYLES}
                          value={selectedUnitOptions}
                          options={unitOptions}
                          closeMenuOnSelect={false}
                          placeholder="Optional: select units (for example Unit 1, Unit 3)..."
                          onChange={(options: MultiValue<SelectOption>) => {
                            const parsed = options
                              .map((option) => Number(option.value))
                              .filter((value) => Number.isFinite(value));
                            setSelectedUnits(parsed);
                          }}
                          noOptionsMessage={() => 'No more units to choose'}
                        />
                      </div>
                    </div>

                    <div className="my-5 h-px bg-border/40" />

                    {/* Step 3: Configure */}
                    <div className="mb-6 flex items-start gap-4">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-bold text-primary">
                        3
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 font-semibold text-foreground">Configure Random Questions</p>
                        <p className="mb-4 text-xs text-muted-foreground">Choose count, type, and difficulty.</p>
                        <div className="grid gap-3 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)]">
                          <input
                            type="number"
                            min={1}
                            max={50}
                            aria-label="Number of random questions"
                            className="h-11 w-full rounded-xl border border-border bg-background/90 px-4 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
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
                          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.05] p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Mixed-Mode Split</p>
                              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                {normalizedMixMcqCountPreview} MCQ + {normalizedMixSqlCountPreview} SQL/TEXT
                              </span>
                            </div>
                            <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
                              <input
                                type="number"
                                min={MIN_MIX_MCQ_COUNT}
                                max={Math.max(MIN_MIX_MCQ_COUNT, normalizedRandomCountPreview - 1)}
                                step={1}
                                value={mixMcqCountInput}
                                onChange={(e) => setMixMcqCountInput(e.target.value)}
                                className="h-11 w-full rounded-xl border border-border bg-background/90 px-4 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                              />
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                MCQ questions to include out of {normalizedRandomCountPreview}. The remaining {normalizedMixSqlCountPreview} will be SQL/TEXT.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="my-5 h-px bg-border/40" />

                    {/* Step 4: Preview & Add */}
                    <div className="flex items-start gap-4">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-bold text-primary">
                        4
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 font-semibold text-foreground">Preview and Add</p>
                        <p className="mb-4 text-xs text-muted-foreground">Review your settings before pulling questions.</p>
                        <div className="mb-5 flex flex-wrap gap-2">
                          <span className="rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            Units: {selectedUnits.length > 0 ? selectedUnits.map((u) => `Unit ${u}`).join(', ') : 'None selected'}
                          </span>
                          <span className="rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            Count: {normalizedRandomCountPreview}
                          </span>
                          <span className="rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            Type: {isInteractiveQuiz ? 'MCQ' : randomQuestionType}
                          </span>
                          <span className="rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                            Difficulty: {randomDifficulty}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleAddRandomQuestions}
                          disabled={randomizingQuestions || parsingImport || importingQuestions}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-6 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {randomizingQuestions ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {randomizingQuestions ? 'Adding...' : 'Add Random Questions'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuestionBankPage(0);
                              setQuestionBankError(null);
                              setQuestionBankSelectedIds([]);
                              if (isInteractiveQuiz) {
                                setQuestionBankType('mcq');
                              }
                              setShowQuestionBankModal(true);
                            }}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/70 px-5 text-sm font-semibold text-muted-foreground transition hover:border-primary/35 hover:text-foreground"
                          >
                            <Database size={14} />
                            Browse & Pick Questions
                          </button>
                          <Link
                            href="/tests/questions-bank"
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/70 px-5 text-sm font-semibold text-muted-foreground transition hover:border-primary/35 hover:text-foreground"
                          >
                            <Upload size={14} />
                            Open Bank Page
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-sm text-amber-200">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>This test is published. Questions and answer keys are now read-only.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-7 rounded-2xl border border-border/60 bg-background/30 p-4 text-sm text-muted-foreground">
            Question management is available to teachers only.
          </div>
        )}

        {/* Question list */}
        <div className="space-y-3">
          {questions.length === 0 && (
            <div className="rounded-2xl border border-border/50 bg-background/30 py-12 text-center">
              <p className="text-sm text-muted-foreground">No questions added yet.</p>
            </div>
          )}
          {questions.map((question, index) => {
            const isRemoving = removingQuestionId === question.id;
            const resolvedAnswer = question.correct_answer?.trim() || 'Not set';
            return (
              <div
                key={question.id}
                className="rounded-2xl border border-border/70 bg-background/50 p-4 transition hover:border-primary/25 hover:bg-background/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Question {index + 1}
                    </p>
                    <p className="mt-1 text-base font-medium text-foreground">{question.text}</p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    {canEditQuestions && (
                      <button
                        onClick={() => handleRemoveQuestion(question.id)}
                        disabled={isRemoving}
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3 text-xs font-semibold text-red-300 transition hover:border-red-500/40 hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isRemoving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {question.question_type === 'mcq' && question.options.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {question.options.map((option) => (
                      <div
                        key={`${question.id}_${option.key}`}
                        className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2.5 text-sm text-muted-foreground"
                      >
                        <span className="inline-flex w-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                          {option.key}
                        </span>
                        <span className="flex-1">{option.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-border/70 bg-card/60 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Answer Format</p>
                    <p className="mt-1 text-sm text-foreground">Free text / SQL response</p>
                  </div>
                )}

                {isTeacher && (
                  <div className="mt-3 rounded-xl border border-success/30 bg-success/10 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-success/90">Answer Key</p>
                    <p className="mt-1 text-sm font-medium text-success">{resolvedAnswer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {showQuestionBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Select Questions from Database</p>
                <p className="text-xs text-muted-foreground">Filter by date, unit, difficulty, and pick questions for this test.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuestionBankModal(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-background/70 text-muted-foreground transition hover:border-border hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>

            <div className="border-b border-border/60 p-4">
              <div className="grid gap-2 md:grid-cols-5">
                <input
                  value={questionBankQuery}
                  onChange={(event) => {
                    setQuestionBankQuery(event.target.value);
                    setQuestionBankPage(0);
                  }}
                  placeholder="Search question text..."
                  className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 md:col-span-2"
                />
                <select
                  value={questionBankDifficulty}
                  onChange={(event) => {
                    setQuestionBankDifficulty(event.target.value as 'all' | 'easy' | 'medium' | 'hard');
                    setQuestionBankPage(0);
                  }}
                  className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <select
                  value={isInteractiveQuiz ? 'mcq' : questionBankType}
                  onChange={(event) => {
                    setQuestionBankType(event.target.value as 'all' | 'mcq' | 'sql_fill');
                    setQuestionBankPage(0);
                  }}
                  disabled={isInteractiveQuiz}
                  className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                >
                  <option value="all">All types</option>
                  <option value="mcq">MCQ</option>
                  <option value="sql_fill">SQL/TEXT</option>
                </select>
                <select
                  value={String(questionBankUnit)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setQuestionBankUnit(value === 'all' ? 'all' : Number(value));
                    setQuestionBankPage(0);
                  }}
                  className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All units</option>
                  {availableUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      Unit {unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <input
                  type="date"
                  value={questionBankUploadedFrom}
                  onChange={(event) => {
                    setQuestionBankUploadedFrom(event.target.value);
                    setQuestionBankPage(0);
                  }}
                  className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="date"
                  value={questionBankUploadedTo}
                  onChange={(event) => {
                    setQuestionBankUploadedTo(event.target.value);
                    setQuestionBankPage(0);
                  }}
                  className="h-10 rounded-xl border border-border bg-background/80 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuestionBankQuery('');
                      setQuestionBankDifficulty('all');
                      setQuestionBankType('all');
                      setQuestionBankUnit('all');
                      setQuestionBankUploadedFrom('');
                      setQuestionBankUploadedTo('');
                      setQuestionBankPage(0);
                    }}
                    className="inline-flex h-10 items-center rounded-xl border border-border/80 bg-background/70 px-4 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {questionBankError && (
                <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {questionBankError}
                </div>
              )}

              {questionBankLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  Loading question bank...
                </div>
              ) : questionBankItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
                  No questions found for the selected filters.
                </div>
              ) : (
                <div className="space-y-2">
                  {questionBankItems.map((question) => {
                    const checked = questionBankSelectedIds.includes(question.id);
                    return (
                      <label
                        key={question.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                          checked
                            ? 'border-primary/50 bg-primary/[0.08]'
                            : 'border-border/70 bg-background/55 hover:border-primary/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleQuestionBankSelection(question.id)}
                          className="mt-1 h-4 w-4 rounded border-border bg-background"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{question.text}</p>
                          <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="rounded-md border border-border/70 bg-background/70 px-2 py-0.5">{question.question_type}</span>
                            <span className="rounded-md border border-border/70 bg-background/70 px-2 py-0.5">{question.difficulty}</span>
                            <span className="rounded-md border border-border/70 bg-background/70 px-2 py-0.5">
                              {question.unit ? `Unit ${question.unit}` : 'Unit NA'}
                            </span>
                            <span className="rounded-md border border-border/70 bg-background/70 px-2 py-0.5">
                              {new Date(question.uploaded_at).toLocaleDateString()}
                            </span>
                            <span className="rounded-md border border-border/70 bg-background/70 px-2 py-0.5">
                              {question.uploaded_by_display_name}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {questionBankPage + 1} of {Math.max(1, Math.ceil(questionBankTotal / 20))}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuestionBankPage((prev) => Math.max(0, prev - 1))}
                  disabled={questionBankPage === 0}
                  className="inline-flex h-9 items-center rounded-lg border border-border/80 bg-background/70 px-3 text-sm text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const maxPage = Math.max(0, Math.ceil(questionBankTotal / 20) - 1);
                    setQuestionBankPage((prev) => Math.min(maxPage, prev + 1));
                  }}
                  disabled={(questionBankPage + 1) * 20 >= questionBankTotal}
                  className="inline-flex h-9 items-center rounded-lg border border-border/80 bg-background/70 px-3 text-sm text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={handleAddSelectedQuestions}
                  disabled={addingSelectedQuestions || questionBankSelectedIds.length === 0}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingSelectedQuestions ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />}
                  {addingSelectedQuestions ? 'Adding...' : `Add Selected (${questionBankSelectedIds.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPublishDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
          onClick={() => {
            if (publishing) return;
            setShowPublishDialog(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-5 shadow-2xl shadow-black/35 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Send size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Publish Test
                </p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">
                  Ready to publish this test?
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Once published, questions and answer keys become read-only. Students can access this test with the generated code.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border/70 bg-background/50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Test</p>
              <p className="mt-1 text-sm font-medium text-foreground">{test.title}</p>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowPublishDialog(false)}
                disabled={publishing}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border/80 bg-background/70 px-4 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishTest}
                disabled={publishing}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {publishing ? 'Publishing...' : 'Publish Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
