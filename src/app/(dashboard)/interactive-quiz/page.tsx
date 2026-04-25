"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Timer,
  Trophy,
  Wand2,
} from 'lucide-react';

interface InteractiveSettings {
  question_timer_seconds: number;
  max_points_per_question: number;
  randomize_questions: boolean;
  randomize_options: boolean;
  difficulty_profile: 'basic' | 'medium' | 'hard' | 'mixed';
}

interface Test {
  id: string;
  title: string;
  status: string;
  created_by: string;
  updated_at: string;
  test_code?: string | null;
  module_type?: 'classic' | 'interactive_quiz';
  interactive_settings?: InteractiveSettings;
}

interface CreateInteractiveQuizModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (test: Test) => void;
  createdBy: string;
  teacherAccessQuery: string;
}

const DEFAULT_SETTINGS: InteractiveSettings = {
  question_timer_seconds: 40,
  max_points_per_question: 500,
  randomize_questions: true,
  randomize_options: true,
  difficulty_profile: 'mixed',
};

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case 'published':
      return 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300';
    case 'draft':
      return 'border-amber-500/30 bg-amber-500/12 text-amber-300';
    default:
      return 'border-border/70 bg-muted/40 text-muted-foreground';
  }
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function CreateInteractiveQuizModal({
  open,
  onClose,
  onCreate,
  createdBy,
  teacherAccessQuery,
}: CreateInteractiveQuizModalProps) {
  const [title, setTitle] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(String(DEFAULT_SETTINGS.question_timer_seconds));
  const [maxPoints, setMaxPoints] = useState(String(DEFAULT_SETTINGS.max_points_per_question));
  const [difficulty, setDifficulty] = useState<InteractiveSettings['difficulty_profile']>('mixed');
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [autoQuestionCount, setAutoQuestionCount] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setTimerSeconds(String(DEFAULT_SETTINGS.question_timer_seconds));
    setMaxPoints(String(DEFAULT_SETTINGS.max_points_per_question));
    setDifficulty('mixed');
    setRandomizeQuestions(true);
    setRandomizeOptions(true);
    setAutoQuestionCount('10');
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsedTimer = Number(timerSeconds);
    const parsedPoints = Number(maxPoints);
    const parsedAutoQuestionCount = Number(autoQuestionCount);

    if (!Number.isFinite(parsedTimer) || parsedTimer < 10 || parsedTimer > 300) {
      setError('Question timer must be between 10 and 300 seconds.');
      return;
    }

    if (!Number.isFinite(parsedPoints) || parsedPoints < 50 || parsedPoints > 2000) {
      setError('Max points per question must be between 50 and 2000.');
      return;
    }

    if (!Number.isFinite(parsedAutoQuestionCount) || parsedAutoQuestionCount < 0 || parsedAutoQuestionCount > 50) {
      setError('Auto question count must be between 0 and 50.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const createRes = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          created_by: createdBy,
          question_mode: 'mcq_only',
          duration_minutes: 30,
          module_type: 'interactive_quiz',
          interactive_settings: {
            question_timer_seconds: Math.round(parsedTimer),
            max_points_per_question: Math.round(parsedPoints),
            randomize_questions: randomizeQuestions,
            randomize_options: randomizeOptions,
            difficulty_profile: difficulty,
          },
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok || !createData.test) {
        setError(createData.error || 'Unable to create interactive quiz.');
        return;
      }

      const createdTest = createData.test as Test;

      if (Math.round(parsedAutoQuestionCount) > 0) {
        const randomizeRes = await fetch(
          `/api/tests/${createdTest.id}/questions/randomize${teacherAccessQuery}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              count: Math.round(parsedAutoQuestionCount),
              question_type: 'mcq',
              difficulty,
            }),
          },
        );

        const randomizeData = await randomizeRes.json();
        if (!randomizeRes.ok) {
          setError(randomizeData.error || 'Quiz created but random question import failed.');
          onCreate(createdTest);
          return;
        }
      }

      onCreate(createdTest);
      reset();
      onClose();
    } catch {
      setError('Unable to create interactive quiz.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-2xl border border-border/70 bg-card/95 p-6 shadow-2xl shadow-black/40"
      >
        <h2 className="text-lg font-bold tracking-tight">Create Interactive Quiz</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure timer, speed points, difficulty, and optional random MCQ import.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="interactive-title" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Quiz title
            </label>
            <input
              id="interactive-title"
              className="h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              placeholder="DBMS Sprint Challenge"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="interactive-difficulty" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Difficulty profile
            </label>
            <select
              id="interactive-difficulty"
              className="h-11 w-full rounded-xl border border-border bg-background/90 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as InteractiveSettings['difficulty_profile'])}
            >
              <option value="basic">Basic (easy)</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="interactive-timer" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Timer per question (sec)
            </label>
            <input
              id="interactive-timer"
              type="number"
              min={10}
              max={300}
              className="h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              value={timerSeconds}
              onChange={(event) => setTimerSeconds(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="interactive-points" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Max points per correct answer
            </label>
            <input
              id="interactive-points"
              type="number"
              min={50}
              max={2000}
              className="h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              value={maxPoints}
              onChange={(event) => setMaxPoints(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="interactive-auto-count" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Auto-add random MCQs from bank (0-50)
            </label>
            <input
              id="interactive-auto-count"
              type="number"
              min={0}
              max={50}
              className="h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              value={autoQuestionCount}
              onChange={(event) => setAutoQuestionCount(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={randomizeQuestions}
              onChange={(event) => setRandomizeQuestions(event.target.checked)}
            />
            Randomize question order
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={randomizeOptions}
              onChange={(event) => setRandomizeOptions(event.target.checked)}
            />
            Randomize option order
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-border/80 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            onClick={() => {
              if (!loading) {
                reset();
                onClose();
              }
            }}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-orange-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading || !title.trim()}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {loading ? 'Creating...' : 'Create Interactive Quiz'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function InteractiveQuizPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const teacherAccessQuery = isTeacher && user?.id
    ? `?role=teacher&userId=${encodeURIComponent(user.id)}`
    : '';

  useEffect(() => {
    if (!user?.role || !user?.id) {
      setLoading(false);
      return;
    }

    const userRole = user.role;
    const userId = user.id;

    const controller = new AbortController();

    const loadTests = async () => {
      try {
        setLoading(true);
        const query = new URLSearchParams();
        query.set('role', userRole);
        query.set('userId', userId);
        const response = await fetch(`/api/tests?${query.toString()}`, { signal: controller.signal });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Unable to load tests.');
          setTests([]);
          return;
        }

        setTests(Array.isArray(data.tests) ? data.tests : []);
        setError(null);
      } catch (requestError) {
        if ((requestError as Error).name !== 'AbortError') {
          setError('Unable to load tests.');
        }
      } finally {
        setLoading(false);
      }
    };

    void loadTests();

    return () => controller.abort();
  }, [user?.id, user?.role]);

  const interactiveTests = useMemo(
    () => tests
      .filter((test) => test.module_type === 'interactive_quiz')
      .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()),
    [tests],
  );

  const handlePublish = async (testId: string, alreadyPublished: boolean) => {
    if (!isTeacher || alreadyPublished) {
      return;
    }

    setPublishingId(testId);
    setError(null);

    try {
      const response = await fetch(`/api/tests/${testId}/publish${teacherAccessQuery}`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok || !data.test) {
        setError(data.error || 'Unable to publish interactive quiz.');
        return;
      }

      const publishedTest = data.test as Test;
      setTests((previous) => previous.map((test) => (test.id === testId ? publishedTest : test)));
    } catch {
      setError('Unable to publish interactive quiz.');
    } finally {
      setPublishingId(null);
    }
  };

  if (!user?.role) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/85 p-8 shadow-xl shadow-black/10">
          <h1 className="text-2xl font-bold tracking-tight">Interactive Quiz Module</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Select your role from the Test Module first, then return here to configure interactive quizzes.
          </p>
          <Link
            href="/tests"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
          >
            Open Test Module
          </Link>
        </div>
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/85 p-8 shadow-xl shadow-black/10">
          <h1 className="text-2xl font-bold tracking-tight">Interactive Quiz Module</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Student access remains unchanged. Join with test code from the regular Test Module and you will be routed automatically.
          </p>
          <Link
            href="/tests"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            Back to Tests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_45%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.1),transparent_40%)]" />

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/tests?chooser=1"
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Back to Module Selection
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/20 bg-orange-400/[0.07] px-3 py-1 text-xs font-semibold text-orange-200">
            <Sparkles size={11} />
            Interactive Quiz Module
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Wayground-Style Interactive Quizzes</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Instant right/wrong feedback, speed-based points, and live leaderboard-ready scoring.
          </p>
        </div>

        <button
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-orange-500/25 transition hover:brightness-110"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={16} />
          Create Interactive Quiz
        </button>
      </div>

      <CreateInteractiveQuizModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={(test) => setTests((previous) => [test, ...previous])}
        createdBy={user.id}
        teacherAccessQuery={teacherAccessQuery}
      />

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Loading interactive quizzes...
          </div>
        </div>
      )}

      {!loading && interactiveTests.length === 0 && (
        <div className="rounded-2xl border border-border/70 bg-card/80 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/60 text-muted-foreground">
            <Trophy size={20} />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">No interactive quizzes yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Create your first interactive quiz with MCQ-only speed scoring and leaderboard support.
          </p>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-orange-500/25 transition hover:brightness-110"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Create Interactive Quiz
          </button>
        </div>
      )}

      {!loading && interactiveTests.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/85 shadow-xl shadow-black/10">
          <div className="hidden grid-cols-[minmax(220px,1.5fr)_120px_180px_220px_250px] gap-3 border-b border-border/70 bg-background/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <span>Interactive Quiz</span>
            <span>Status</span>
            <span>Timing</span>
            <span>Points & Difficulty</span>
            <span>Actions</span>
          </div>

          {interactiveTests.map((test) => {
            const settings = test.interactive_settings ?? DEFAULT_SETTINGS;
            const isPublished = test.status.toLowerCase() === 'published';
            const isPublishing = publishingId === test.id;

            return (
              <div
                key={test.id}
                className="border-t border-border/60 px-4 py-4 transition-colors first:border-t-0 hover:bg-muted/20"
              >
                <div className="grid gap-3 md:grid-cols-[minmax(220px,1.5fr)_120px_180px_220px_250px] md:items-center">
                  <div>
                    <Link
                      href={`/tests/${test.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-primary"
                    >
                      {test.title}
                    </Link>
                    {isPublished && test.test_code && (
                      <p className="mt-1 text-[11px] font-semibold tracking-[0.08em] text-amber-200">Code: {test.test_code}</p>
                    )}
                  </div>

                  <div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(test.status)}`}>
                      {formatStatus(test.status)}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <p className="inline-flex items-center gap-1.5">
                      <Timer size={12} />
                      {settings.question_timer_seconds}s per question
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5">
                      <Clock3 size={12} />
                      Updated {new Date(test.updated_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <p className="inline-flex items-center gap-1.5">
                      <Trophy size={12} />
                      {settings.max_points_per_question} max points / correct
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5">
                      <Sparkles size={12} />
                      Difficulty: {settings.difficulty_profile}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/tests/${test.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                    >
                      Manage Questions
                    </Link>
                    <Link
                      href={`/interactive-quiz/${test.id}/attempt`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-orange-400/30 bg-orange-500/10 px-2.5 py-1.5 text-xs font-semibold text-orange-100 transition hover:bg-orange-500/20"
                    >
                      Preview Quiz
                    </Link>
                    <button
                      onClick={() => handlePublish(test.id, isPublished)}
                      disabled={isPublished || isPublishing}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/12 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPublishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      {isPublished ? 'Published' : isPublishing ? 'Publishing...' : 'Publish'}
                    </button>
                    <Link
                      href={`/interactive-quiz/${test.id}/leaderboard`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                    >
                      <CheckCircle2 size={13} />
                      Leaderboard
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border/70 bg-card/80 p-4 text-xs text-muted-foreground">
        <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <AlertTriangle size={13} className="text-orange-200" />
          Quiz Rules Applied
        </p>
        <p className="mt-1">
          Interactive quizzes are MCQ-only, grant zero points for wrong answers, and award dynamic points based on speed and correctness.
        </p>
      </div>
    </div>
  );
}
