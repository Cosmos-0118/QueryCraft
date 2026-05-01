"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTestAuth as useAuth } from '@/hooks/use-test-auth';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Filter,
  Loader2,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

interface Test {
  id: string;
  title: string;
  status: string;
  created_by: string;
  updated_at: string;
  module_type?: 'classic' | 'interactive_quiz';
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

function ReviewMetricCard({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: 'default' | 'success' | 'warning' | 'primary';
}) {
  const toneClass = {
    default: 'border-border/70 bg-background/50 text-foreground',
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    primary: 'border-primary/30 bg-primary/10 text-primary',
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
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

export default function TestReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { user, hydrated, isAuthenticated } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const testId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const teacherAccessQuery = isTeacher && user?.id
    ? `?role=teacher&userId=${encodeURIComponent(user.id)}`
    : '';

  const [test, setTest] = useState<Test | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [publishingAll, setPublishingAll] = useState(false);
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());

  const isClassicTest = !test?.module_type || test.module_type === 'classic';

  const handlePublishAll = async () => {
    if (!testId || !isTeacher || !user?.id || publishingAll) return;
    setPublishingAll(true);
    try {
      const res = await fetch(`/api/tests/${testId}/review${teacherAccessQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishAll: true }),
      });
      if (res.ok) {
        setSubmissions((prev) =>
          prev.map((s) => (s.status === 'submitted' ? { ...s, published: true } : s)),
        );
      }
    } catch { /* ignore */ } finally {
      setPublishingAll(false);
    }
  };

  const handleTogglePublish = async (submission: Submission) => {
    if (!testId || !isTeacher || !user?.id || !submission.attemptId) return;
    const newPublished = !submission.published;
    setPublishingIds((prev) => new Set(prev).add(submission.id));
    try {
      const res = await fetch(`/api/tests/${testId}/review${teacherAccessQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: submission.attemptId, published: newPublished }),
      });
      if (res.ok) {
        setSubmissions((prev) =>
          prev.map((s) => (s.id === submission.id ? { ...s, published: newPublished } : s)),
        );
      }
    } catch { /* ignore */ } finally {
      setPublishingIds((prev) => {
        const next = new Set(prev);
        next.delete(submission.id);
        return next;
      });
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace(`/tests/login?next=${encodeURIComponent(`/tests/${testId ?? ''}/review`)}`);
    }
  }, [hydrated, isAuthenticated, router, testId, user]);

  useEffect(() => {
    if (!testId || !hydrated || !isAuthenticated) return;

    const controller = new AbortController();

    const loadReviewContext = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!isTeacher || !user?.id) {
          const testRes = await fetch(`/api/tests/${testId}`, { signal: controller.signal });

          if (testRes.status === 401) {
            router.replace(`/tests/login?next=${encodeURIComponent(`/tests/${testId}/review`)}`);
            return;
          }

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

        if (testRes.status === 401 || assignmentsRes.status === 401 || reviewRes.status === 401) {
          router.replace(`/tests/login?next=${encodeURIComponent(`/tests/${testId}/review`)}`);
          return;
        }

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
  }, [hydrated, isAuthenticated, isTeacher, teacherAccessQuery, testId, user?.id, router]);

  const filteredSubmissions = useMemo(() => {
    if (filter === 'all') return submissions;
    return submissions.filter((row) => row.status === filter);
  }, [submissions, filter]);

  const stats = useMemo(() => {
    const submitted = submissions.filter((row) => row.status === 'submitted').length;
    const pending = submissions.length - submitted;
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
      avgScore,
    };
  }, [submissions]);

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

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_45%),radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_45%)]" />

      <div className="mb-6 rounded-3xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href={`/tests/${test.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              <ArrowLeft size={13} />
              Back to Test Details
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{test.title}</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Review who submitted, publish results, and open each student&apos;s answers from one clean dashboard.
            </p>
          </div>

          {isClassicTest && stats.submitted > 0 && (
            <button
              onClick={() => void handlePublishAll()}
              disabled={publishingAll}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishingAll ? 'Publishing...' : 'Publish All Results'}
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReviewMetricCard label="Students" value={stats.total} helper="Assigned students" tone="primary" />
          <ReviewMetricCard label="Submitted" value={stats.submitted} helper="Ready to review" tone="success" />
          <ReviewMetricCard label="Pending" value={stats.pending} helper="Not submitted yet" tone="warning" />
          <ReviewMetricCard
            label={isClassicTest ? 'Average Score' : 'Average Points'}
            value={isClassicTest ? `${stats.avgScore}%` : stats.avgScore}
            helper="Submitted attempts"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-border/75 bg-card/85 p-5 shadow-xl shadow-black/10 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Submissions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use filters to focus on submitted or pending students.</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto lg:justify-end">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Filter size={12} />
              Filter
            </div>
            {(['all', 'submitted', 'pending'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                  filter === item
                    ? 'border-primary/40 bg-primary/12 text-primary'
                    : 'border-border/70 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {filteredSubmissions.length === 0 && (
            <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
              No submissions match this filter.
            </div>
          )}
          {filteredSubmissions.map((submission) => (
            <div
              key={submission.id}
              className="rounded-2xl border border-border/70 bg-background/50 p-4 transition hover:border-primary/25 hover:bg-background/70 sm:p-5"
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-sm font-bold text-primary">
                      {submission.student.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">{submission.student}</p>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                            submission.status === 'submitted'
                              ? 'border-success/30 bg-success/10 text-success'
                              : 'border-warning/30 bg-warning/10 text-warning'
                          }`}
                        >
                          {submission.status === 'submitted' ? 'Submitted' : 'Pending'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {submission.submittedAt ? `Submitted ${new Date(submission.submittedAt).toLocaleString()}` : 'No submission yet'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/70 bg-card/65 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Score</p>
                      <p className="mt-1 text-sm font-bold text-foreground">
                        {typeof submission.score === 'number'
                          ? isClassicTest
                            ? `${submission.score}%`
                            : String(Math.round(submission.score))
                          : 'Not graded'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card/65 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Answers</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-foreground">
                        <FileText size={12} className="text-muted-foreground" />
                        {submission.answerCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card/65 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Violations</p>
                      <p className="mt-1 text-sm font-bold text-foreground">{submission.violations}</p>
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-2.5 xl:w-auto xl:justify-end">
                  {isClassicTest && submission.status === 'submitted' && submission.attemptId && (
                    <button
                      onClick={() => void handleTogglePublish(submission)}
                      disabled={publishingIds.has(submission.id)}
                      className={`inline-flex h-10 w-full flex-1 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:w-auto ${
                        submission.published
                          ? 'border-success/30 bg-success/10 text-success hover:bg-success/15'
                          : 'border-warning/30 bg-warning/10 text-warning hover:bg-warning/15'
                      }`}
                    >
                      {submission.published ? (
                        <><CheckCircle2 size={13} /> Published</>
                      ) : (
                        <><Clock3 size={13} /> Unpublished</>
                      )}
                    </button>
                  )}

                  {submission.status === 'submitted' && submission.attemptId ? (
                    <Link
                      href={`/tests/${test.id}/result?attemptId=${encodeURIComponent(submission.attemptId)}`}
                      className="inline-flex h-10 w-full flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground sm:flex-none sm:w-auto"
                    >
                      <Eye size={13} />
                      View Answers
                    </Link>
                  ) : (
                    <span className="inline-flex h-10 w-full flex-1 items-center justify-center gap-1 rounded-xl border border-warning/25 bg-warning/10 px-3.5 text-xs font-semibold text-warning sm:flex-none sm:w-auto">
                      <XCircle size={13} />
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
