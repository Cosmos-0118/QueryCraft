"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Filter,
  Loader2,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';

interface Test {
  id: string;
  title: string;
  status: string;
  created_by: string;
  updated_at: string;
}

interface Assignment {
  id: string;
  user: string;
  role: 'student' | 'teacher';
}

interface ReviewAttempt {
  id: string;
  student_id: string;
  student_name: string;
  status: 'in_progress' | 'submitted';
  score: number | null;
  submitted_at: string | null;
  violation_count: number;
  published: boolean;
  answers: Array<{ question_id: string; answer: string }>;
  results: Array<{ question_id: string; answer: string }>;
}

interface Submission {
  id: string;
  attemptId: string | null;
  studentId: string | null;
  student: string;
  status: 'submitted' | 'pending';
  score: number | null;
  submittedAt: string | null;
  violations: number;
  published: boolean;
  answerCount: number;
}

type ReviewFilter = 'all' | 'submitted' | 'pending';

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function toSubmission(attempt: ReviewAttempt): Submission {
  const isSubmitted = attempt.status === 'submitted';
  const answerCount = isSubmitted
    ? attempt.results?.length ?? 0
    : attempt.answers?.length ?? 0;

  return {
    id: attempt.id,
    attemptId: attempt.id,
    studentId: attempt.student_id,
    student: attempt.student_name,
    status: isSubmitted ? 'submitted' : 'pending',
    score: isSubmitted ? attempt.score : null,
    submittedAt: isSubmitted ? attempt.submitted_at : null,
    violations: attempt.violation_count ?? 0,
    published: isSubmitted ? !!attempt.published : false,
    answerCount,
  };
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

export default function TestReviewPage() {
  const params = useParams();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const testId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const teacherAccessQuery = isTeacher && user?.id
    ? `?role=teacher&userId=${encodeURIComponent(user.id)}`
    : '';

  const [test, setTest] = useState<Test | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [publishingAll, setPublishingAll] = useState(false);

  useEffect(() => {
    if (!testId) return;

    const controller = new AbortController();

    const loadReviewContext = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!isTeacher || !user?.id) {
          const testRes = await fetch(`/api/tests/${testId}`, { signal: controller.signal });
          const testData = await testRes.json();

          if (!testRes.ok || !testData?.test) {
            setError(testData.error || 'Unable to load review board context.');
            return;
          }

          setTest(testData.test || null);
          setSubmissions([]);
          return;
        }

        const [testRes, assignmentsRes, reviewRes] = await Promise.all([
          fetch(`/api/tests/${testId}${teacherAccessQuery}`, { signal: controller.signal }),
          fetch(`/api/tests/${testId}/assignments${teacherAccessQuery}`, { signal: controller.signal }),
          fetch(`/api/tests/${testId}/review${teacherAccessQuery}`, { signal: controller.signal }),
        ]);

        const [testData, assignmentsData, reviewData] = await Promise.all([
          testRes.json(),
          assignmentsRes.json(),
          reviewRes.json(),
        ]);

        if (!testRes.ok || !testData?.test) {
          setError(testData.error || 'Unable to load review board context.');
          return;
        }

        if (!reviewRes.ok) {
          setError(reviewData.error || 'Unable to load submissions.');
          return;
        }

        const assignmentRows = (assignmentsData.assignments || []) as Assignment[];
        const reviewAttempts = (reviewData.submissions || []) as ReviewAttempt[];

        const submissionsByStudent = new Map<string, Submission>();

        for (const attempt of reviewAttempts) {
          const mapped = toSubmission(attempt);
          const key = normalizeName(mapped.student);

          if (!submissionsByStudent.has(key)) {
            submissionsByStudent.set(key, mapped);
          }
        }

        for (const assignment of assignmentRows) {
          if (assignment.role !== 'student') continue;

          const studentName = assignment.user.trim();
          if (!studentName) continue;

          const key = normalizeName(studentName);
          if (submissionsByStudent.has(key)) continue;

          submissionsByStudent.set(key, {
            id: `pending_${key}`,
            attemptId: null,
            studentId: null,
            student: studentName,
            status: 'pending',
            score: null,
            submittedAt: null,
            violations: 0,
            published: false,
            answerCount: 0,
          });
        }

        const mergedRows = [...submissionsByStudent.values()].sort((a, b) => {
          if (a.status !== b.status) {
            return a.status === 'submitted' ? -1 : 1;
          }

          if (a.status === 'submitted' && b.status === 'submitted') {
            const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
            const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
            return bTime - aTime;
          }

          return a.student.localeCompare(b.student);
        });

        setTest(testData.test || null);
        setSubmissions(mergedRows);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Unable to load review board');
        }
      } finally {
        setLoading(false);
      }
    };

    loadReviewContext();

    return () => controller.abort();
  }, [isTeacher, teacherAccessQuery, testId, user?.id]);

  const filteredSubmissions = useMemo(() => {
    if (filter === 'all') return submissions;
    return submissions.filter((row) => row.status === filter);
  }, [submissions, filter]);

  const stats = useMemo(() => {
    const submitted = submissions.filter((row) => row.status === 'submitted').length;
    const pending = submissions.length - submitted;
    const published = submissions.filter((row) => row.status === 'submitted' && row.published).length;
    const avgScoreRows = submissions.filter(
      (row) => row.status === 'submitted' && typeof row.score === 'number',
    ) as Array<Submission & { score: number }>;
    const avgScore =
      avgScoreRows.length > 0
        ? Math.round(avgScoreRows.reduce((sum, row) => sum + row.score, 0) / avgScoreRows.length)
        : 0;

    return {
      total: submissions.length,
      submitted,
      pending,
      published,
      avgScore,
    };
  }, [submissions]);

  const handlePublishAllVisible = async () => {
    if (!testId) return;
    if (!teacherAccessQuery) {
      setActionError('Teacher session is required to publish results.');
      return;
    }

    const attemptIds = filteredSubmissions
      .filter((row) => row.status === 'submitted' && !row.published && row.attemptId)
      .map((row) => row.attemptId as string);

    if (attemptIds.length === 0) return;

    setPublishingAll(true);
    setActionMsg(null);
    setActionError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/review${teacherAccessQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishAll: true, attemptIds }),
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || 'Unable to publish visible submissions.');
        return;
      }

      const publishedSet = new Set(attemptIds);
      setSubmissions((prev) =>
        prev.map((row) =>
          row.attemptId && publishedSet.has(row.attemptId)
            ? { ...row, published: true }
            : row,
        ),
      );

      const changed = typeof data.changed === 'number' ? data.changed : attemptIds.length;
      setActionMsg(`Published ${changed} submitted result${changed === 1 ? '' : 's'}.`);
    } catch {
      setActionError('Unable to publish visible submissions.');
    } finally {
      setPublishingAll(false);
    }
  };

  const handleTogglePublish = async (submission: Submission) => {
    if (!testId || !submission.attemptId || submission.status !== 'submitted') return;
    if (!teacherAccessQuery) {
      setActionError('Teacher session is required to publish results.');
      return;
    }

    const nextPublished = !submission.published;
    setActionMsg(null);
    setActionError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/review${teacherAccessQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: submission.attemptId,
          published: nextPublished,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || 'Unable to update publish state.');
        return;
      }

      setSubmissions((prev) =>
        prev.map((row) =>
          row.id === submission.id
            ? {
              ...row,
              published: nextPublished,
            }
            : row,
        ),
      );

      setActionMsg(nextPublished ? 'Result published for student view.' : 'Result hidden from student view.');
    } catch {
      setActionError('Unable to update publish state.');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Loading review board...
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
              <p className="font-semibold">Unable to load review board</p>
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
          <h2 className="text-lg font-semibold tracking-tight">Review board unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground">The related test could not be found.</p>
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

  if (!isTeacher) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center text-amber-200">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-500/15">
            <ShieldAlert size={22} />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Teacher Access Required</h2>
          <p className="mt-1 text-sm text-amber-200/80">
            The review board is restricted to teachers. You can still view your own result summary.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={`/tests/${test.id}/result`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
            >
              View Result
            </Link>
            <Link
              href={`/tests/${test.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              Back to Test Details
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const publishableVisibleCount = filteredSubmissions.filter(
    (row) => row.status === 'submitted' && !row.published && !!row.attemptId,
  ).length;

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_45%)]" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/tests/${test.id}`}
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Back to Test Details
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles size={11} />
            Teacher Review Board
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{test.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Track live submissions, inspect scores, and publish student results.
          </p>
        </div>

        <button
          onClick={handlePublishAllVisible}
          disabled={publishingAll || publishableVisibleCount === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {publishingAll ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {publishingAll ? 'Publishing...' : `Publish Visible (${publishableVisibleCount})`}
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total"
          value={String(stats.total)}
          description="Students tracked"
          icon={<Users size={16} />}
        />
        <StatCard
          title="Submitted"
          value={String(stats.submitted)}
          description="Attempts ready for review"
          icon={<CheckCircle2 size={16} />}
        />
        <StatCard
          title="Pending"
          value={String(stats.pending)}
          description="Awaiting final submission"
          icon={<Clock3 size={16} />}
        />
        <StatCard
          title="Published"
          value={String(stats.published)}
          description="Visible to students"
          icon={<Send size={16} />}
        />
        <StatCard
          title="Avg Score"
          value={`${stats.avgScore}%`}
          description="Across submitted attempts"
          icon={<BarChart3 size={16} />}
        />
      </div>

      {actionMsg && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {actionMsg}
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {actionError}
        </div>
      )}

      <div className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Filter size={12} />
            Filter Submissions
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'submitted', 'pending'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                  filter === item
                    ? 'border-teal-400/40 bg-teal-400/12 text-teal-200'
                    : 'border-border/70 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filteredSubmissions.length === 0 && (
            <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
              No submissions match this filter.
            </div>
          )}
          {filteredSubmissions.map((submission) => (
            <div
              key={submission.id}
              className="rounded-xl border border-border/70 bg-background/50 px-3 py-3"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{submission.student}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.08em] ${
                        submission.status === 'submitted'
                          ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300'
                          : 'border-amber-500/30 bg-amber-500/12 text-amber-300'
                      }`}
                    >
                      {submission.status}
                    </span>
                    {submission.submittedAt && (
                      <span>Submitted {new Date(submission.submittedAt).toLocaleString()}</span>
                    )}
                    <span>Violations: {submission.violations}</span>
                    <span className="inline-flex items-center gap-1">
                      <FileText size={12} />
                      Answers: {submission.answerCount}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-border/70 bg-card/60 px-2.5 py-1 text-xs font-semibold text-foreground">
                    {typeof submission.score === 'number' ? `${submission.score}%` : 'Not graded'}
                  </span>
                  <span
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                      submission.published
                        ? 'border-teal-400/30 bg-teal-400/12 text-teal-200'
                        : 'border-border/70 bg-background/60 text-muted-foreground'
                    }`}
                  >
                    {submission.published ? 'Published' : 'Private'}
                  </span>

                  {submission.status === 'submitted' && submission.attemptId ? (
                    <>
                      <Link
                        href={`/tests/${test.id}/result?attemptId=${encodeURIComponent(submission.attemptId)}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                      >
                        <Eye size={12} />
                        View Answers
                      </Link>

                      <button
                        onClick={() => handleTogglePublish(submission)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-400/30 bg-teal-400/12 px-2.5 py-1.5 text-xs font-semibold text-teal-200 transition hover:bg-teal-400/20"
                      >
                        <Send size={12} />
                        {submission.published ? 'Unpublish' : 'Publish'}
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300">
                      <XCircle size={12} />
                      Waiting
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
