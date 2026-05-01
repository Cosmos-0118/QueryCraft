"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTestAuth as useAuth } from '@/hooks/use-test-auth';
import {
  ArrowLeft,
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
  const router = useRouter();
  const { user, hydrated, isAuthenticated } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/tests/login');
      return;
    }
    if (isAdmin) {
      router.replace('/admin');
    }
  }, [hydrated, isAuthenticated, isAdmin, router]);

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

  const interactiveStats = useMemo(() => {
    const published = interactiveTests.filter((test) => test.status.toLowerCase() === 'published').length;
    const latestUpdatedAt = interactiveTests.length > 0
      ? interactiveTests
          .map((test) => new Date(test.updated_at).getTime())
          .filter((value) => !Number.isNaN(value))
          .sort((left, right) => right - left)[0]
      : null;

    return {
      total: interactiveTests.length,
      published,
      drafts: interactiveTests.length - published,
      latestUpdatedAt,
    };
  }, [interactiveTests]);

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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_40%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_40%)]" />

      <div className="mb-6 overflow-hidden rounded-[2rem] border border-orange-300/10 bg-card/85 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/tests?chooser=1"
              className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              <ArrowLeft size={13} />
              Back to Module Selection
            </Link>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Interactive Quizzes</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Create timed MCQ rounds with speed-based scoring, clear publishing, and leaderboard-ready results.
            </p>
          </div>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-orange-400 px-5 text-sm font-semibold text-zinc-950 shadow-lg shadow-orange-500/25 transition hover:brightness-110"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Create Quiz
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-card/75 p-4 shadow-lg shadow-black/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Quizzes</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{interactiveStats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] p-4 shadow-lg shadow-black/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">Published</p>
          <p className="mt-2 text-2xl font-bold text-emerald-200">{interactiveStats.published}</p>
        </div>
        <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.06] p-4 shadow-lg shadow-black/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300/80">Drafts</p>
          <p className="mt-2 text-2xl font-bold text-amber-200">{interactiveStats.drafts}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card/75 p-4 shadow-lg shadow-black/10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Recent Activity</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 size={12} />
            {interactiveStats.latestUpdatedAt
              ? `Last update ${new Date(interactiveStats.latestUpdatedAt).toLocaleString()}`
              : 'No quizzes yet'}
          </p>
        </div>
      </div>

      <CreateInteractiveQuizModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={(test) => {
          setTests((previous) => [test, ...previous]);
          router.push(`/tests/${test.id}`);
        }}
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
        <div className="rounded-[1.75rem] border border-white/10 bg-card/85 p-10 text-center shadow-2xl shadow-black/20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-orange-200">
            <Trophy size={20} />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">No interactive quizzes yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
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
        <div className="grid gap-3">
          {interactiveTests.map((test) => {
            const settings = test.interactive_settings ?? DEFAULT_SETTINGS;
            const isPublished = test.status.toLowerCase() === 'published';
            const isPublishing = publishingId === test.id;

            return (
              <article
                key={test.id}
                className="group rounded-[1.5rem] border border-white/10 bg-card/85 p-4 shadow-xl shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:border-orange-300/25 hover:bg-card sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/tests/${test.id}`}
                        className="truncate text-base font-semibold text-foreground transition group-hover:text-orange-200"
                    >
                      {test.title}
                    </Link>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${getStatusClasses(test.status)}`}>
                        {formatStatus(test.status)}
                      </span>
                    </div>

                    {isPublished && test.test_code && (
                      <p className="mt-2 w-fit rounded-full border border-orange-300/20 bg-orange-400/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-orange-200">
                        Code: {test.test_code}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-1">
                        <Timer size={12} />
                        {settings.question_timer_seconds}s/question
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-1">
                        <Trophy size={12} />
                        {settings.max_points_per_question} pts
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-1">
                        <Sparkles size={12} />
                        {settings.difficulty_profile}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-1">
                        <Clock3 size={12} />
                        Updated {new Date(test.updated_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/tests/${test.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3 text-xs font-semibold text-muted-foreground transition hover:border-border hover:text-foreground"
                    >
                      Manage
                    </Link>
                    <button
                      onClick={() => handlePublish(test.id, isPublished)}
                      disabled={isPublished || isPublishing}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/12 px-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPublishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      {isPublished ? 'Published' : isPublishing ? 'Publishing...' : 'Publish'}
                    </button>
                    {isPublished && (
                      <Link
                        href={`/interactive-quiz/${test.id}/leaderboard`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                      >
                        Leaderboard
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
