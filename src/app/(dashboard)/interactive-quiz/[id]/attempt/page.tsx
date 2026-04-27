"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTestAuth as useAuth } from '@/hooks/use-test-auth';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  ShieldAlert,
  Sparkles,
  Timer,
  Trophy,
  XCircle,
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
  module_type?: 'classic' | 'interactive_quiz';
  interactive_settings?: InteractiveSettings;
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

interface AttemptRecord {
  id: string;
  status: 'in_progress' | 'submitted';
}

interface FeedbackState {
  isCorrect: boolean;
  points: number;
  selectedOption: string;
  correctOption: string | null;
  timedOut: boolean;
}

interface TabSwitchPopupState {
  step: 1 | 2;
  message: string;
  dismissible?: boolean;
}

const DEFAULT_SETTINGS: InteractiveSettings = {
  question_timer_seconds: 40,
  max_points_per_question: 500,
  randomize_questions: true,
  randomize_options: true,
  difficulty_profile: 'mixed',
};

function normalizeInteractiveSettings(settings: Partial<InteractiveSettings> | null | undefined): InteractiveSettings {
  const timer = typeof settings?.question_timer_seconds === 'number' && Number.isFinite(settings.question_timer_seconds)
    ? Math.round(settings.question_timer_seconds)
    : DEFAULT_SETTINGS.question_timer_seconds;

  const points = typeof settings?.max_points_per_question === 'number' && Number.isFinite(settings.max_points_per_question)
    ? Math.round(settings.max_points_per_question)
    : DEFAULT_SETTINGS.max_points_per_question;

  return {
    question_timer_seconds: Math.max(10, Math.min(300, timer)),
    max_points_per_question: Math.max(50, Math.min(2000, points)),
    randomize_questions: settings?.randomize_questions ?? DEFAULT_SETTINGS.randomize_questions,
    randomize_options: settings?.randomize_options ?? DEFAULT_SETTINGS.randomize_options,
    difficulty_profile: settings?.difficulty_profile ?? DEFAULT_SETTINGS.difficulty_profile,
  };
}

