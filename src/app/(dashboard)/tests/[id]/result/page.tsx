"use client";

import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  X,
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

interface AnswerInsightPayload {
  questionText: string;
  correctKey: string;
  correctText: string;
  submittedText: string;
  feedback: string;
  isCorrect: boolean;
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

function extractExpectedAnswerKey(feedback: string): string | null {
  const patterns = [
    /expected answer\s*:\s*([A-Z0-9])/i,
    /correct answer\s*:\s*([A-Z0-9])/i,
    /answer\s*key\s*:\s*([A-Z0-9])/i,
  ];

  for (const pattern of patterns) {
    const match = feedback.match(pattern);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

function buildAnswerExplanation(feedback: string) {
  const raw = feedback.trim();
  if (!raw) return 'No explanation provided.';

  const explanationMatch = raw.match(/explanation\s*:\s*(.+)$/i);
  if (explanationMatch?.[1]?.trim()) {
    return explanationMatch[1].trim();
  }

  const cleaned = raw
    .replace(/expected answer\s*:\s*[A-Z0-9]\s*\.?/gi, '')
    .replace(/correct answer\s*:\s*[A-Z0-9]\s*\.?/gi, '')
    .replace(/^\s*(needs work|wrong|incorrect|correct)\s*[:.-]?\s*/i, '')
    .trim();

  return cleaned || 'No explanation provided.';
}

export default function TestResultPage() {
  const router = useRouter();
  const pathname = usePathname();
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
  const [accessDenied, setAccessDenied] = useState(false);

  const loginNextTarget = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!testId) return;

    const controller = new AbortController();

    const loadResultContext = async () => {
      setLoading(true);
      setError(null);
      setAccessDenied(false);

      try {
        const [testRes, questionsRes] = await Promise.all([
          fetch(`/api/tests/${testId}${teacherAccessQuery}`, { signal: controller.signal }),
          fetch(`/api/tests/${testId}/questions${teacherAccessQuery ? `${teacherAccessQuery}&view=result` : '?view=result'}`, { signal: controller.signal }),
        ]);

        const [testData, questionsData] = await Promise.all([testRes.json(), questionsRes.json()]);

        if (testRes.status === 401 || questionsRes.status === 401) {
          router.replace(`/tests/login?next=${encodeURIComponent(loginNextTarget)}`);
          return;
        }

        if (testRes.status === 403 || questionsRes.status === 403) {
          setAccessDenied(true);
          return;
        }

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

        if (attemptRes.status === 401) {
          router.replace(`/tests/login?next=${encodeURIComponent(loginNextTarget)}`);
          return;
        }

        if (attemptRes.status === 403) {
          setAccessDenied(true);
          return;
        }

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
  }, [attemptIdQuery, loginNextTarget, router, studentIdQuery, teacherAccessQuery, testId, user?.id]);

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
  const violationTimeline = useMemo(
    () => (
      Array.isArray(attempt?.violation_events)
        ? [...attempt.violation_events].sort(
          (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
        )
        : []
    ),
    [attempt?.violation_events],
  );
  const [selectedIntegrityEventIndex, setSelectedIntegrityEventIndex] = useState<number | null>(null);
  const [selectedAnswerInsight, setSelectedAnswerInsight] = useState<AnswerInsightPayload | null>(null);
  const selectedIntegrityEvent = selectedIntegrityEventIndex !== null
    ? violationTimeline[selectedIntegrityEventIndex] ?? null
    : null;
  const integrityTimelinePoints = useMemo(
    () => violationTimeline.map((event, index) => ({
      event,
      index,
      position:
        violationTimeline.length <= 1
          ? 50
          : (index / (violationTimeline.length - 1)) * 100,
    })),
    [violationTimeline],
  );
  const statusLabel = scorePercent >= 60 ? 'Passed' : 'Needs Review';
  const statusTone =
    scorePercent >= 60
      ? 'text-success border-success/30 bg-success/10'
      : 'text-warning border-warning/30 bg-warning/10';

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

  if (accessDenied) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5" />
            <div>
              <p className="font-semibold">Access restricted</p>
              <p className="mt-1 text-sm text-amber-200/90">
                This result is not available for your account.
              </p>
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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_45%),radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_45%)]" />

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={user?.role === 'teacher' ? `/tests/${test.id}/review` : '/tests'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            {user?.role === 'teacher' ? 'Back to Review' : 'Back to Tests'}
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{test.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Performance summary for {attempt.student_name}.
          </p>
        </div>

        <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusTone}`}>
          <Award size={13} />
          {statusLabel}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2 rounded-2xl border border-border/80 bg-card/70 p-2.5">
        <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/65 px-3 py-1.5 text-center text-xs font-semibold text-foreground">
          Correct <span className="text-success">{correctCount}</span>
        </span>
        <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/65 px-3 py-1.5 text-center text-xs font-semibold text-foreground">
          Incorrect <span className="text-warning">{Math.max(0, totalQuestions - correctCount)}</span>
        </span>
        <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/65 px-3 py-1.5 text-center text-xs font-semibold text-foreground">
          Score <span className="text-primary">{scorePercent}%</span>
        </span>
        <span className="inline-flex w-full items-center gap-1.5 rounded-xl border border-border/70 bg-background/65 px-3 py-1.5 text-xs text-muted-foreground">
          <Clock3 size={12} />
          Submitted {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString() : '-'}
        </span>
      </div>

      <section className="mb-6 rounded-3xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
        <div className="text-center">
          <h2 className="text-lg font-semibold tracking-tight">Integrity Timeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Any browser or copy/paste events recorded during the attempt.
          </p>
          <div className="mt-3 inline-flex rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {violationCount} {violationCount === 1 ? 'event' : 'events'}
          </div>
        </div>

        {violationTimeline.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-success/30 bg-success/10 p-5">
            <div className="relative mx-auto max-w-3xl py-3">
              <div className="h-1 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
              <div className="mt-3 text-center text-sm font-medium text-success">
                Clean attempt - no integrity events detected.
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-border/70 bg-background/40 p-5">
            <div className="relative mx-auto max-w-4xl py-4">
              <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border/70" />
              {integrityTimelinePoints.map((point) => (
                <button
                  key={point.event.id}
                  type="button"
                  style={{ left: `${point.position}%` }}
                  onClick={() => setSelectedIntegrityEventIndex(point.index)}
                  className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/70 bg-background shadow-[0_0_0_6px_color-mix(in_oklab,var(--primary)_16%,transparent)] transition hover:scale-110 hover:border-primary"
                  aria-label={`Open integrity event ${point.index + 1}`}
                  title={`Event ${point.index + 1} - ${formatViolationEventLabel(point.event.event_type)}`}
                />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>Start: {new Date(violationTimeline[0].occurred_at).toLocaleTimeString()}</span>
              <span>Click a dot to view event details</span>
              <span>End: {new Date(violationTimeline[violationTimeline.length - 1].occurred_at).toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </section>

      {selectedIntegrityEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedIntegrityEventIndex(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-5 shadow-2xl shadow-black/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Integrity Event {selectedIntegrityEventIndex! + 1}
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {formatViolationEventLabel(selectedIntegrityEvent.event_type)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIntegrityEventIndex(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-muted-foreground transition hover:border-border hover:text-foreground"
                aria-label="Close integrity event popup"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Action taken</p>
                <p className="mt-1 font-medium text-foreground">{selectedIntegrityEvent.action_taken}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Timestamp</p>
                <p className="mt-1 font-medium text-foreground">{new Date(selectedIntegrityEvent.occurred_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedAnswerInsight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-5"
          onClick={() => setSelectedAnswerInsight(null)}
        >
          <div
            className="w-[min(96vw,52rem)] max-h-[88vh] overflow-y-auto rounded-3xl border border-border/80 bg-card p-4 shadow-2xl shadow-black/30 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Why This Is Correct
                </p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">
                  {selectedAnswerInsight.correctKey}. {selectedAnswerInsight.correctText}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnswerInsight(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition hover:scale-105 hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
                aria-label="Close answer explanation popup"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 text-sm">
              <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Question</p>
                <p className="mt-1 text-foreground">{selectedAnswerInsight.questionText}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Your answer</p>
                <p className={`mt-1 font-medium ${selectedAnswerInsight.isCorrect ? 'text-success' : 'text-warning'}`}>
                  {selectedAnswerInsight.submittedText}
                </p>
              </div>
              <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-success/90">Explanation</p>
                <p className="mt-1 text-foreground">{selectedAnswerInsight.feedback}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-3xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Question Review</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each card shows the question, submitted answer, and correct option where available.</p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <BarChart3 size={12} />
            {reviewItems.length} items
          </div>
        </div>

        <div className="grid gap-3">
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
            const explicitCorrectKey = (question?.correct_answer ?? '').trim().toUpperCase();
            const feedbackDerivedCorrectKey = extractExpectedAnswerKey(item.feedback ?? '');
            const correctKey = explicitCorrectKey || feedbackDerivedCorrectKey || '';
            const selectedOption = options.find((entry) => entry.key.toUpperCase() === selectedKey);
            const normalizedTextCorrectAnswer = !isMcq
              ? (question?.correct_answer ?? '').trim()
              : '';

            return (
              <div
                key={item.question_id}
                className="rounded-2xl border border-border/70 bg-background/50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Question {index + 1}</p>
                    <p className="mt-1 text-base font-medium text-foreground">{item.question_text}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${item.is_correct
                        ? 'border-success/30 bg-success/10 text-success'
                        : 'border-warning/30 bg-warning/10 text-warning'
                      }`}
                  >
                    {item.is_correct ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                    {item.is_correct ? 'Correct' : 'Wrong'}
                  </span>
                </div>

                {isMcq ? (
                  <div className="mt-3 space-y-2">
                    {options.map((opt) => {
                      const isSelected = opt.key.toUpperCase() === selectedKey;
                      const isCorrectOption = opt.key.toUpperCase() === correctKey && correctKey !== '';
                      let optionStyle = 'border-border/70 bg-card/60 text-muted-foreground';
                      if (isSelected && item.is_correct) {
                        optionStyle = 'border-success/30 bg-success/10 text-success';
                      } else if (isSelected && !item.is_correct) {
                        optionStyle = 'border-danger/30 bg-danger/10 text-danger';
                      } else if (isCorrectOption) {
                        optionStyle = 'border-success/25 bg-success/10 text-success';
                      }

                      return (
                        <div
                          key={opt.key}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${optionStyle}`}
                        >
                          <span className="inline-flex w-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5 text-[11px] font-semibold">
                            {opt.key}
                          </span>
                          <span className="flex-1">{opt.text}</span>
                          {isSelected && (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.is_correct
                              ? 'border-success/30 bg-success/10 text-success'
                              : 'border-warning/30 bg-warning/10 text-warning'
                              }`}
                            >
                              {item.is_correct ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              Your Answer
                            </span>
                          )}
                          {isCorrectOption && (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                                <CheckCircle2 size={11} />
                                Correct Answer
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedAnswerInsight({
                                  questionText: item.question_text,
                                  correctKey: opt.key,
                                  correctText: opt.text,
                                  submittedText: selectedOption ? `${selectedOption.key}. ${selectedOption.text}` : (item.answer || 'No answer submitted'),
                                  feedback: buildAnswerExplanation(item.feedback ?? ''),
                                  isCorrect: item.is_correct,
                                })}
                                className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success transition hover:bg-success/25"
                              >
                                Why?
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-border/70 bg-card/60 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Submitted Answer</p>
                    <p className="mt-1 text-sm text-foreground">{item.answer || 'No answer recorded.'}</p>
                  </div>
                )}

                {!item.is_correct && !isMcq && normalizedTextCorrectAnswer && (
                  <div className="mt-3 rounded-xl border border-success/30 bg-success/10 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-success/90">Correct Answer</p>
                    <p className="mt-1 text-sm font-medium text-success">
                      {normalizedTextCorrectAnswer}
                    </p>
                  </div>
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
