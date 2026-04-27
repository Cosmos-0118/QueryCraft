"use client";

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTestAuth as useAuth } from '@/hooks/use-test-auth';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  Clock3,
  Loader2,
  Sparkles,
  TrendingUp,
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

interface Question {
  id: string;
  text: string;
  question_type?: 'mcq' | 'sql_fill';
  options?: Array<{ key: string; text: string }>;
  correct_answer?: string | null;
}

interface AttemptResult {
  question_id: string;
  question_text: string;
  answer: string;
  is_correct: boolean;
  feedback: string;
}

interface ViolationEvent {
  id: string;
  event_type: 'tab_switch' | 'blur' | 'copy' | 'paste' | 'cut' | 'context_menu';
  action_taken: 'logged' | 'warned' | 'blocked' | 'force_submitted';
  occurred_at: string;
}

interface AttemptAnswer {
  question_id: string;
  question_text: string;
  answer: string;
}

interface AttemptRecord {
  id: string;
  student_id: string;
  student_name: string;
  status: 'in_progress' | 'submitted';
  submitted_at: string | null;
  score: number | null;
  max_score: number;
  violation_count?: number;
  violation_events?: ViolationEvent[];
  results: AttemptResult[];
  answers?: AttemptAnswer[];
  published?: boolean;
}

