"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTestAuth } from '@/hooks/use-test-auth';
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Clock3,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Send,
  Sparkles,
} from 'lucide-react';

interface Test {
  id: string;
  title: string;
  status: string;
  created_by: string;
  updated_at: string;
  test_code?: string | null;
  module_type?: 'classic' | 'interactive_quiz';
}

interface StudentSubmittedAttemptSummary {
  test_id: string;
  attempt_id: string;
  submitted_at: string | null;
  updated_at: string;
  score: number | null;
}

interface StudentPastTest {
  testId: string;
  attemptId: string;
  title: string;
  moduleType: 'classic' | 'interactive_quiz';
  submittedAt: string;
  score: number | null;
}

function getAttemptPath(test: Test) {
  if (test.module_type === 'interactive_quiz') {
    return `/interactive-quiz/${test.id}/attempt`;
  }

  return `/tests/${test.id}/attempt`;
}

function formatModuleTypeLabel(moduleType: 'classic' | 'interactive_quiz') {
  return moduleType === 'interactive_quiz' ? 'Interactive Quiz' : 'Normal Test';
}

function formatSubmissionDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently submitted';
  }
  return date.toLocaleString();
}

function getScoreBadgeClasses(score: number | null) {
  if (typeof score !== 'number') {
    return 'border-border/70 bg-background/70 text-muted-foreground';
  }

  if (score >= 75) {
    return 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300';
  }

  if (score >= 50) {
    return 'border-amber-500/35 bg-amber-500/12 text-amber-300';
  }

  return 'border-red-500/35 bg-red-500/12 text-red-300';
}

function getPastTestResultPath(row: StudentPastTest) {
  if (row.moduleType === 'interactive_quiz') {
    return `/interactive-quiz/${row.testId}/leaderboard?attemptId=${encodeURIComponent(row.attemptId)}`;
  }

  return `/tests/${row.testId}/result?attemptId=${encodeURIComponent(row.attemptId)}`;
}

function buildStudentPastTests(
  tests: Test[],
  submittedAttempts: StudentSubmittedAttemptSummary[],
): StudentPastTest[] {
  const testById = new Map(tests.map((test) => [test.id, test]));

  return submittedAttempts
    .map((attempt) => {
      const test = testById.get(attempt.test_id);
      if (!test) {
        return null;
      }

      return {
        testId: test.id,
        attemptId: attempt.attempt_id,
        title: test.title,
        moduleType: test.module_type ?? 'classic',
        submittedAt: attempt.submitted_at ?? attempt.updated_at ?? test.updated_at,
        score: attempt.score,
      } satisfies StudentPastTest;
    })
    .filter((row): row is StudentPastTest => row !== null)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case 'published':
      return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-300';
    case 'draft':
      return 'border-border bg-muted/80 text-foreground/80 dark:border-zinc-600 dark:bg-muted/70 dark:text-foreground/90';
    default:
      return 'border-border/70 bg-muted/40 text-muted-foreground';
  }
}

function EditTestModal({
  open,
  onClose,
  test,
  onSave,
  updateQuery,
}: {
  open: boolean;
  onClose: () => void;
  test: Test | null;
  onSave: (test: Test) => void;
  updateQuery: string;
}) {
  const [title, setTitle] = useState(test?.title || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(test?.title || '');
  }, [test]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!test) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/tests/${test.id}${updateQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.test) {
        onSave(data.test);
        onClose();
      } else {
        setError(data.error || 'Failed to update test');
      }
    } catch {
      setError('Failed to update test');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !test) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border/70 bg-card/95 p-6 shadow-2xl shadow-black/40"
      >
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold tracking-tight">Rename Test</h2>
          <p className="text-sm text-muted-foreground">Update the test title before publishing.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-test-title" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Title
          </label>
          <input
            id="edit-test-title"
            className="h-12 w-full rounded-xl border border-border bg-background/90 px-4 text-base outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            placeholder="Database Midterm - Batch A"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            className="rounded-xl border border-border/80 bg-background/70 px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading || !title.trim()}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateTestModal({
  open,
  onClose,
  onCreate,
  createdBy,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (test: Test) => void;
  createdBy: string;
}) {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          created_by: createdBy,
          question_mode: 'mcq_only',
          duration_minutes: 30,
          anti_cheat_policy: {},
          mix_mcq_percent: null,
          mix_sql_fill_percent: null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.test) {
        onCreate(data.test);
        setTitle('');
        onClose();
      } else {
        setError(data.error || 'Failed to create test');
      }
    } catch {
      setError('Failed to create test');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border/70 bg-card/95 p-6 shadow-2xl shadow-black/40"
      >
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold tracking-tight">Create New Test</h2>
          <p className="text-sm text-muted-foreground">Start with a title. You can add questions in the detail page.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="new-test-title" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Title
          </label>
          <input
            id="new-test-title"
            className="h-12 w-full rounded-xl border border-border bg-background/90 px-4 text-base outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            placeholder="Final Exam - Database Systems"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            className="rounded-xl border border-border/80 bg-background/70 px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading || !title.trim()}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Creating...' : 'Create Test'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  icon,
  actionLabel,
  accentClass,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  actionLabel: string;
  accentClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left shadow-2xl shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-primary/35 hover:bg-white/[0.07]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
      </div>
      <div className={`relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${accentClass}`}>
        {icon}
      </div>
      <h2 className="relative mt-5 text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <span className="relative mt-6 inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition group-hover:border-primary/30 group-hover:text-foreground">
        {actionLabel}
      </span>
    </button>
  );
}

