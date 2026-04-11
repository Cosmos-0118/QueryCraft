"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react';

interface Test {
  id: string;
  title: string;
  status: string;
  created_by: string;
  updated_at: string;
  duration_minutes?: number;
}

interface Question {
  id: string;
  text: string;
  question_type: 'mcq' | 'sql_fill';
  options: Array<{
    key: string;
    text: string;
  }>;
}

interface AttemptAnswer {
  question_id: string;
  answer: string;
}

interface AttemptRecord {
  id: string;
  status: 'in_progress' | 'submitted';
  answers: AttemptAnswer[];
  score: number | null;
}

function formatTime(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function TestAttemptPage() {
  const params = useParams();
  const { user } = useAuth();

  const testId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const isStudent = user?.role === 'student';

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const answersRef = useRef<Record<string, string>>({});
  const saveInFlightRef = useRef(false);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const lastSavedSnapshotRef = useRef('{}');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);

  const [remainingSeconds, setRemainingSeconds] = useState(30 * 60);

  useEffect(() => {
    if (!testId || !user) return;

    const controller = new AbortController();

    const loadAttemptContext = async () => {
      setLoading(true);
      setError(null);

      try {
        const [testRes, questionsRes] = await Promise.all([
          fetch(`/api/tests/${testId}`, { signal: controller.signal }),
          fetch(`/api/tests/${testId}/questions`, { signal: controller.signal }),
        ]);

        const [testData, questionsData] = await Promise.all([testRes.json(), questionsRes.json()]);

        if (!testRes.ok || !testData?.test) {
          setError(testData.error || 'Unable to load test for attempt.');
          return;
        }

        const attemptRes = await fetch(`/api/tests/${testId}/attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: user.id,
            student_name: user.displayName,
          }),
          signal: controller.signal,
        });
        const attemptData = await attemptRes.json();

        if (!attemptRes.ok || !attemptData?.attempt) {
          setError(attemptData.error || 'Unable to start this attempt. Enter the test code first.');
          return;
        }

        const attempt = attemptData.attempt as AttemptRecord;

        setTest(testData.test || null);
        setQuestions(questionsData.questions || []);
        setAttemptId(attempt.id);
        setSubmitted(attempt.status === 'submitted');
        setAutoSubmitTriggered(attempt.status === 'submitted');

        const mappedAnswers: Record<string, string> = {};
        for (const answer of attempt.answers || []) {
          mappedAnswers[answer.question_id] = answer.answer;
        }
        setAnswers(mappedAnswers);
        answersRef.current = mappedAnswers;
        lastSavedSnapshotRef.current = JSON.stringify(mappedAnswers);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Unable to load attempt page');
        }
      } finally {
        setLoading(false);
      }
    };

    loadAttemptContext();

    return () => controller.abort();
  }, [testId, user]);

  useEffect(() => {
    if (!test?.duration_minutes) return;
    setRemainingSeconds(test.duration_minutes * 60);
    setAutoSubmitTriggered(false);
  }, [test?.duration_minutes]);

  useEffect(() => {
    if (loading || submitted) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, submitted]);

  useEffect(() => {
    if (loading || submitted || submitting || autoSubmitTriggered) return;
    if (remainingSeconds > 0) return;
    if (!questions.length || !attemptId || !testId) return;

    setAutoSubmitTriggered(true);
    setSubmitting(true);
    setSaveMessage(null);
    setError(null);

    const submitOnTimeout = async () => {
      try {
        const res = await fetch(`/api/tests/${testId}/attempts/${attemptId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        });
        const data = await res.json();

        if (!res.ok || !data?.attempt) {
          setError(data.error || 'Unable to auto-submit attempt.');
          return;
        }

        setSubmitted(true);
        setSaveMessage('Time is up. Your attempt was auto-submitted.');
      } catch {
        setError('Time is up. Auto-submit failed, please submit manually.');
      } finally {
        setSubmitting(false);
      }
    };

    void submitOnTimeout();
  }, [
    autoSubmitTriggered,
    attemptId,
    answers,
    loading,
    questions.length,
    remainingSeconds,
    submitted,
    submitting,
    testId,
  ]);

  const currentQuestion = questions[currentIndex] ?? null;

  const answeredCount = useMemo(
    () => questions.filter((question) => (answers[question.id] ?? '').trim().length > 0).length,
    [questions, answers],
  );

  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const persistAnswers = useCallback(
    async (mode: 'manual' | 'auto') => {
      if (!attemptId || !testId || submitted) return false;

      const snapshot = JSON.stringify(answersRef.current);

      if (mode === 'auto' && snapshot === lastSavedSnapshotRef.current) {
        return true;
      }

      if (saveInFlightRef.current) {
        return savePromiseRef.current ?? false;
      }

      saveInFlightRef.current = true;

      if (mode === 'manual') {
        setSavingDraft(true);
        setSaveMessage(null);
        setError(null);
      }

      const savePromise = (async () => {
        try {
          const res = await fetch(`/api/tests/${testId}/attempts/${attemptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: answersRef.current }),
          });
          const data = await res.json();

          if (!res.ok || !data?.attempt) {
            if (mode === 'manual') {
              setError(data.error || 'Unable to save answers.');
            }
            return false;
          }

          lastSavedSnapshotRef.current = snapshot;

          if (mode === 'manual') {
            setSaveMessage('Answers saved successfully.');
          }

          return true;
        } catch {
          if (mode === 'manual') {
            setError('Unable to save answers.');
          }
          return false;
        } finally {
          if (mode === 'manual') {
            setSavingDraft(false);
          }
          saveInFlightRef.current = false;
          savePromiseRef.current = null;
        }
      })();

      savePromiseRef.current = savePromise;
      return savePromise;
    },
    [attemptId, submitted, testId],
  );

  const navigateToQuestion = useCallback(
    (targetIndex: number) => {
      if (questions.length === 0) return;

      const clampedTarget = Math.max(0, Math.min(targetIndex, questions.length - 1));
      if (clampedTarget === currentIndex) return;

      void (async () => {
        const saved = await persistAnswers('auto');
        if (!saved) {
          setError('Unable to auto-save current answer before navigation. Please try again.');
          return;
        }

        setCurrentIndex(clampedTarget);
      })();
    },
    [currentIndex, persistAnswers, questions.length],
  );

  useEffect(() => {
    if (!attemptId || !testId || submitted || loading) return;

    const intervalId = setInterval(() => {
      void persistAnswers('auto');
    }, 7000);

    return () => clearInterval(intervalId);
  }, [attemptId, loading, persistAnswers, submitted, testId]);

  const handleSaveCurrent = async () => {
    void persistAnswers('manual');
  };

  const handleSubmit = async () => {
    if (!questions.length || !attemptId || !testId || submitted) return;

    const ok = window.confirm('Submit your attempt now? You will not be able to edit after submission.');
    if (!ok) return;

    setSubmitting(true);
    setSaveMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();

      if (!res.ok || !data?.attempt) {
        setError(data.error || 'Unable to submit attempt.');
        return;
      }

      setSubmitted(true);
      setAutoSubmitTriggered(true);
      setSaveMessage('Attempt submitted successfully.');
    } catch {
      setError('Unable to submit attempt.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isStudent) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center text-amber-200">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-500/15">
            <ShieldAlert size={22} />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Student Access Required</h2>
          <p className="mt-1 text-sm text-amber-200/80">
            Test attempts are available only for student accounts. Teachers can use the review board.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={`/tests/${testId ?? ''}`}
              className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              Back to Test Details
            </Link>
            <Link
              href={`/tests/${testId ?? ''}/review`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
            >
              Open Review Board
            </Link>
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
            Loading attempt workspace...
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
              <p className="font-semibold">Unable to open attempt</p>
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
          <p className="mt-1 text-sm text-muted-foreground">This test no longer exists.</p>
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

  if (submitted) {
    return (
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_45%)]" />
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/15 text-emerald-300">
            <CheckCircle2 size={22} />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Attempt Submitted</h1>
          <p className="mt-1 text-sm text-emerald-200/80">
            Great work. Your responses have been recorded for teacher review.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={`/tests/${test.id}/result${attemptId ? `?attemptId=${encodeURIComponent(attemptId)}` : ''}`}
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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_45%)]" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/tests/${test.id}`}
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Back to Test
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles size={11} />
            Live Attempt
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{test.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Stay focused, track progress, and submit when you are ready.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/85 px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Time Left</p>
          <p className="mt-1 flex items-center gap-1.5 text-xl font-bold tracking-tight">
            <Clock3 size={16} className="text-teal-300" />
            {formatTime(remainingSeconds)}
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{answeredCount}/{questions.length} answered</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-background/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {saveMessage && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {saveMessage}
        </div>
      )}

      <div className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
        <div className="mb-4 flex flex-wrap gap-2">
          {questions.map((question, index) => {
            const isActive = index === currentIndex;
            const isAnswered = (answers[question.id] ?? '').trim().length > 0;
            return (
              <button
                key={question.id}
                onClick={() => navigateToQuestion(index)}
                className={`h-8 w-8 rounded-full border text-xs font-semibold transition ${
                  isActive
                    ? 'border-teal-400/50 bg-teal-400/15 text-teal-200'
                    : isAnswered
                      ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-300'
                      : 'border-border/70 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>

        {currentQuestion ? (
          <>
            <h2 className="text-lg font-semibold tracking-tight">Question {currentIndex + 1}</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{currentQuestion.text}</p>

            <div className="mt-3">
              <span className="inline-flex rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {currentQuestion.question_type === 'mcq' ? 'MCQ' : 'SQL/TEXT'}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Your Answer
              </label>
              {currentQuestion.question_type === 'mcq' && currentQuestion.options.length > 0 ? (
                <div className="space-y-2">
                  {currentQuestion.options.map((option) => {
                    const isSelected = (answers[currentQuestion.id] ?? '') === option.key;
                    return (
                      <button
                        key={`${currentQuestion.id}_option_${option.key}`}
                        type="button"
                        onClick={() => {
                          setAnswers((prev) => {
                            const next = { ...prev, [currentQuestion.id]: option.key };
                            answersRef.current = next;
                            return next;
                          });
                          if (saveMessage) setSaveMessage(null);
                        }}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          isSelected
                            ? 'border-teal-400/50 bg-teal-400/15 text-teal-100'
                            : 'border-border/70 bg-background/70 text-foreground hover:border-border'
                        }`}
                      >
                        <span className="font-semibold">{option.key}.</span> {option.text}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={answers[currentQuestion.id] ?? ''}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setAnswers((prev) => {
                      const next = { ...prev, [currentQuestion.id]: nextValue };
                      answersRef.current = next;
                      return next;
                    });
                    if (saveMessage) setSaveMessage(null);
                  }}
                  rows={8}
                  className="w-full resize-y rounded-xl border border-border bg-background/90 px-3.5 py-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  placeholder="Write your answer here..."
                />
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateToQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <button
                  onClick={() => navigateToQuestion(currentIndex + 1)}
                  disabled={currentIndex >= questions.length - 1}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Auto-save every 7s
                </span>
                <button
                  onClick={handleSaveCurrent}
                  disabled={savingDraft || !attemptId}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                >
                  {savingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {savingDraft ? 'Saving...' : 'Save Answer'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || questions.length === 0 || !attemptId}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {submitting ? 'Submitting...' : 'Submit Attempt'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
            No questions are available for this attempt yet.
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-card/80 p-3">
          <p className="text-xs text-muted-foreground">Question</p>
          <p className="mt-1 text-lg font-bold tracking-tight">{currentIndex + 1} / {Math.max(questions.length, 1)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/80 p-3">
          <p className="text-xs text-muted-foreground">Answered</p>
          <p className="mt-1 text-lg font-bold tracking-tight">{answeredCount}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/80 p-3">
          <p className="text-xs text-muted-foreground">Completion</p>
          <p className="mt-1 text-lg font-bold tracking-tight">{progressPercent}%</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/80 p-3">
          <p className="text-xs text-muted-foreground">Target</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-lg font-bold tracking-tight">
            <Target size={15} className="text-teal-300" />
            Submit Once
          </p>
        </div>
      </div>
    </div>
  );
}
