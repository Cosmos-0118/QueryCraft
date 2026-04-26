"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTestAuth } from '@/hooks/use-test-auth';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Users,
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

function getAttemptPath(test: Test) {
  if (test.module_type === 'interactive_quiz') {
    return `/interactive-quiz/${test.id}/attempt`;
  }

  return `/tests/${test.id}/attempt`;
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case 'published':
      return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-300';
    case 'draft':
      return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-200';
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
        className="w-full max-w-md rounded-2xl border border-border/70 bg-card/95 p-6 shadow-2xl shadow-black/40"
      >
        <h2 className="text-lg font-bold tracking-tight">Rename Test</h2>
        <p className="mt-1 text-sm text-muted-foreground">Update the test title before publishing.</p>

        <div className="mt-5 space-y-2">
          <label htmlFor="edit-test-title" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Title
          </label>
          <input
            id="edit-test-title"
            className="h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            placeholder="Database Midterm - Batch A"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            autoFocus
          />
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
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
        className="w-full max-w-md rounded-2xl border border-border/70 bg-card/95 p-6 shadow-2xl shadow-black/40"
      >
        <h2 className="text-lg font-bold tracking-tight">Create New Test</h2>
        <p className="mt-1 text-sm text-muted-foreground">Start with a title. You can add questions in the detail page.</p>

        <div className="mt-5 space-y-2">
          <label htmlFor="new-test-title" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Title
          </label>
          <input
            id="new-test-title"
            className="h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            placeholder="Final Exam - Database Systems"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            autoFocus
          />
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
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="rounded-2xl border border-border/90 bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 inline-flex rounded-lg border border-border/85 bg-background/60 p-2 text-muted-foreground">
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
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
      className="group rounded-2xl border border-border/70 bg-card/85 p-5 text-left shadow-xl shadow-black/10 transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card"
    >
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${accentClass}`}>
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      <span className="mt-4 inline-flex items-center rounded-lg border border-border/70 bg-background/60 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition group-hover:border-primary/30 group-hover:text-foreground">
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
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showTeacherModuleChooser, setShowTeacherModuleChooser] = useState(false);

  const { user, hydrated, isAuthenticated, logout } = useTestAuth();
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';
  const teacherAccessQuery = isTeacher && user?.id
    ? `?role=teacher&userId=${encodeURIComponent(user.id)}`
    : '';

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
    if (!isAuthenticated) {
      router.replace('/tests/login');
      return;
    }
    if (isAdmin) {
      router.replace('/admin');
    }
  }, [hydrated, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (!isTeacher) return;
    if (searchParams?.get('chooser') === '1') {
      setShowTeacherModuleChooser(true);
    }
  }, [isTeacher, searchParams]);

  useEffect(() => {
    const controller = new AbortController();

    const loadTests = async () => {
      try {
        setLoading(true);
        const query = new URLSearchParams();
        if (user?.role) query.set('role', user.role);
        if (user?.id) query.set('userId', user.id);

        const res = await fetch(`/api/tests?${query.toString()}`, { signal: controller.signal });
        const data = await res.json();
        setTests(data.tests || []);
        setError(null);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Failed to load tests');
        }
      } finally {
        setLoading(false);
      }
    };

    loadTests();

    return () => controller.abort();
  }, [user?.id, user?.role]);

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

  const visibleTests = useMemo(
    () => {
      // Faculty-side: keep the normal Test Module list strictly classic; interactive
      // quizzes have their own list in the Interactive Quiz Module.
      const classicOnly = sortedTests.filter(
        (test) => (test.module_type ?? 'classic') === 'classic',
      );
      return isTeacher
        ? classicOnly
        : classicOnly.filter((test) => test.status.toLowerCase() === 'published');
    },
    [isTeacher, sortedTests],
  );

  const stats = useMemo(() => {
    const published = visibleTests.filter((test) => test.status.toLowerCase() === 'published').length;
    const drafts = visibleTests.length - published;
    return {
      total: visibleTests.length,
      published,
      drafts,
      roleLabel: isTeacher ? 'Teacher Workspace' : 'Student Workspace',
    };
  }, [visibleTests, isTeacher]);

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

  if (!hydrated || !isAuthenticated || !user) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Checking your session...
          </div>
        </div>
      </div>
    );
  }

  if (isTeacher && showTeacherModuleChooser) {
    return (
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_45%)]" />
        <div className="rounded-2xl border border-border/70 bg-card/85 p-8 shadow-xl shadow-black/10">
          <button
            onClick={handleSignOut}
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Sign out
          </button>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles size={11} />
            Teacher Module Selection
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Choose Your Teaching Module</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Select the module type you want to work with right now.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              title="Normal Test"
              description="Use the classic test workflow with draft/publish and test-code-based attempts."
              icon={<ClipboardList size={17} className="text-teal-200" />}
              actionLabel="Open"
              accentClass="border-teal-400/30 bg-teal-500/10"
              onClick={() => setShowTeacherModuleChooser(false)}
            />
            <ChoiceCard
              title="Interactive Quiz"
              description="Create speed-based MCQ quizzes with per-question timer and leaderboard scoring."
              icon={<Sparkles size={17} className="text-orange-200" />}
              actionLabel="Open"
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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_45%)]" />

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            onClick={handleBackFromWorkspace}
            className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-300/60 bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
          >
            <ArrowLeft size={13} />
            {isTeacher ? 'Back to Test Type' : 'Back'}
          </button>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Test Module - Assessment Studio</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Create, manage, publish, and review assessments in one smooth workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {isStudent && (
            <>
              <div className="rounded-xl border border-border/80 bg-card/80 px-3 py-2 text-right shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total Tests</p>
                <p className="text-sm font-semibold text-foreground">{stats.total}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-card/80 px-3 py-2 text-right shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Role</p>
                <p className="text-sm font-semibold text-foreground">Student</p>
              </div>
            </>
          )}
          {isTeacher && (
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} />
              Create Test
            </button>
          )}
        </div>
      </div>

      {isTeacher && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Tests"
            value={String(stats.total)}
            description="All assessments in this workspace"
            icon={<ClipboardList size={16} />}
          />
          <StatCard
            title="Draft"
            value={String(stats.drafts)}
            description="Still editable and not visible"
            icon={<Pencil size={16} />}
          />
          <StatCard
            title="Published"
            value={String(stats.published)}
            description="Ready for student access"
            icon={<CheckCircle2 size={16} />}
          />
          <StatCard
            title="Role"
            value="Teacher"
            description="You can create and publish tests"
            icon={<Users size={16} />}
          />
        </div>
      )}

      {isStudent && (
        <form
          onSubmit={handleJoinByCode}
          className="mb-6 rounded-2xl border border-border/90 bg-card/85 p-5 shadow-xl shadow-black/10"
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border/70 bg-background/60 p-2 text-muted-foreground">
              <KeyRound size={14} />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Enter Test Code</h2>
              <p className="text-xs text-muted-foreground">Use the code shared by your teacher to start the test.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="QC-START1"
              className="h-11 flex-1 rounded-xl border border-border bg-background/90 px-3.5 text-sm uppercase tracking-[0.12em] outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              maxLength={16}
            />
            <button
              type="submit"
              disabled={joinLoading || !joinCode.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joinLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {joinLoading ? 'Joining...' : 'Join Test'}
            </button>
          </div>

          {joinError && (
            <p className="mt-2 text-sm text-red-300">{joinError}</p>
          )}
        </form>
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

      {!loading && !error && visibleTests.length === 0 && (
        <div className="rounded-2xl border border-border/90 bg-card/80 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/85 bg-background/60 text-muted-foreground">
            <ClipboardList size={20} />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">No tests yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
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

      {!loading && !error && visibleTests.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border/90 bg-card/85 shadow-xl shadow-black/10">
          <div className="hidden grid-cols-[minmax(220px,1fr)_auto] gap-3 border-b border-border/85 bg-background/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <span>Test</span>
            <span>Actions</span>
          </div>

          {visibleTests.map((test) => {
            const isPublished = test.status.toLowerCase() === 'published';
            const isPublishing = publishingId === test.id;
            const isExpanded = expandedTestId === test.id;

            return (
              <div
                key={test.id}
                className="border-t border-border/80 px-4 py-4 transition-colors first:border-t-0 hover:bg-muted/20"
              >
                <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto] md:items-center">
                  <div className="flex min-w-0 items-start gap-2">
                    <button
                      onClick={() => setExpandedTestId(isExpanded ? null : test.id)}
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={isExpanded ? 'Collapse test details' : 'Expand test details'}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    <div className="min-w-0">
                      {isTeacher ? (
                        <Link
                          href={`/tests/${test.id}`}
                          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-primary"
                        >
                          {test.title}
                          <Eye size={14} className="opacity-0 transition group-hover:opacity-100" />
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-foreground">{test.title}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground md:hidden">
                        Updated {new Date(test.updated_at).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(test.status)}`}
                      >
                        {formatStatus(test.status)}
                      </span>
                      {isTeacher && isPublished && test.test_code && (
                        <p className="mt-1 text-[11px] font-semibold tracking-[0.08em] text-teal-700 dark:text-teal-300">
                          Code: {test.test_code}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-start">
                    {isTeacher ? (
                      <Link
                        href={`/tests/${test.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                      >
                        <Eye size={13} />
                        Open
                      </Link>
                    ) : (
                      <Link
                        href={user?.id
                          ? `/tests/${test.id}/result?studentId=${encodeURIComponent(user.id)}`
                          : `/tests/${test.id}/result`}
                        className="inline-flex items-center rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                      >
                        View Result
                      </Link>
                    )}

                    {isTeacher && (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 dark:border-border/80 dark:bg-background/70 dark:text-muted-foreground dark:hover:border-cyan-500/30 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleEdit(test)}
                        disabled={isPublished}
                      >
                        <Pencil size={13} />
                        Rename Test
                      </button>
                    )}

                    {isTeacher && isPublished && (
                      <Link
                        href={`/tests/${test.id}/review`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-border/80 dark:bg-background/70 dark:text-muted-foreground dark:hover:border-violet-500/30 dark:hover:bg-violet-500/10 dark:hover:text-violet-200"
                      >
                        <ClipboardList size={13} />
                        Review Submissions
                      </Link>
                    )}

                    {isTeacher && (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:border-primary/60 hover:brightness-110 dark:border-primary/30 dark:bg-primary/85 dark:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handlePublish(test)}
                        disabled={isPublished || isPublishing}
                      >
                        {isPublishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        {isPublished ? 'Published' : isPublishing ? 'Publishing...' : 'Publish'}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-3">
                    <div className="grid gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</p>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(test.status)}`}>
                          {formatStatus(test.status)}
                        </span>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Author</p>
                        <p className="break-all text-sm text-foreground/90">{test.created_by}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Updated</p>
                        <p className="inline-flex items-center gap-1.5 text-sm text-foreground/90">
                          <Clock3 size={13} className="text-muted-foreground" />
                          {new Date(test.updated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