export default function TestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedCodeForTest, setCopiedCodeForTest] = useState<string | null>(null);
  const [studentPastTests, setStudentPastTests] = useState<StudentPastTest[]>([]);
  const [pastTestsLoading, setPastTestsLoading] = useState(false);
  const [pastTestsError, setPastTestsError] = useState<string | null>(null);
  const [pastTestsSettled, setPastTestsSettled] = useState(false);
  const [showTeacherModuleChooser, setShowTeacherModuleChooser] = useState(false);
  const [hydrationTimeoutReached, setHydrationTimeoutReached] = useState(false);

  const { user, hydrated, isAuthenticated, logout } = useTestAuth();
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const submissionNoticeVisible = searchParams?.get('submitted') === '1';
  const teacherAccessQuery = isTeacher && user?.id
    ? `?role=teacher&userId=${encodeURIComponent(user.id)}`
    : '';
  const showPastTestsLoading = loading || pastTestsLoading;

  const handleSignOut = () => {
    setJoinError(null);
    setError(null);
    setShowTeacherModuleChooser(false);
    logout();
  };

  const handleBackFromWorkspace = () => {
    setJoinError(null);
    setError(null);

    if (isTeacher) {
      setShowTeacherModuleChooser(true);
      return;
    }

    logout();
  };

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace('/tests/login');
      return;
    }
    if (user.role === 'admin') {
      router.replace('/admin');
    }
  }, [hydrated, isAuthenticated, router, user]);

  useEffect(() => {
    if (!hydrated || isAuthenticated || typeof window === 'undefined') {
      return;
    }

    const fallbackRedirectId = window.setTimeout(() => {
      window.location.replace('/tests/login');
    }, 900);

    return () => {
      window.clearTimeout(fallbackRedirectId);
    };
  }, [hydrated, isAuthenticated]);

  useEffect(() => {
    if (hydrated || typeof window === 'undefined') {
      setHydrationTimeoutReached(false);
      return;
    }

    const id = window.setTimeout(() => {
      setHydrationTimeoutReached(true);
    }, 9000);

    return () => {
      window.clearTimeout(id);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!isTeacher) return;
    if (searchParams?.get('chooser') === '1') {
      setShowTeacherModuleChooser(true);
    }
  }, [isTeacher, searchParams]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) {
      setTests([]);
      setStudentPastTests([]);
      setPastTestsError(null);
      setPastTestsLoading(false);
      setPastTestsSettled(false);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadTests = async () => {
      try {
        setLoading(true);
        if (user.role === 'student') {
          setPastTestsLoading(true);
          setPastTestsSettled(false);
          setPastTestsError(null);
        }

        const query = new URLSearchParams();
        if (user?.role) query.set('role', user.role);
        if (user?.id) query.set('userId', user.id);

        const res = await fetch(`/api/tests?${query.toString()}`, { signal: controller.signal });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setTests([]);
            setError('Your test session expired. Redirecting to sign in...');
            router.replace('/tests/login');
            return;
          }
          throw new Error('Failed to load tests');
        }

        const data = await res.json() as {
          tests?: Test[];
          student_submitted_attempts?: StudentSubmittedAttemptSummary[];
        };

        const loadedTests = Array.isArray(data.tests) ? data.tests : [];
        setTests(loadedTests);

        if (user.role === 'student') {
          const submittedAttempts = Array.isArray(data.student_submitted_attempts)
            ? data.student_submitted_attempts
            : [];
          setStudentPastTests(buildStudentPastTests(loadedTests, submittedAttempts));
          setPastTestsError(null);
        } else {
          setStudentPastTests([]);
          setPastTestsError(null);
        }

        setError(null);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Failed to load tests');
          if (user.role === 'student') {
            setStudentPastTests([]);
            setPastTestsError('Failed to load submitted tests.');
          }
        }
      } finally {
        setLoading(false);
        if (user.role === 'student') {
          setPastTestsLoading(false);
          setPastTestsSettled(true);
        }
      }
    };

    loadTests();

    return () => controller.abort();
  }, [hydrated, isAuthenticated, router, user]);

  const sortedTests = useMemo(
    () => {
      const latestById = new Map<string, Test>();

      for (const test of tests) {
        const existing = latestById.get(test.id);
        if (!existing || new Date(test.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
          latestById.set(test.id, test);
        }
      }

      return [...latestById.values()].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    },
    [tests],
  );

  const teacherVisibleTests = useMemo(
    () => {
      // Faculty-side: keep the normal Test Module list strictly classic; interactive
      // quizzes have their own list in the Interactive Quiz Module.
      return sortedTests.filter(
        (test) => (test.module_type ?? 'classic') === 'classic',
      );
    },
    [sortedTests],
  );

  const teacherStats = useMemo(() => {
    const published = teacherVisibleTests.filter((test) => test.status.toLowerCase() === 'published').length;
    const drafts = teacherVisibleTests.length - published;
    const latestUpdatedAt = teacherVisibleTests.length > 0
      ? teacherVisibleTests
          .map((test) => new Date(test.updated_at).getTime())
          .filter((value) => !Number.isNaN(value))
          .sort((a, b) => b - a)[0]
      : null;
    return {
      total: teacherVisibleTests.length,
      published,
      drafts,
      latestUpdatedAt,
    };
  }, [teacherVisibleTests]);

  const handleCreate = (test: Test) => {
    setTests((prev) => [test, ...prev]);
    router.push(`/tests/${test.id}`);
  };

  const handleEdit = (test: Test) => {
    if (!isTeacher) return;
    setEditingTest(test);
    setShowEdit(true);
  };

  const handleSave = (updated: Test) => {
    setTests((prev) => prev.map((test) => (test.id === updated.id ? updated : test)));
  };

  const handlePublish = async (test: Test) => {
    if (!isTeacher || test.status.toLowerCase() === 'published') return;
    if (!window.confirm('Publish this test? This action cannot be undone.')) return;

    setPublishingId(test.id);
    setError(null);

    try {
      const res = await fetch(`/api/tests/${test.id}/publish${teacherAccessQuery}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.test) {
        setTests((prev) => prev.map((item) => (item.id === test.id ? data.test : item)));
      } else {
        setError(data.error || 'Failed to publish test');
      }
    } catch {
      setError('Failed to publish test');
    } finally {
      setPublishingId(null);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStudent || !user || !joinCode.trim()) return;

    setJoinLoading(true);
    setJoinError(null);

    try {
      const res = await fetch('/api/tests/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: joinCode.trim(),
          student_id: user.id,
          student_name: user.displayName,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.test) {
        setJoinError(data.error || 'Unable to join test with this code.');
        return;
      }

      setJoinCode('');
      const joinPath = getAttemptPath(data.test as Test);
      router.push(joinPath);
    } catch {
      setJoinError('Unable to join test with this code.');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCopyTestCode = async (testId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeForTest(testId);
      window.setTimeout(() => {
        setCopiedCodeForTest((current) => (current === testId ? null : current));
      }, 1300);
    } catch {
      setError('Could not copy test code. Please copy manually.');
    }
  };

  if (!hydrated) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Checking your session...
          </div>
          {hydrationTimeoutReached && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">Session check is taking longer than expected.</p>
              <Link
                href="/tests/login"
                className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-border"
              >
                Continue to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Redirecting to test sign in...
          </div>
          <Link
            href="/tests/login"
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/80 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-border"
          >
            Continue to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (isTeacher && showTeacherModuleChooser) {
    return (
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col items-center justify-center px-5 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.16),transparent_38%),radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.12),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.15),transparent)]" />
        <div className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-card/80 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="mb-8 flex justify-center">
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              <ArrowLeft size={13} />
              Sign out
            </button>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.09] px-3.5 py-1.5 text-xs font-semibold text-primary">
              <Sparkles size={11} />
              Teacher Module Selection
            </div>
            <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Choose the assessment workspace</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Start with classic tests for scheduled assessments, or use interactive quizzes for fast leaderboard-style practice.
            </p>
          </div>

          <div className="mx-auto mt-9 grid max-w-3xl gap-4 sm:grid-cols-2">
            <ChoiceCard
              title="Normal Test"
              description="Build structured assessments, publish a code, and review student submissions."
              icon={<ClipboardList size={17} className="text-teal-200" />}
              actionLabel="Open tests"
              accentClass="border-teal-400/30 bg-teal-500/10"
              onClick={() => setShowTeacherModuleChooser(false)}
            />
            <ChoiceCard
              title="Interactive Quiz"
              description="Create timed MCQ rounds with instant scoring and leaderboard-ready results."
              icon={<Sparkles size={17} className="text-orange-200" />}
              actionLabel="Open quizzes"
              accentClass="border-orange-400/30 bg-orange-500/10"
              onClick={() => {
                setShowTeacherModuleChooser(false);
                router.push('/interactive-quiz');
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.14),transparent_40%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.1),transparent_42%)]" />

      <div className="mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-card/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button
            onClick={handleBackFromWorkspace}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-300/60 bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
          >
            <ArrowLeft size={13} />
            {isTeacher ? 'Back to Test Type' : 'Back'}
          </button>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {isTeacher ? 'Normal Test Workspace' : 'Your Test Dashboard'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {isTeacher
                ? 'Create reliable assessments, publish secure codes, and review submissions without clutter.'
                : 'Join new tests with a code and review your submitted attempts in one clean place.'}
          </p>
        </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {isTeacher && (
            <button
                className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 px-5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} />
              Create Test
            </button>
          )}
            {isStudent && (
              <div className="rounded-2xl border border-border/70 bg-background/55 px-4 py-3 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Submitted Attempts</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{studentPastTests.length}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isTeacher && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-card/75 p-4 shadow-lg shadow-black/10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{teacherStats.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] p-4 shadow-lg shadow-black/10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">Published</p>
            <p className="mt-2 text-2xl font-bold text-emerald-200">{teacherStats.published}</p>
          </div>
          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.06] p-4 shadow-lg shadow-black/10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300/80">Drafts</p>
            <p className="mt-2 text-2xl font-bold text-amber-200">{teacherStats.drafts}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card/75 p-4 shadow-lg shadow-black/10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Recent Activity</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 size={12} />
            {teacherStats.latestUpdatedAt
              ? `Last update ${new Date(teacherStats.latestUpdatedAt).toLocaleString()}`
              : 'No tests yet'}
            </p>
          </div>
        </div>
      )}

      {isStudent && (
        <div className="mb-6 flex flex-col gap-4">
          <form
            onSubmit={handleJoinByCode}
            className="relative w-full overflow-hidden rounded-[1.75rem] border border-teal-400/15 bg-card/85 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-teal-400/10 blur-3xl" />
            <div className="relative mb-5 flex items-start gap-3">
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-teal-400/25 bg-teal-500/10 text-teal-200">
                <KeyRound size={16} />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Join a test</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Enter the access code shared by your teacher. We will open the right test flow automatically.</p>
              </div>
            </div>

            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="QC-START1"
                className="h-12 w-full flex-1 rounded-2xl border border-border bg-background/90 px-4 text-sm font-semibold uppercase tracking-[0.16em] outline-none transition focus:border-teal-300/60 focus:ring-2 focus:ring-teal-300/20"
                maxLength={16}
              />
              <button
                type="submit"
                disabled={joinLoading || !joinCode.trim()}
                className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 px-6 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[11rem]"
              >
                {joinLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {joinLoading ? 'Joining...' : 'Join Test'}
              </button>
            </div>

            {joinError && (
              <p className="mt-2 text-sm text-red-300">{joinError}</p>
            )}
          </form>

          <section className="w-full rounded-[1.75rem] border border-white/10 bg-card/85 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Submitted tests</h2>
                <p className="mt-1 text-sm text-muted-foreground">Your latest results and review pages.</p>
              </div>
              <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                {studentPastTests.length}
              </span>
            </div>

            {submissionNoticeVisible && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                Test submitted successfully. Your latest attempt appears below.
              </div>
            )}

            {showPastTestsLoading && (
              <div className="space-y-3">
                {[0, 1, 2].map((idx) => (
                  <div
                    key={idx}
                    className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/40 p-4"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.06),transparent)] animate-[pulse_1.8s_ease-in-out_infinite]" />
                    <div className="relative">
                      <div className="h-3.5 w-1/2 rounded-md bg-muted/55" />
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-5 w-24 rounded-full bg-muted/45" />
                        <div className="h-5 w-40 rounded-full bg-muted/45" />
                        <div className="h-5 w-24 rounded-full bg-muted/45" />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <Loader2 size={13} className="animate-spin" />
                  Loading submitted attempts...
                </div>
              </div>
            )}

            {!showPastTestsLoading && pastTestsError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {pastTestsError}
              </div>
            )}

            {!showPastTestsLoading && pastTestsSettled && !pastTestsError && studentPastTests.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-6 text-center">
                <p className="text-sm font-medium text-foreground/90">No submitted tests yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Join a test using a code above and submit it to see history here.
                </p>
              </div>
            )}

            {!showPastTestsLoading && pastTestsSettled && !pastTestsError && studentPastTests.length > 0 && (
              <div className="space-y-2.5">
                {studentPastTests.map((row) => (
                  <article
                    key={`${row.testId}_${row.attemptId}`}
                    className="group rounded-2xl border border-border/70 bg-background/55 px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background/75"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{row.title}</p>
                          <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            {formatModuleTypeLabel(row.moduleType)}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/65 px-2 py-1">
                            <Clock3 size={12} />
                            Submitted {formatSubmissionDateTime(row.submittedAt)}
                          </span>
                          <span className={`inline-flex items-center rounded-md border px-2 py-1 font-semibold ${getScoreBadgeClasses(row.score)}`}>
                            {typeof row.score === 'number'
                              ? row.moduleType === 'interactive_quiz'
                                ? `Score ${Math.round(row.score)}`
                                : `Score ${Math.round(row.score)}%`
                              : 'Score Pending'}
                          </span>
                        </div>
                      </div>

                      <Link
                        href={getPastTestResultPath(row)}
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-full border border-border/80 bg-background/70 px-3 text-xs font-semibold text-muted-foreground transition group-hover:border-primary/40 group-hover:text-foreground"
                      >
                        <Eye size={13} />
                        View Details
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <CreateTestModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
        createdBy={user?.id ?? '999f68ef-cd80-4a7a-b02e-75f33c56a77f'}
      />
      <EditTestModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        test={editingTest}
        onSave={handleSave}
        updateQuery={teacherAccessQuery}
      />

      {loading && (
        <div className="rounded-2xl border border-border/90 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Loading tests...
          </div>
          <div className="mt-4 grid gap-3">
            <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
            <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
            <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load tests</p>
              <p className="mt-1 text-sm text-red-300/90">{error}</p>
            </div>
          </div>
        </div>
      )}

      {isTeacher && !loading && !error && teacherVisibleTests.length === 0 && (
        <div className="rounded-[1.75rem] border border-white/10 bg-card/85 p-10 text-center shadow-2xl shadow-black/20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-400/20 bg-teal-500/10 text-teal-200">
            <ClipboardList size={20} />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">No tests yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {isTeacher
              ? 'Create your first test to start assigning assessments to students.'
              : 'No published tests are available right now. Ask your teacher to publish one.'}
          </p>
          {isTeacher && (
            <button
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} />
              Create First Test
            </button>
          )}
        </div>
      )}

      {isTeacher && !loading && !error && teacherVisibleTests.length > 0 && (
        <div className="space-y-3">
          {teacherVisibleTests.map((test) => {
            const isPublished = test.status.toLowerCase() === 'published';
            const isPublishing = publishingId === test.id;

            return (
              <article
                key={test.id}
                className="group rounded-[1.5rem] border border-white/10 bg-card/85 p-4 shadow-xl shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/tests/${test.id}`}
                        className="truncate text-base font-semibold tracking-tight text-foreground transition group-hover:text-primary"
                      >
                        {test.title}
                      </Link>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${getStatusClasses(test.status)}`}>
                        {formatStatus(test.status)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                      {isPublished && test.test_code && (
                        <button
                          type="button"
                          onClick={() => handleCopyTestCode(test.id, test.test_code!)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-semibold tracking-[0.08em] text-primary transition hover:border-primary/45 hover:bg-primary/15"
                          title="Click to copy test code"
                        >
                          <Copy size={11} />
                          {copiedCodeForTest === test.id ? 'Copied' : `Code: ${test.test_code}`}
                        </button>
                      )}
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
                      <Eye size={13} />
                      Open
                    </Link>

                    <button
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3 text-xs font-semibold text-muted-foreground transition hover:border-cyan-300/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => handleEdit(test)}
                      disabled={isPublished}
                    >
                      <Pencil size={13} />
                      Rename
                    </button>

                    {isPublished && (
                      <Link
                        href={`/tests/${test.id}/review`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3 text-xs font-semibold text-muted-foreground transition hover:border-violet-300/50 hover:text-foreground"
                      >
                        <ClipboardList size={13} />
                        Submissions
                      </Link>
                    )}

                    <button
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/40 bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:border-primary/60 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handlePublish(test)}
                      disabled={isPublished || isPublishing}
                    >
                      {isPublishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      {isPublished ? 'Published' : isPublishing ? 'Publishing...' : 'Publish'}
                    </button>
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