function stableHash(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seedText: string): T[] {
  const out = [...items];
  let seed = stableHash(seedText) || 1;

  const nextRandom = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRandom() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

function formatSeconds(seconds: number) {
  const whole = Math.max(0, seconds);
  const mins = Math.floor(whole / 60)
    .toString()
    .padStart(2, '0');
  const secs = (whole % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function InteractiveQuizAttemptPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();

  const testId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const isStudent = user?.role === 'student';

  const [test, setTest] = useState<Test | null>(null);
  const [settings, setSettings] = useState<InteractiveSettings>(DEFAULT_SETTINGS);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_SETTINGS.question_timer_seconds);
  const [processingAnswer, setProcessingAnswer] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timingByQuestion, setTimingByQuestion] = useState<Record<string, number>>({});
  const [pointsByQuestion, setPointsByQuestion] = useState<Record<string, number>>({});
  const [pendingOptionKey, setPendingOptionKey] = useState<string | null>(null);

  const [tabSwitchPopup, setTabSwitchPopup] = useState<TabSwitchPopupState | null>(null);
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);

  const questionStartedAtRef = useRef<number>(Date.now());
  const advancingRef = useRef(false);
  const violationCountRef = useRef(0);
  const lastTabSwitchAtRef = useRef(0);
  const forceSubmitInProgressRef = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  const timingRef = useRef<Record<string, number>>({});

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    timingRef.current = timingByQuestion;
  }, [timingByQuestion]);

  const currentQuestion = questions[currentIndex] ?? null;

  const totalPoints = useMemo(
    () => Object.values(pointsByQuestion).reduce((sum, points) => sum + points, 0),
    [pointsByQuestion],
  );

  const answeredCount = useMemo(
    () => Object.keys(timingByQuestion).length,
    [timingByQuestion],
  );

  const progressPercent = questions.length > 0
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  const goToLeaderboard = useCallback(
    (resolvedAttemptId: string) => {
      if (!testId) return;
      router.push(`/interactive-quiz/${testId}/leaderboard?attemptId=${encodeURIComponent(resolvedAttemptId)}`);
    },
    [router, testId],
  );

  const submitQuiz = useCallback(async () => {
    if (!testId || !attemptId || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/tests/${testId}/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answersRef.current,
          mode: 'interactive_quiz',
          timing_by_question: timingRef.current,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.attempt) {
        setError(data.error || 'Unable to submit interactive quiz.');
        return;
      }

      goToLeaderboard(attemptId);
    } catch {
      setError('Unable to submit interactive quiz.');
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, goToLeaderboard, submitting, testId]);

  const recordViolation = useCallback(
    async (
      eventType: 'tab_switch',
      actionTaken: 'warned' | 'force_submitted',
      payload?: Record<string, unknown>,
    ) => {
      if (!attemptId || !testId) return;
      try {
        await fetch(`/api/tests/${testId}/attempts/${attemptId}/violations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: eventType,
            action_taken: actionTaken,
            event_payload: payload ?? {},
            occurred_at: new Date().toISOString(),
          }),
        });
      } catch {
        // Logging failures should not block the attempt UI.
      }
    },
    [attemptId, testId],
  );

  const forceSubmitForViolation = useCallback(async () => {
    if (!testId || !attemptId || forceSubmitInProgressRef.current) {
      return;
    }

    forceSubmitInProgressRef.current = true;
    setAutoSubmitTriggered(true);
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/tests/${testId}/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answersRef.current,
          mode: 'interactive_quiz',
          timing_by_question: timingRef.current,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.attempt) {
        setError(data.error || 'Unable to auto-submit attempt after violation.');
        setTabSwitchPopup({
          step: 2,
          message: 'Auto-submit failed. Please finish the quiz manually now.',
          dismissible: true,
        });
        return;
      }

      setTabSwitchPopup({
        step: 2,
        message: 'Test auto submitted. Redirecting to your result...',
      });

      window.setTimeout(() => {
        forceSubmitInProgressRef.current = false;
        goToLeaderboard(attemptId);
      }, 1300);
    } catch {
      setError('Unable to auto-submit attempt after violation.');
      setTabSwitchPopup({
        step: 2,
        message: 'Auto-submit failed. Please finish the quiz manually now.',
        dismissible: true,
      });
      forceSubmitInProgressRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, goToLeaderboard, testId]);

  const advanceAfterFeedback = useCallback(async () => {
    if (advancingRef.current) {
      return;
    }

    advancingRef.current = true;

    if (currentIndex >= questions.length - 1) {
      setFeedback(null);
      setPendingOptionKey(null);
      await submitQuiz();
      advancingRef.current = false;
      return;
    }

    setFeedback(null);
    setPendingOptionKey(null);
    setCurrentIndex((previous) => Math.min(previous + 1, questions.length - 1));
    advancingRef.current = false;
  }, [currentIndex, questions.length, submitQuiz]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    // Auto-close feedback and advance to the next question. Slightly longer for
    // wrong/timed-out answers so the student can read the correct option.
    const dwellMs = feedback.isCorrect ? 700 : 950;
    const timeoutId = window.setTimeout(() => {
      void advanceAfterFeedback();
    }, dwellMs);

    return () => window.clearTimeout(timeoutId);
  }, [advanceAfterFeedback, feedback]);

  useEffect(() => {
    if (!testId || !user || !isStudent) {
      return;
    }

    const controller = new AbortController();

    const loadContext = async () => {
      try {
        setLoading(true);
        setError(null);

        const [testResponse, questionsResponse] = await Promise.all([
          fetch(`/api/tests/${testId}`, { signal: controller.signal }),
          fetch(`/api/tests/${testId}/questions`, { signal: controller.signal }),
        ]);

        const [testData, questionsData] = await Promise.all([
          testResponse.json(),
          questionsResponse.json(),
        ]);

        if (!testResponse.ok || !testData?.test) {
          setError(testData.error || 'Unable to load interactive quiz.');
          return;
        }

        const loadedTest = testData.test as Test;
        if (loadedTest.module_type !== 'interactive_quiz') {
          router.replace(`/tests/${testId}/attempt`);
          return;
        }

        const attemptResponse = await fetch(`/api/tests/${testId}/attempts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: user.id,
            student_name: user.displayName,
          }),
          signal: controller.signal,
        });

        const attemptData = await attemptResponse.json();
        if (!attemptResponse.ok || !attemptData?.attempt) {
          setError(attemptData.error || 'Unable to start this quiz. Enter test code first.');
          return;
        }

        const attempt = attemptData.attempt as AttemptRecord;
        if (attempt.status === 'submitted') {
          goToLeaderboard(attempt.id);
          return;
        }

        const resolvedSettings = normalizeInteractiveSettings(loadedTest.interactive_settings);
        const rawQuestions = (questionsData.questions || []) as Question[];
        const mcqQuestions = rawQuestions.filter((question) => question.question_type === 'mcq' && question.options.length >= 2);

        let orderedQuestions = mcqQuestions;

        if (resolvedSettings.randomize_questions) {
          orderedQuestions = seededShuffle(orderedQuestions, `iq_questions_${attempt.id}`);
        }

        if (resolvedSettings.randomize_options) {
          orderedQuestions = orderedQuestions.map((question) => ({
            ...question,
            options: seededShuffle(question.options, `iq_options_${attempt.id}_${question.id}`),
          }));
        }

        setTest(loadedTest);
        setSettings(resolvedSettings);
        setQuestions(orderedQuestions);
        setAttemptId(attempt.id);
        setRemainingSeconds(resolvedSettings.question_timer_seconds);
        questionStartedAtRef.current = Date.now();
      } catch (requestError) {
        if ((requestError as Error).name !== 'AbortError') {
          setError('Unable to load interactive quiz attempt.');
        }
      } finally {
        setLoading(false);
      }
    };

    void loadContext();

    return () => controller.abort();
  }, [goToLeaderboard, isStudent, router, testId, user]);

  useEffect(() => {
    if (!currentQuestion) {
      return;
    }

    setRemainingSeconds(settings.question_timer_seconds);
    questionStartedAtRef.current = Date.now();
    setPendingOptionKey(null);
  }, [currentQuestion, settings.question_timer_seconds]);

  useEffect(() => {
    if (loading || submitting || !currentQuestion || feedback) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [currentQuestion, feedback, loading, submitting]);

  useEffect(() => {
    if (loading || !attemptId || !testId || autoSubmitTriggered) {
      return;
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;

      const now = Date.now();
      if (now - lastTabSwitchAtRef.current < 1000) {
        return;
      }
      lastTabSwitchAtRef.current = now;

      const nextCount = violationCountRef.current + 1;
      violationCountRef.current = nextCount;

      if (nextCount === 1) {
        setTabSwitchPopup({
          step: 1,
          message: 'Warning: tab switch detected. Another switch will auto-submit your quiz.',
          dismissible: true,
        });
        void recordViolation('tab_switch', 'warned', {
          source: 'interactive_quiz_ui',
          visibility_state: document.visibilityState,
          tab_switch_count: nextCount,
        });
      } else {
        setTabSwitchPopup({
          step: 2,
          message: 'Second tab switch detected. Auto-submitting your quiz now.',
        });
        void recordViolation('tab_switch', 'force_submitted', {
          source: 'interactive_quiz_ui',
          visibility_state: document.visibilityState,
          tab_switch_count: nextCount,
        });
        void forceSubmitForViolation();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [attemptId, autoSubmitTriggered, forceSubmitForViolation, loading, recordViolation, testId]);

  useEffect(() => {
    if (!currentQuestion || feedback || submitting || processingAnswer) {
      return;
    }

    if (remainingSeconds > 0) {
      return;
    }

    setTimingByQuestion((previous) => {
      if (previous[currentQuestion.id] !== undefined) {
        return previous;
      }
      return {
        ...previous,
        [currentQuestion.id]: settings.question_timer_seconds,
      };
    });

    setPointsByQuestion((previous) => ({
      ...previous,
      [currentQuestion.id]: 0,
    }));

    setFeedback({
      isCorrect: false,
      points: 0,
      selectedOption: '',
      correctOption: null,
      timedOut: true,
    });
  }, [currentQuestion, feedback, processingAnswer, remainingSeconds, settings.question_timer_seconds, submitting]);

  const handleOptionSelect = async (optionKey: string) => {
    if (!currentQuestion || !attemptId || !testId || processingAnswer || feedback || pendingOptionKey) {
      return;
    }

    if (timingByQuestion[currentQuestion.id] !== undefined) {
      return;
    }

    // Highlight the chosen option immediately so the click feels instant even
    // if the network round-trip to /interactive/check takes a beat.
    setPendingOptionKey(optionKey);
    setProcessingAnswer(true);
    setError(null);

    const elapsedSeconds = Math.max(
      0,
      Math.min(
        settings.question_timer_seconds,
        Math.round((Date.now() - questionStartedAtRef.current) / 1000),
      ),
    );

    try {
      const response = await fetch(`/api/tests/${testId}/interactive/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: attemptId,
          question_id: currentQuestion.id,
          selected_option: optionKey,
          elapsed_seconds: elapsedSeconds,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Unable to evaluate this answer.');
        setPendingOptionKey(null);
        return;
      }

      const earnedPoints = typeof data.points === 'number' ? data.points : 0;
      const isCorrect = data.is_correct === true;
      const correctOption = typeof data.correct_option === 'string' ? data.correct_option : null;

      setAnswers((previous) => ({
        ...previous,
        [currentQuestion.id]: optionKey,
      }));

      setTimingByQuestion((previous) => ({
        ...previous,
        [currentQuestion.id]: elapsedSeconds,
      }));

      setPointsByQuestion((previous) => ({
        ...previous,
        [currentQuestion.id]: earnedPoints,
      }));

      setFeedback({
        isCorrect,
        points: earnedPoints,
        selectedOption: optionKey,
        correctOption,
        timedOut: false,
      });
    } catch {
      setError('Unable to evaluate this answer.');
      setPendingOptionKey(null);
    } finally {
      setProcessingAnswer(false);
    }
  };

  if (!isStudent) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center text-amber-200">
          <h2 className="text-xl font-semibold tracking-tight">Student Access Required</h2>
          <p className="mt-1 text-sm text-amber-200/80">
            Interactive quiz attempts are available only for student accounts.
          </p>
          <Link
            href={testId ? `/tests/${testId}` : '/tests'}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            Back to Tests
          </Link>
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
            Loading interactive quiz...
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
              <p className="font-semibold">Unable to open interactive quiz</p>
              <p className="mt-1 text-sm text-red-300/90">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!test || !currentQuestion || questions.length === 0) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-10 text-center">
          <h2 className="text-lg font-semibold tracking-tight">No interactive questions available</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This quiz has no MCQ questions yet. Ask your faculty to add interactive MCQs.
          </p>
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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_45%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_45%)]" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/tests"
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Back to Tests
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/20 bg-orange-400/[0.07] px-3 py-1 text-xs font-semibold text-orange-200">
            <Sparkles size={11} />
            Interactive Quiz
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{test.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Select an option quickly. Correct answers earn speed-based points.
          </p>
        </div>

        <div className="grid gap-2 text-right">
          <div className="inline-flex items-center justify-end gap-1.5 rounded-lg border border-border/70 bg-card/80 px-3 py-2 text-sm font-semibold text-foreground">
            <Timer size={14} className="text-orange-200" />
            {formatSeconds(remainingSeconds)}
          </div>
          <div className="inline-flex items-center justify-end gap-1.5 rounded-lg border border-border/70 bg-card/80 px-3 py-2 text-sm font-semibold text-foreground">
            <Trophy size={14} className="text-amber-200" />
            {totalPoints} pts
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-border/70 bg-card/80 p-4">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span>Progress</span>
          <span>{answeredCount}/{questions.length}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-300 to-amber-400 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-xl shadow-black/10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 size={12} />
            {settings.question_timer_seconds}s timer
          </p>
        </div>

        <h2 className="text-lg font-semibold tracking-tight">{currentQuestion.text}</h2>

        <div className="mt-4 grid gap-2">
          {currentQuestion.options.map((option) => {
            const disabled = processingAnswer || !!feedback || timingByQuestion[currentQuestion.id] !== undefined || submitting || !!pendingOptionKey;
            const isPending = pendingOptionKey === option.key;
            return (
              <button
                key={`${currentQuestion.id}_${option.key}`}
                type="button"
                onClick={() => void handleOptionSelect(option.key)}
                disabled={disabled}
                aria-pressed={isPending}
                className={`group rounded-xl border px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed ${
                  isPending
                    ? 'border-orange-400/60 bg-orange-400/15 text-foreground shadow-[0_0_0_1px_rgba(251,146,60,0.35)]'
                    : 'border-border/70 bg-background/70 hover:border-orange-300/40 hover:bg-orange-400/[0.06]'
                } ${disabled && !isPending ? 'opacity-60' : ''}`}
              >
                <span className={`inline-flex w-7 shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${
                  isPending
                    ? 'border-orange-400/60 bg-orange-400/20 text-orange-100'
                    : 'border-border/70 bg-background/80 text-muted-foreground'
                }`}>
                  {option.key}
                </span>
                <span className="ml-3 text-foreground">{option.text}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Difficulty: {settings.difficulty_profile}</span>
          <button
            onClick={() => void submitQuiz()}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-3 py-1.5 text-xs font-medium transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : null}
            Finish Quiz
          </button>
        </div>
      </section>

      {tabSwitchPopup && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/35 bg-zinc-950/95 p-6 shadow-2xl shadow-black/50 backdrop-blur">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-500/15 text-amber-200">
              {tabSwitchPopup.step === 1 ? <ShieldAlert size={22} /> : <AlertTriangle size={22} />}
            </div>

            <h2 className="mt-4 text-center text-xl font-bold tracking-tight text-amber-100">
              {tabSwitchPopup.step === 1 ? 'Tab Switch Warning' : 'Quiz Submitted'}
            </h2>
            <p className="mt-2 text-center text-sm text-amber-100/85">{tabSwitchPopup.message}</p>

            {tabSwitchPopup.dismissible ? (
              <button
                type="button"
                onClick={() => setTabSwitchPopup(null)}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-orange-500/20 transition hover:brightness-110"
              >
                {tabSwitchPopup.step === 1 ? 'Continue Quiz' : 'Close'}
              </button>
            ) : (
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-amber-100/80">
                <Loader2 size={14} className="animate-spin" />
                Redirecting...
              </div>
            )}
          </div>
        </div>
      )}

      {feedback && (
        <div
          className="pointer-events-none fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-card/95 p-6 text-center shadow-2xl shadow-black/40">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/70">
              {feedback.isCorrect ? (
                <CheckCircle2 size={24} className="text-emerald-300" />
              ) : (
                <XCircle size={24} className="text-rose-300" />
              )}
            </div>

            <h3 className="mt-3 text-xl font-bold tracking-tight">
              {feedback.timedOut
                ? 'Time Up'
                : feedback.isCorrect
                  ? 'Correct Answer'
                  : 'Wrong Answer'}
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              {feedback.timedOut
                ? 'You did not answer in time for this question.'
                : feedback.isCorrect
                  ? 'Great speed. You earned points for this answer.'
                  : 'No points for this one. Stay sharp for the next question.'}
            </p>

            <div className={`mt-4 rounded-xl border px-3 py-2 text-sm font-semibold ${
              feedback.isCorrect
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            }`}>
              {feedback.isCorrect ? `+${feedback.points} points` : '+0 points'}
            </div>

            {!feedback.isCorrect && feedback.correctOption && !feedback.timedOut && (
              <p className="mt-3 text-xs text-muted-foreground">
                Correct option: <span className="font-semibold text-foreground">{feedback.correctOption}</span>
              </p>
            )}

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              Next question loading...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