function formatViolationEventLabel(eventType: ViolationEvent['event_type']) {
  switch (eventType) {
    case 'tab_switch':
      return 'Tab switch';
    case 'blur':
      return 'Window blur';
    case 'copy':
      return 'Copy blocked';
    case 'paste':
      return 'Paste blocked';
    case 'cut':
      return 'Cut blocked';
    case 'context_menu':
      return 'Right-click blocked';
    default:
      return 'Violation';
  }
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

export default function TestResultPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const testId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const attemptIdQuery = searchParams.get('attemptId');
  const studentIdQuery = searchParams.get('studentId');
  const isTeacher = user?.role === 'teacher';
  const teacherAccessQuery = isTeacher && user?.id
    ? `?role=teacher&userId=${encodeURIComponent(user.id)}`
    : '';

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<AttemptRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;

    const controller = new AbortController();

    const loadResultContext = async () => {
      setLoading(true);
      setError(null);

      try {
        const [testRes, questionsRes] = await Promise.all([
          fetch(`/api/tests/${testId}${teacherAccessQuery}`, { signal: controller.signal }),
          fetch(`/api/tests/${testId}/questions${teacherAccessQuery ? `${teacherAccessQuery}&view=result` : '?view=result'}`, { signal: controller.signal }),
        ]);

        const [testData, questionsData] = await Promise.all([testRes.json(), questionsRes.json()]);

        if (!testRes.ok || !testData?.test) {
          setError(testData.error || 'Unable to load test result context.');
          return;
        }

        let attemptUrl = '';
        if (attemptIdQuery) {
          attemptUrl = `/api/tests/${testId}/attempts?attemptId=${encodeURIComponent(attemptIdQuery)}`;
        } else {
          const targetStudentId = studentIdQuery || user?.id;
          if (!targetStudentId) {
            setError('No student context found for result lookup.');
            return;
          }
          attemptUrl = `/api/tests/${testId}/attempts?studentId=${encodeURIComponent(targetStudentId)}`;
        }

        const attemptRes = await fetch(attemptUrl, { signal: controller.signal });
        const attemptData = await attemptRes.json();

        if (!attemptRes.ok) {
          setError(attemptData.error || 'Unable to load attempt result.');
          return;
        }

        setTest(testData.test || null);
        setQuestions(questionsData.questions || []);
        setAttempt((attemptData.attempt as AttemptRecord | null) ?? null);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Unable to load result page');
        }
      } finally {
        setLoading(false);
      }
    };

    loadResultContext();

    return () => controller.abort();
  }, [attemptIdQuery, studentIdQuery, teacherAccessQuery, testId, user?.id]);

  const isClassicTest = !test?.module_type || test.module_type === 'classic';
  const isPublished = attempt?.published === true;
  const showResults = isTeacher || !isClassicTest || isPublished;

  const answerMap = useMemo(() => {
    const map = new Map<string, string>();
    if (attempt?.answers) {
      for (const ans of attempt.answers) {
        if (ans.answer) map.set(ans.question_id, ans.answer);
      }
    }
    return map;
  }, [attempt?.answers]);

  const reviewItems = useMemo(() => {
    if (attempt?.results && attempt.results.length > 0) {
      return attempt.results.map((r) => ({
        ...r,
        answer: r.answer || answerMap.get(r.question_id) || '',
      }));
    }

    if (attempt?.answers && attempt.answers.length > 0) {
      return attempt.answers.map((ans) => ({
        question_id: ans.question_id,
        question_text: ans.question_text,
        answer: ans.answer,
        is_correct: false,
        feedback: '',
      }));
    }

    return questions.map((question) => ({
      question_id: question.id,
      question_text: question.text,
      answer: '',
      is_correct: false,
      feedback: '',
    }));
  }, [attempt?.results, attempt?.answers, answerMap, questions]);

  const questionMap = useMemo(() => {
    const map = new Map<string, Question>();
    for (const q of questions) {
      map.set(q.id, q);
    }
    return map;
  }, [questions]);

  const totalQuestions = reviewItems.length;
  const correctCount = reviewItems.filter((item) => item.is_correct).length;
  const scorePercent = attempt?.score ?? (totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100));
  const violationCount = typeof attempt?.violation_count === 'number'
    ? attempt.violation_count
    : Array.isArray(attempt?.violation_events)
      ? attempt.violation_events.length
      : 0;
  const violationTimeline = Array.isArray(attempt?.violation_events)
    ? [...attempt.violation_events].sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    )
    : [];
  const statusLabel = scorePercent >= 60 ? 'Passed' : 'Needs Review';
  const statusTone =
    scorePercent >= 60
      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
      : 'text-amber-300 border-amber-500/30 bg-amber-500/10';

  if (loading) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Loading result summary...
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
              <p className="font-semibold">Unable to load result</p>
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
          <h2 className="text-lg font-semibold tracking-tight">Result unavailable</h2>
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

  if (!attempt || attempt.status !== 'submitted') {
    return (
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_45%)]" />
        <div className="rounded-2xl border border-border/70 bg-card/85 p-10 text-center shadow-xl shadow-black/10">
          <h2 className="text-xl font-semibold tracking-tight">No Submitted Attempt Yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit the test attempt first. Once submitted, score and answer review will appear here.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={user?.role === 'teacher' ? `/tests/${test.id}` : '/tests'}
              className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              {user?.role === 'teacher' ? 'Back to Test Details' : 'Back to Tests'}
            </Link>
            {user?.role === 'teacher' && (
              <Link
                href={`/tests/${test.id}/review`}
                className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
              >
                Back to Review Board
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!showResults) {
    return (
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_45%)]" />
        <div className="rounded-2xl border border-border/70 bg-card/85 p-10 text-center shadow-xl shadow-black/10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/15 text-amber-200">
            <Clock3 size={24} />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">Results Not Published Yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your test has been submitted successfully. Please wait for the teacher to review and publish the results.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check back later to view your score, answers, and feedback.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/tests"
              className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              <ArrowLeft size={15} />
              Back to Tests
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_45%)]" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={user?.role === 'teacher' ? `/tests/${test.id}/review` : '/tests'}
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            {user?.role === 'teacher' ? 'Back to Review' : 'Back to Tests'}
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles size={11} />
            Result Center
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{test.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Performance snapshot for {attempt.student_name}.
          </p>
        </div>

        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusTone}`}>
          <Award size={13} />
          {statusLabel}
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Overall Score</p>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-5xl font-black tracking-tight text-foreground">{scorePercent}%</p>
            <p className="pb-1 text-sm text-muted-foreground">{correctCount}/{totalQuestions} correct</p>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-background/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all duration-500"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Review each answer below to understand strengths and improvement points.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Attempt Summary</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3 py-2">
              <span className="text-muted-foreground">Student</span>
              <span className="font-semibold">{attempt.student_name}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3 py-2">
              <span className="text-muted-foreground">Submitted</span>
              <span className="font-semibold">{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : '-'}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3 py-2">
              <span className="text-muted-foreground">Attempt ID</span>
              <span className="font-semibold">{attempt.id.slice(0, 10)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 px-3 py-2">
              <span className="text-muted-foreground">Violations</span>
              <span className="font-semibold">{violationCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Correct"
          value={String(correctCount)}
          description="Questions answered correctly"
          icon={<CheckCircle2 size={16} />}
        />
        <StatCard
          title="Incorrect"
          value={String(Math.max(0, totalQuestions - correctCount))}
          description="Questions to revise"
          icon={<XCircle size={16} />}
        />
        <StatCard
          title="Submitted"
          value={attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString() : '-'}
          description="Attempt completion date"
          icon={<Clock3 size={16} />}
        />
        <StatCard
          title="Performance"
          value={`${scorePercent}%`}
          description="Current accuracy rate"
          icon={<TrendingUp size={16} />}
        />
      </div>

      <section className="mb-6 rounded-2xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Integrity Timeline</h2>
          <span className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {violationCount} events
          </span>
        </div>

        {violationTimeline.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
            No integrity violations were logged for this attempt.
          </div>
        ) : (
          <div className="space-y-2">
            {violationTimeline.map((event, index) => (
              <div
                key={event.id}
                className="rounded-xl border border-border/70 bg-background/50 px-3 py-2"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Event {index + 1}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {formatViolationEventLabel(event.event_type)} ({event.action_taken})
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(event.occurred_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Question Review</h2>
            <p className="mt-1 text-xs text-muted-foreground">Submitted answers with correctness feedback.</p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <BarChart3 size={12} />
            {reviewItems.length} items
          </div>
        </div>

        <div className="space-y-2">
          {reviewItems.length === 0 && (
            <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
              No question review is available yet.
            </div>
          )}
          {reviewItems.map((item, index) => {
            const question = questionMap.get(item.question_id);
            const options = question?.options ?? [];
            const isMcq = question?.question_type === 'mcq' && options.length > 0;
            const selectedKey = (item.answer ?? '').trim().toUpperCase();
            const correctKey = (question?.correct_answer ?? '').trim().toUpperCase();

            return (
              <div
                key={item.question_id}
                className="rounded-xl border border-border/70 bg-background/50 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Question {index + 1}</p>
                    <p className="mt-1 text-sm text-foreground">{item.question_text}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      item.is_correct
                        ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300'
                        : 'border-amber-500/30 bg-amber-500/12 text-amber-300'
                    }`}
                  >
                    {item.is_correct ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    {item.is_correct ? 'Correct' : 'Needs Work'}
                  </span>
                </div>

                {isMcq ? (
                  <div className="mt-2 space-y-1.5">
                    {options.map((opt) => {
                      const isSelected = opt.key.toUpperCase() === selectedKey;
                      const isCorrectOption = opt.key.toUpperCase() === correctKey && correctKey !== '';
                      let optionStyle = 'border-border/70 bg-card/60 text-muted-foreground';
                      if (isSelected && item.is_correct) {
                        optionStyle = 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200';
                      } else if (isSelected && !item.is_correct) {
                        optionStyle = 'border-red-500/30 bg-red-500/12 text-red-200';
                      } else if (isCorrectOption) {
                        optionStyle = 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300/80';
                      }

                      return (
                        <div
                          key={opt.key}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${optionStyle}`}
                        >
                          <span className="inline-flex w-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold">
                            {opt.key}
                          </span>
                          <span className="flex-1">{opt.text}</span>
                          {isSelected && (
                            <span className="text-[11px] font-semibold">
                              {item.is_correct ? <CheckCircle2 size={13} className="text-emerald-300" /> : <XCircle size={13} className="text-red-300" />}
                            </span>
                          )}
                          {isCorrectOption && !isSelected && (
                            <span className="text-[10px] font-semibold text-emerald-400">Correct</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 rounded-lg border border-border/70 bg-card/60 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Submitted Answer</p>
                    <p className="mt-1 text-sm text-foreground">{item.answer || 'No answer recorded.'}</p>
                  </div>
                )}

                {item.feedback && (
                  <p className="mt-2 text-xs text-muted-foreground">{item.feedback}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href={user?.role === 'teacher' ? `/tests/${test.id}` : '/tests'}
          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
        >
          {user?.role === 'teacher' ? 'Back to Test Details' : 'Back to Tests'}
        </Link>
        {user?.role === 'teacher' && (
          <Link
            href={`/tests/${test.id}/review`}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
          >
            Open Review Board
          </Link>
        )}
      </div>
    </div>
  );
}
