"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trophy,
  Trash2,
  UserCircle2,
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

type RandomQuestionType = 'mcq' | 'sql_fill' | 'mixed';
type DifficultyProfile = 'basic' | 'medium' | 'hard' | 'mixed';

const MIN_MIX_MCQ_COUNT = 1;

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

const DEFAULT_MCQ_OPTIONS = [
  { key: 'A', text: '' },
  { key: 'B', text: '' },
  { key: 'C', text: '' },
  { key: 'D', text: '' },
];

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 inline-flex rounded-lg border border-border/70 bg-background/60 p-2 text-muted-foreground">
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
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

  const [questions, setQuestions] = useState<Question[]>([]);

  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'mcq' | 'sql_fill'>('mcq');
  const [newQuestionAnswer, setNewQuestionAnswer] = useState('');
  const [newMcqOptions, setNewMcqOptions] = useState(DEFAULT_MCQ_OPTIONS);
  const [newMcqCorrectKey, setNewMcqCorrectKey] = useState('A');
  const [randomCount, setRandomCount] = useState('5');
  const [randomQuestionType, setRandomQuestionType] = useState<RandomQuestionType>('mixed');
  const [randomDifficulty, setRandomDifficulty] = useState<DifficultyProfile>('mixed');
  const [mixMcqCountInput, setMixMcqCountInput] = useState('3');
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const [addingQuestion, setAddingQuestion] = useState(false);
  const [randomizingQuestions, setRandomizingQuestions] = useState(false);
  const [removingQuestionId, setRemovingQuestionId] = useState<string | null>(null);
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const isInteractiveQuiz = test?.module_type === 'interactive_quiz';
  const isPublished = (test?.status ?? '').toLowerCase() === 'published';

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
        const loadedAnswerDrafts = loadedQuestions.reduce<Record<string, string>>((acc, question) => {
          acc[question.id] = question.correct_answer
            ?? (question.question_type === 'mcq' ? question.options?.[0]?.key ?? '' : '');
          return acc;
        }, {});

        const loadedTest = (testData.test || null) as Test | null;
        setTest(loadedTest);
        setQuestions(loadedQuestions);
        setAnswerDrafts(loadedAnswerDrafts);

        if (loadedTest?.module_type === 'interactive_quiz') {
          setNewQuestionType('mcq');
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

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTeacher || !newQuestion.trim() || !testId) return;

    if (isInteractiveQuiz && newQuestionType !== 'mcq') {
      setActionError('Interactive Quiz supports MCQ questions only.');
      return;
    }

    if (newQuestionType === 'mcq') {
      const normalizedOptions = newMcqOptions
        .map((option) => ({ key: option.key, text: option.text.trim() }))
        .filter((option) => option.text.length > 0);

      if (normalizedOptions.length < 2) {
        setActionError('Please provide at least 2 answer options for MCQ.');
        return;
      }

      if (!normalizedOptions.some((option) => option.key === newMcqCorrectKey)) {
        setActionError('Please select a valid correct option key for this MCQ.');
        return;
      }
    }

    setAddingQuestion(true);
    setActionError(null);

    try {
      const effectiveQuestionType: 'mcq' | 'sql_fill' = isInteractiveQuiz ? 'mcq' : newQuestionType;
      const res = await fetch(`/api/tests/${testId}/questions${teacherAccessQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newQuestion.trim(),
          question_type: effectiveQuestionType,
          correct_answer: effectiveQuestionType === 'mcq' ? newMcqCorrectKey : newQuestionAnswer.trim(),
          options: effectiveQuestionType === 'mcq'
            ? newMcqOptions.map((option) => ({ key: option.key, text: option.text.trim() }))
            : undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.question) {
        setQuestions((prev) => [...prev, data.question]);
        setAnswerDrafts((prev) => ({
          ...prev,
          [data.question.id]: data.question.correct_answer
            ?? (data.question.question_type === 'mcq' ? data.question.options?.[0]?.key ?? '' : ''),
        }));
        setNewQuestion('');
        setNewQuestionAnswer('');
        setNewMcqOptions(DEFAULT_MCQ_OPTIONS.map((option) => ({ ...option })));
        setNewMcqCorrectKey('A');
      } else {
        setActionError(data.error || 'Unable to add question');
      }
    } catch {
      setActionError('Unable to add question');
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleRemoveQuestion = async (id: string) => {
    if (!isTeacher || !testId) return;

    setRemovingQuestionId(id);
    setActionError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/questions${teacherAccessQuery}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setQuestions((prev) => prev.filter((question) => question.id !== id));
        setAnswerDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
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
    if (!isTeacher || !testId) return;

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

    try {
      const res = await fetch(`/api/tests/${testId}/questions/randomize${teacherAccessQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: normalizedCount,
          question_type: effectiveQuestionType,
          mix_mcq_count: requestedMixMcqCount,
          difficulty: randomDifficulty,
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

      setAnswerDrafts((prev) => {
        const next = { ...prev };
        for (const question of randomQuestions) {
          next[question.id] = question.correct_answer
            ?? (question.question_type === 'mcq' ? question.options?.[0]?.key ?? '' : '');
        }
        return next;
      });
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
    } catch {
      setActionError('Unable to publish test.');
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveQuestionAnswer = async (questionId: string) => {
    if (!isTeacher || !testId) return;

    const question = questions.find((row) => row.id === questionId);
    if (!question) return;

    const draftAnswer = answerDrafts[questionId] ?? '';
    if (question.question_type === 'mcq' && !draftAnswer.trim()) {
      setActionError('Please select a correct option before saving the MCQ answer key.');
      return;
    }

    setSavingAnswerId(questionId);
    setActionError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/questions${teacherAccessQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: questionId,
          correct_answer: draftAnswer,
        }),
      });
      const data = await res.json();

      if (res.ok && data.question) {
        setQuestions((prev) =>
          prev.map((question) => (question.id === questionId ? data.question : question)),
        );
      } else {
        setActionError(data.error || 'Unable to save answer key');
      }
    } catch {
      setActionError('Unable to save answer key');
    } finally {
      setSavingAnswerId(null);
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
        {isInteractiveQuiz && (
          <Link
            href={`/interactive-quiz/${test.id}/leaderboard`}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/12 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            <Trophy size={14} />
            View Leaderboard
          </Link>
        )}
        {isTeacher && (
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

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Questions"
          value={String(stats.questionCount)}
          description="Current test question set"
          icon={<ClipboardList size={16} />}
        />
        <StatCard
          title="Updated"
          value={new Date(test.updated_at).toLocaleDateString()}
          description="Latest modification date"
          icon={<Clock3 size={16} />}
        />
        <StatCard
          title="Author"
          value={test.created_by.slice(0, 8)}
          description="Test creator identifier"
          icon={<UserCircle2 size={16} />}
        />
      </div>

      {actionError && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {actionError}
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
            <form onSubmit={handleAddQuestion} className="mb-4 space-y-2">
              <input
                className="h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                placeholder="Add a question prompt..."
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                maxLength={240}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="h-11 w-full rounded-xl border border-border bg-background/90 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  value={newQuestionType}
                  onChange={(e) => setNewQuestionType(e.target.value as 'mcq' | 'sql_fill')}
                  disabled={isInteractiveQuiz}
                >
                  <option value="mcq">MCQ (multiple choice)</option>
                  {!isInteractiveQuiz && <option value="sql_fill">SQL / text answer</option>}
                </select>
                {newQuestionType === 'mcq' || isInteractiveQuiz ? (
                  <select
                    className="h-11 w-full rounded-xl border border-border bg-background/90 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    value={newMcqCorrectKey}
                    onChange={(e) => setNewMcqCorrectKey(e.target.value)}
                  >
                    {newMcqOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        Correct Option: {option.key}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    placeholder="Answer key (example: SELECT * FROM students)"
                    value={newQuestionAnswer}
                    onChange={(e) => setNewQuestionAnswer(e.target.value)}
                    maxLength={240}
                  />
                )}
              </div>

              {(newQuestionType === 'mcq' || isInteractiveQuiz) && (
                <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    MCQ Options
                  </p>
                  {newMcqOptions.map((option, index) => (
                    <div key={option.key} className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background/70 text-xs font-semibold text-muted-foreground">
                        {option.key}
                      </span>
                      <input
                        className="h-9 w-full rounded-lg border border-border bg-background/90 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                        placeholder={`Option ${option.key}`}
                        value={option.text}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewMcqOptions((prev) => prev.map((row, rowIndex) => (
                            rowIndex === index ? { ...row, text: value } : row
                          )));
                        }}
                        maxLength={180}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={addingQuestion || !newQuestion.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addingQuestion ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
                {addingQuestion ? 'Adding Question...' : 'Add Question'}
              </button>

              <div className="rounded-xl border border-border/70 bg-card/85 p-4 shadow-sm shadow-black/10">
                <div className="flex items-center gap-2">
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-teal-400/30 bg-teal-500/10 text-teal-200">
                    <Sparkles size={13} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                      Add Random Questions From Database
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pull approved sample questions from the question bank.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    aria-label="Number of random questions"
                    className="h-10 w-full rounded-xl border border-border bg-background/90 px-3 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    value={randomCount}
                    onChange={(e) => setRandomCount(e.target.value)}
                  />
                  <select
                    value={randomQuestionType}
                    onChange={(e) => setRandomQuestionType(e.target.value as RandomQuestionType)}
                    disabled={isInteractiveQuiz}
                    className="h-10 w-full rounded-xl border border-border bg-background/90 px-3 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {!isInteractiveQuiz && (
                      <option value="mixed">
                        Mixed Questions (MCQ + SQL/TEXT)
                      </option>
                    )}
                    <option value="mcq">
                      MCQ only
                    </option>
                    {!isInteractiveQuiz && (
                      <option value="sql_fill">
                        Test-based (SQL/TEXT) only
                      </option>
                    )}
                  </select>
                  <select
                    value={randomDifficulty}
                    onChange={(e) => setRandomDifficulty(e.target.value as DifficultyProfile)}
                    className="h-10 w-full rounded-xl border border-border bg-background/90 px-3 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="mixed">Difficulty: Mixed</option>
                    <option value="basic">Difficulty: Basic (easy)</option>
                    <option value="medium">Difficulty: Medium</option>
                    <option value="hard">Difficulty: Hard</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddRandomQuestions}
                    disabled={randomizingQuestions}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {randomizingQuestions ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {randomizingQuestions ? 'Randomizing...' : 'Add Random'}
                  </button>
                </div>

                {!isInteractiveQuiz && randomQuestionType === 'mixed' && (
                  <div className="mt-3 space-y-3 rounded-xl border border-teal-500/20 bg-teal-500/[0.05] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-200">
                        Mixed-Mode Split
                      </p>
                      <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[11px] font-semibold text-teal-100">
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
            </form>
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
                      <div className="mt-1 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Answer Key: {resolvedAnswer}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {question.question_type === 'mcq' ? (
                            <select
                              value={answerDrafts[question.id] ?? ''}
                              onChange={(e) =>
                                setAnswerDrafts((prev) => ({
                                  ...prev,
                                  [question.id]: e.target.value,
                                }))
                              }
                              className="h-8 w-full rounded-lg border border-border bg-background/80 px-2.5 text-xs outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 sm:w-64"
                            >
                              <option value="">Select correct option</option>
                              {question.options.map((option) => (
                                <option key={`${question.id}_answer_${option.key}`} value={option.key}>
                                  {option.key} - {option.text}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={answerDrafts[question.id] ?? ''}
                              onChange={(e) =>
                                setAnswerDrafts((prev) => ({
                                  ...prev,
                                  [question.id]: e.target.value,
                                }))
                              }
                              placeholder="Set or update answer key"
                              className="h-8 w-full rounded-lg border border-border bg-background/80 px-2.5 text-xs outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 sm:w-64"
                            />
                          )}
                          <button
                            onClick={() => handleSaveQuestionAnswer(question.id)}
                            disabled={savingAnswerId === question.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background/70 px-2 py-1 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingAnswerId === question.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Save size={11} />
                            )}
                            Save Answer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {isTeacher && (
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
