"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTestAuth as useAuth } from '@/hooks/use-test-auth';
import {
  createClipboardIntegrityManager,
  getSuspiciousShortcutDescriptor,
  getViewportCoverageRatio,
  isEditableClipboardTarget,
  TEST_PROCTORING_CONFIG,
} from '@/lib/test/tamper-detection';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
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
  module_type?: 'classic' | 'interactive_quiz';
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
  violation_count?: number;
  violation_events?: ViolationEvent[];
}

interface ViolationEvent {
  id: string;
  event_type: 'tab_switch' | 'blur' | 'copy' | 'paste' | 'cut' | 'context_menu';
  action_taken: 'logged' | 'warned' | 'blocked' | 'force_submitted';
  event_payload?: Record<string, unknown> | null;
  occurred_at: string;
}

interface TabSwitchPopupState {
  step: 1 | 2;
  message: string;
  dismissible?: boolean;
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

function randomizeQuestionsForAttempt(inputQuestions: Question[], attemptId: string): Question[] {
  const reorderedQuestions = seededShuffle(inputQuestions, `questions_${attemptId}`);

  return reorderedQuestions.map((question) => {
    if (question.question_type !== 'mcq' || question.options.length <= 1) {
      return {
        ...question,
        options: [...question.options],
      };
    }

    return {
      ...question,
      options: seededShuffle(question.options, `options_${attemptId}_${question.id}`),
    };
  });
}

function formatViolationEventType(eventType: ViolationEvent['event_type']) {
  switch (eventType) {
    case 'tab_switch':
      return 'Tab switch';
    case 'blur':
      return 'Focus loss';
    case 'copy':
      return 'Copy';
    case 'paste':
      return 'Paste';
    case 'cut':
      return 'Cut';
    case 'context_menu':
      return 'Right-click blocked';
    default:
      return 'Violation';
  }
}

export default function TestAttemptPage() {
  const router = useRouter();
  const params = useParams();
  const { user, hydrated, isAuthenticated } = useAuth();

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
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const answersRef = useRef<Record<string, string>>({});
  const saveInFlightRef = useRef(false);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const lastSavedSnapshotRef = useRef('{}');
  const lastSavedAnswersRef = useRef<Record<string, string>>({});
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  const scheduleAutoSaveRef = useRef<(() => void) | null>(null);
  const violationCountRef = useRef(0);
  const lastPrimaryViolationAtRef = useRef(0);
  const blurStartedAtRef = useRef<number | null>(null);
  const viewportDropStartedAtRef = useRef<number | null>(null);
  const maxViewportCoverageRef = useRef(0);
  const hadFullscreenRef = useRef(false);
  const blockedEventLastAtRef = useRef<Record<string, number>>({});
  const clipboardManagerRef = useRef(createClipboardIntegrityManager({
    ttlMs: TEST_PROCTORING_CONFIG.clipboard.ttlMs,
    maxEntries: TEST_PROCTORING_CONFIG.clipboard.maxEntries,
    maxTrackedTextLength: TEST_PROCTORING_CONFIG.clipboard.maxTrackedTextLength,
  }));
  const forceSubmitInProgressRef = useRef(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [violationTimeline, setViolationTimeline] = useState<ViolationEvent[]>([]);
  const [integrityNotice, setIntegrityNotice] = useState<string | null>(null);
  const [tabSwitchPopup, setTabSwitchPopup] = useState<TabSwitchPopupState | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState(30 * 60);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace(`/tests/login?next=${encodeURIComponent(`/tests/${testId ?? ''}/attempt`)}`);
    }
  }, [hydrated, isAuthenticated, router, testId, user]);

  useEffect(() => {
    if (!testId || !user || !isStudent || !hydrated || !isAuthenticated) return;

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

        if ((testData.test as Test).module_type === 'interactive_quiz') {
          router.replace(`/interactive-quiz/${testId}/attempt`);
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
        const loadedQuestions = (questionsData.questions || []) as Question[];
        const randomizedQuestions = randomizeQuestionsForAttempt(loadedQuestions, attempt.id);
        const initialViolationCount = typeof attempt.violation_count === 'number' ? attempt.violation_count : 0;
        const initialTimeline = Array.isArray(attempt.violation_events)
          ? attempt.violation_events
          : [];

        setTest(testData.test || null);
        setQuestions(randomizedQuestions);
        setAttemptId(attempt.id);
        setSubmitted(attempt.status === 'submitted');
        setAutoSubmitTriggered(attempt.status === 'submitted');
        setViolationCount(initialViolationCount);
        violationCountRef.current = initialViolationCount;
        setViolationTimeline(initialTimeline);

        const mappedAnswers: Record<string, string> = {};
        for (const answer of attempt.answers || []) {
          mappedAnswers[answer.question_id] = answer.answer;
        }
        setAnswers(mappedAnswers);
        answersRef.current = mappedAnswers;
        lastSavedSnapshotRef.current = JSON.stringify(mappedAnswers);
        lastSavedAnswersRef.current = { ...mappedAnswers };
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
  }, [hydrated, isAuthenticated, isStudent, router, testId, user]);

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
          body: JSON.stringify({ answers: answersRef.current }),
        });
        const data = await res.json();

        if (!res.ok || !data?.attempt) {
          setError(data.error || 'Unable to auto-submit attempt.');
          return;
        }

        const resolvedAttemptId =
          data?.attempt && typeof data.attempt.id === 'string'
            ? data.attempt.id
            : attemptId;

        setSubmitted(true);
        setSaveMessage('Time is up. Your attempt was auto-submitted.');
        window.setTimeout(() => {
          router.replace(
            `/tests/${testId}/result?attemptId=${encodeURIComponent(resolvedAttemptId)}`,
          );
        }, 900);
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
    loading,
    questions.length,
    remainingSeconds,
    submitted,
    submitting,
    testId,
    router,
  ]);

  useEffect(() => {
    if (!integrityNotice) return;

    const timeoutId = setTimeout(() => {
      setIntegrityNotice(null);
    }, TEST_PROCTORING_CONFIG.violation.integrityNoticeDurationMs);

    return () => clearTimeout(timeoutId);
  }, [integrityNotice]);

  const currentQuestion = questions[currentIndex] ?? null;

  const answeredCount = useMemo(
    () => questions.filter((question) => (answers[question.id] ?? '').trim().length > 0).length,
    [questions, answers],
  );

  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const recordViolation = useCallback(
    async (
      eventType: ViolationEvent['event_type'],
      actionTaken: ViolationEvent['action_taken'],
      payload?: Record<string, unknown>,
    ) => {
      if (!attemptId || !testId) return null;

      try {
        const occurredAt = new Date().toISOString();
        const res = await fetch(`/api/tests/${testId}/attempts/${attemptId}/violations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: eventType,
            action_taken: actionTaken,
            event_payload: payload ?? {},
            occurred_at: occurredAt,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data?.event) {
          return null;
        }

        const event = data.event as ViolationEvent & { violation_count?: unknown };

        if (typeof event.violation_count === 'number') {
          violationCountRef.current = event.violation_count;
          setViolationCount(event.violation_count);
        }

        setViolationTimeline((prev) => [
          ...prev,
          {
            id: event.id,
            event_type: event.event_type,
            action_taken: event.action_taken,
            event_payload: event.event_payload ?? null,
            occurred_at: event.occurred_at,
          },
        ]);

        return event;
      } catch {
        return null;
      }
    },
    [attemptId, testId],
  );

  const persistAnswers = useCallback(
    async (mode: 'manual' | 'auto') => {
      if (!attemptId || !testId || submitted) return false;

      const snapshot = JSON.stringify(answersRef.current);

      if (mode === 'auto' && snapshot === lastSavedSnapshotRef.current) {
        return true;
      }

      if (saveInFlightRef.current) {
        // Mark that another save is needed once the in-flight one finishes,
        // so the latest answer is never lost.
        pendingSaveRef.current = true;
        return savePromiseRef.current ?? false;
      }

      saveInFlightRef.current = true;

      if (mode === 'manual') {
        setSaveMessage(null);
        setError(null);
      }
      setAutoSaveStatus('saving');

      const previousAnswers = lastSavedAnswersRef.current;
      const currentAnswers = answersRef.current;
      const candidateKeys = new Set([
        ...Object.keys(previousAnswers),
        ...Object.keys(currentAnswers),
      ]);

      const changedAnswers: Record<string, string> = {};
      for (const key of candidateKeys) {
        const previousValue = previousAnswers[key] ?? '';
        const currentValue = currentAnswers[key] ?? '';

        if (currentValue !== previousValue) {
          changedAnswers[key] = currentValue;
        }
      }

      if (Object.keys(changedAnswers).length === 0) {
        lastSavedSnapshotRef.current = snapshot;
        lastSavedAnswersRef.current = { ...currentAnswers };
        saveInFlightRef.current = false;
        savePromiseRef.current = null;
        setAutoSaveStatus('idle');
        if (mode === 'manual') {
          setSaveMessage('Answers are already up to date.');
        }
        return true;
      }

      const savePromise = (async () => {
        try {
          const res = await fetch(`/api/tests/${testId}/attempts/${attemptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: changedAnswers }),
          });
          const data = await res.json();

          if (!res.ok || (!data?.attempt && !data?.ok)) {
            if (mode === 'manual') {
              setError(data.error || 'Unable to save answers.');
            }
            return false;
          }

          lastSavedSnapshotRef.current = snapshot;
          lastSavedAnswersRef.current = { ...currentAnswers };

          if (mode === 'manual') {
            setSaveMessage('Answers saved successfully.');
          }

          setAutoSaveStatus('saved');
          if (savedIndicatorTimerRef.current) {
            clearTimeout(savedIndicatorTimerRef.current);
          }
          savedIndicatorTimerRef.current = setTimeout(() => {
            setAutoSaveStatus('idle');
          }, 1500);

          return true;
        } catch {
          if (mode === 'manual') {
            setError('Unable to save answers.');
          }
          setAutoSaveStatus('idle');
          return false;
        } finally {
          saveInFlightRef.current = false;
          savePromiseRef.current = null;
          if (pendingSaveRef.current) {
            pendingSaveRef.current = false;
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setTimeout(() => {
              scheduleAutoSaveRef.current?.();
            }, 50);
          }
        }
      })();

      savePromiseRef.current = savePromise;
      return savePromise;
    },
    [attemptId, submitted, testId],
  );

  const forceSubmitForViolation = useCallback(async () => {
    if (!questions.length || !attemptId || !testId || submitted || forceSubmitInProgressRef.current) {
      return;
    }

    forceSubmitInProgressRef.current = true;
    setAutoSubmitTriggered(true);
    setSubmitting(true);
    setSaveMessage(null);
    setError(null);

    let forceSubmitSucceeded = false;

    try {
      await persistAnswers('auto');

      const res = await fetch(`/api/tests/${testId}/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersRef.current }),
      });
      const data = await res.json();

      if (!res.ok || !data?.attempt) {
        setError(data.error || 'Unable to force-submit attempt after violation.');
        setTabSwitchPopup({
          step: 2,
          message: 'Auto-submit failed. Please submit manually now.',
          dismissible: true,
        });
        return;
      }

      forceSubmitSucceeded = true;
      setSaveMessage('Attempt auto-submitted after repeated integrity violations.');
      setTabSwitchPopup({
        step: 2,
        message: 'Test auto submitted. Redirecting to your result...',
      });

      const resultPath = `/tests/${testId}/result${attemptId ? `?attemptId=${encodeURIComponent(attemptId)}` : ''}`;
      window.setTimeout(() => {
        forceSubmitInProgressRef.current = false;
        router.replace(resultPath);
      }, 1300);
    } catch {
      setError('Unable to force-submit attempt after violation.');
      setTabSwitchPopup({
        step: 2,
        message: 'Auto-submit failed. Please submit manually now.',
        dismissible: true,
      });
    } finally {
      setSubmitting(false);
      if (!forceSubmitSucceeded) {
        forceSubmitInProgressRef.current = false;
      }
    }
  }, [attemptId, persistAnswers, questions.length, router, submitted, testId]);

  useEffect(() => {
    if (loading || submitted || !attemptId || !testId) return;

    const PRIMARY_VIOLATION_COOLDOWN_MS = TEST_PROCTORING_CONFIG.violation.primaryCooldownMs;
    const MAX_WARNINGS = TEST_PROCTORING_CONFIG.violation.maxWarnings;
    const BLUR_MIN_DURATION_MS = TEST_PROCTORING_CONFIG.focus.blurMinDurationMs;
    const VIEWPORT_DROP_THRESHOLD = TEST_PROCTORING_CONFIG.focus.viewportDropThreshold;
    const VIEWPORT_DROP_MIN_DURATION_MS = TEST_PROCTORING_CONFIG.focus.viewportDropMinDurationMs;
    const CLIPBOARD_LOG_THROTTLE_MS = TEST_PROCTORING_CONFIG.clipboard.logThrottleMs;
    const FOCUS_POLL_INTERVAL_MS = TEST_PROCTORING_CONFIG.focus.pollIntervalMs;

    const logClipboardEvent = (options: {
      eventType: Extract<ViolationEvent['event_type'], 'copy' | 'paste' | 'cut' | 'context_menu'>;
      actionTaken: Extract<ViolationEvent['action_taken'], 'logged' | 'blocked'>;
      payload: Record<string, unknown>;
      notice?: string;
      throttleMs?: number;
    }) => {
      const now = Date.now();
      const key = `${options.eventType}:${options.actionTaken}`;
      const previous = blockedEventLastAtRef.current[key] ?? 0;
      const throttleMs = options.throttleMs ?? CLIPBOARD_LOG_THROTTLE_MS;
      if (now - previous < throttleMs) {
        return;
      }

      blockedEventLastAtRef.current[key] = now;
      if (options.notice) {
        setIntegrityNotice(options.notice);
      }

      void recordViolation(options.eventType, options.actionTaken, options.payload);
    };

    const raisePrimaryViolation = (
      eventType: Extract<ViolationEvent['event_type'], 'tab_switch' | 'blur'>,
      reason: string,
      payload: Record<string, unknown> = {},
    ) => {
      if (submitted || submitting || autoSubmitTriggered || forceSubmitInProgressRef.current) {
        return;
      }

      const now = Date.now();
      if (now - lastPrimaryViolationAtRef.current < PRIMARY_VIOLATION_COOLDOWN_MS) {
        return;
      }

      lastPrimaryViolationAtRef.current = now;
      blurStartedAtRef.current = null;

      const nextCount = violationCountRef.current + 1;
      const actionTaken: ViolationEvent['action_taken'] = nextCount > MAX_WARNINGS
        ? 'force_submitted'
        : 'warned';

      violationCountRef.current = nextCount;
      setViolationCount(nextCount);

      if (nextCount <= MAX_WARNINGS) {
        const warningsLeft = MAX_WARNINGS - nextCount;
        setTabSwitchPopup({
          step: 1,
          message: warningsLeft > 0
            ? `Warning ${nextCount}/${MAX_WARNINGS}: focus loss detected. ${warningsLeft} warning${warningsLeft === 1 ? '' : 's'} left before auto-submit.`
            : `Final warning (${MAX_WARNINGS}/${MAX_WARNINGS}): next integrity violation will auto-submit your attempt.`,
          dismissible: true,
        });
      } else {
        setTabSwitchPopup({
          step: 2,
          message: `Integrity violation ${nextCount} detected. Auto-submitting your attempt now.`,
        });
      }

      void recordViolation(eventType, actionTaken, {
        source: 'attempt_ui',
        reason,
        has_focus: document.hasFocus(),
        visibility_state: document.visibilityState,
        violation_count: nextCount,
        ...payload,
      });

      if (nextCount > MAX_WARNINGS) {
        void forceSubmitForViolation();
      }
    };

    const startBlurWindow = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      if (blurStartedAtRef.current === null) {
        blurStartedAtRef.current = Date.now();
      }
    };

    const finalizeBlurWindow = (reason: string) => {
      const startedAt = blurStartedAtRef.current;
      blurStartedAtRef.current = null;

      if (!startedAt || document.visibilityState === 'hidden') {
        return;
      }

      const durationMs = Date.now() - startedAt;
      if (durationMs < BLUR_MIN_DURATION_MS) {
        return;
      }

      raisePrimaryViolation('blur', reason, {
        blur_duration_ms: durationMs,
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        viewportDropStartedAtRef.current = null;
        raisePrimaryViolation('tab_switch', 'visibility_hidden');
        return;
      }

      maxViewportCoverageRef.current = Math.max(
        maxViewportCoverageRef.current,
        getViewportCoverageRatio(),
      );
    };

    const onWindowBlur = () => {
      startBlurWindow();
    };

    const onWindowFocus = () => {
      finalizeBlurWindow('window_blur');
    };

    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        return;
      }

      raisePrimaryViolation('tab_switch', 'pagehide');
    };

    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        hadFullscreenRef.current = true;
        maxViewportCoverageRef.current = Math.max(
          maxViewportCoverageRef.current,
          getViewportCoverageRatio(),
        );
        return;
      }

      if (hadFullscreenRef.current) {
        raisePrimaryViolation('blur', 'fullscreen_exit', {
          fullscreen_active: false,
        });
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = getSuspiciousShortcutDescriptor(event);
      if (!shortcut) {
        return;
      }

      raisePrimaryViolation('blur', 'overlay_shortcut', {
        shortcut,
      });
    };

    const pollFocusAndViewport = () => {
      if (submitted || submitting || autoSubmitTriggered || forceSubmitInProgressRef.current) {
        blurStartedAtRef.current = null;
        viewportDropStartedAtRef.current = null;
        return;
      }

      if (document.visibilityState === 'hidden') {
        blurStartedAtRef.current = null;
        viewportDropStartedAtRef.current = null;
        return;
      }

      if (!document.hasFocus()) {
        startBlurWindow();
      } else {
        finalizeBlurWindow('focus_poll_loss');
      }

      const coverage = getViewportCoverageRatio();
      maxViewportCoverageRef.current = Math.max(maxViewportCoverageRef.current, coverage);
      const baselineCoverage = maxViewportCoverageRef.current;
      const coverageDrop = baselineCoverage - coverage;

      if (baselineCoverage >= 0.9 && coverageDrop >= VIEWPORT_DROP_THRESHOLD) {
        if (viewportDropStartedAtRef.current === null) {
          viewportDropStartedAtRef.current = Date.now();
          return;
        }

        if (Date.now() - viewportDropStartedAtRef.current >= VIEWPORT_DROP_MIN_DURATION_MS) {
          viewportDropStartedAtRef.current = Date.now();
          raisePrimaryViolation('blur', 'viewport_shrink', {
            baseline_coverage: Number(baselineCoverage.toFixed(3)),
            current_coverage: Number(coverage.toFixed(3)),
            coverage_drop: Number(coverageDrop.toFixed(3)),
          });
        }

        return;
      }

      viewportDropStartedAtRef.current = null;
    };

    const onCopy = (event: ClipboardEvent) => {
      const capture = clipboardManagerRef.current.captureInternalClipboardEvent(event, 'copy');
      if (!capture) {
        return;
      }

      logClipboardEvent({
        eventType: 'copy',
        actionTaken: 'logged',
        payload: {
          source: 'attempt_ui',
          outcome: 'internal_copy_allowed',
          digest: capture.digest,
          text_length: capture.textLength,
        },
      });
    };

    const onPaste = (event: ClipboardEvent) => {
      if (!isEditableClipboardTarget(event.target)) {
        return;
      }

      const decision = clipboardManagerRef.current.evaluatePasteEvent(event);
      if (decision.allow) {
        if (decision.reason === 'internal_match') {
          logClipboardEvent({
            eventType: 'paste',
            actionTaken: 'logged',
            payload: {
              source: 'attempt_ui',
              outcome: 'internal_paste_allowed',
              reason: decision.reason,
              digest: decision.digest,
              text_length: decision.textLength,
              match_age_ms: decision.matchAgeMs ?? null,
            },
          });
        }
        return;
      }

      event.preventDefault();
      logClipboardEvent({
        eventType: 'paste',
        actionTaken: 'blocked',
        payload: {
          source: 'attempt_ui',
          outcome: 'external_paste_blocked',
          reason: decision.reason,
          digest: decision.digest,
          text_length: decision.textLength,
        },
        notice: 'External paste is blocked during an active attempt. Copy from this attempt page to paste.',
      });
    };

    const onCut = (event: ClipboardEvent) => {
      const capture = clipboardManagerRef.current.captureInternalClipboardEvent(event, 'cut');
      if (!capture) {
        return;
      }

      logClipboardEvent({
        eventType: 'cut',
        actionTaken: 'logged',
        payload: {
          source: 'attempt_ui',
          outcome: 'internal_cut_allowed',
          digest: capture.digest,
          text_length: capture.textLength,
        },
      });
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      logClipboardEvent({
        eventType: 'context_menu',
        actionTaken: 'blocked',
        payload: {
          source: 'attempt_ui',
          outcome: 'context_menu_blocked',
        },
        notice: 'Right-click is disabled during an active attempt.',
      });
    };

    hadFullscreenRef.current = !!document.fullscreenElement;
    maxViewportCoverageRef.current = Math.max(
      maxViewportCoverageRef.current,
      getViewportCoverageRatio(),
    );

    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('cut', onCut);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('keydown', onKeyDown, true);

    const pollId = window.setInterval(pollFocusAndViewport, FOCUS_POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('keydown', onKeyDown, true);
      window.clearInterval(pollId);
    };
  }, [
    attemptId,
    autoSubmitTriggered,
    forceSubmitForViolation,
    loading,
    recordViolation,
    submitted,
    submitting,
    testId,
  ]);

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

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      void persistAnswers('auto');
    }, 600);
  }, [persistAnswers]);

  useEffect(() => {
    scheduleAutoSaveRef.current = scheduleAutoSave;
  }, [scheduleAutoSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
    };
  }, []);

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
        body: JSON.stringify({ answers: answersRef.current }),
      });
      const data = await res.json();

      if (!res.ok || !data?.attempt) {
        setError(data.error || 'Unable to submit attempt.');
        return;
      }

      const resolvedAttemptId =
        data?.attempt && typeof data.attempt.id === 'string'
          ? data.attempt.id
          : attemptId;

      setSubmitted(true);
      setAutoSubmitTriggered(true);
      setSaveMessage('Attempt submitted successfully.');
      router.replace(`/tests/${testId}/result?attemptId=${encodeURIComponent(resolvedAttemptId)}`);
    } catch {
      setError('Unable to submit attempt.');
    } finally {
      setSubmitting(false);
    }
  };

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

  if (error && !test) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5" />
            <div>
              <p className="font-semibold">Unable to open attempt</p>
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

      {integrityNotice && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {integrityNotice}
        </div>
      )}

      {tabSwitchPopup && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/35 bg-card/95 p-6 shadow-2xl shadow-black/50 backdrop-blur">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-500/15 text-amber-200">
              {tabSwitchPopup.step === 1 ? <ShieldAlert size={22} /> : <AlertTriangle size={22} />}
            </div>

            <h2 className="mt-4 text-center text-xl font-bold tracking-tight text-amber-100">
              {tabSwitchPopup.step === 1 ? 'Tab Switch Warning' : 'Attempt Submitted'}
            </h2>
            <p className="mt-2 text-center text-sm text-amber-100/85">{tabSwitchPopup.message}</p>

            {tabSwitchPopup.dismissible ? (
              <button
                type="button"
                onClick={() => setTabSwitchPopup(null)}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
              >
                {tabSwitchPopup.step === 1 ? 'Continue Test' : 'Close'}
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

      <div className="mb-4 rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Integrity Monitor</p>
          <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Violations: {violationCount}
          </span>
        </div>

        <div className="mt-2 space-y-1">
          {violationTimeline.length === 0 && (
            <p className="text-xs text-muted-foreground">No integrity events logged yet.</p>
          )}

          {violationTimeline.length > 0 && [...violationTimeline].slice(-4).reverse().map((event) => (
            <p key={event.id} className="text-xs text-muted-foreground">
              {new Date(event.occurred_at).toLocaleTimeString()} - {formatViolationEventType(event.event_type)} ({event.action_taken})
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
        <div className="mb-4 flex flex-wrap gap-2">
          {questions.map((question, index) => {
            const isActive = index === currentIndex;
            const isAnswered = (answers[question.id] ?? '').trim().length > 0;
            return (
              <button
                key={question.id}
                onClick={() => navigateToQuestion(index)}
                className={`h-8 w-8 rounded-full border text-xs font-semibold transition ${isActive
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
                          scheduleAutoSave();
                        }}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${isSelected
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
                    scheduleAutoSave();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIntegrityNotice('Drag-and-drop into the answer is disabled.');
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
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
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  {autoSaveStatus === 'saving' ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Saving...
                    </>
                  ) : autoSaveStatus === 'saved' ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      Saved
                    </>
                  ) : (
                    'Answers auto-save as you go'
                  )}
                </span>
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
