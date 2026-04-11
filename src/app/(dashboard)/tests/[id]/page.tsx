"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  Play,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCircle2,
  Users,
} from 'lucide-react';

interface Question {
  id: string;
  text: string;
  question_type: 'mcq' | 'sql_fill';
  options: Array<{
    key: string;
    text: string;
  }>;
  correct_answer?: string | null;
}

interface Assignment {
  id: string;
  user: string;
  role: 'student' | 'teacher';
}

interface Test {
  id: string;
  title: string;
  status: string;
  created_by: string;
  updated_at: string;
  test_code?: string | null;
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

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

const DEFAULT_MCQ_OPTIONS = [
  { key: 'A', text: '' },
  { key: 'B', text: '' },
  { key: 'C', text: '' },
  { key: 'D', text: '' },
];

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

export default function TestDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const testId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [newQuestion, setNewQuestion] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'mcq' | 'sql_fill'>('mcq');
  const [newQuestionAnswer, setNewQuestionAnswer] = useState('');
  const [newMcqOptions, setNewMcqOptions] = useState(DEFAULT_MCQ_OPTIONS);
  const [newMcqCorrectKey, setNewMcqCorrectKey] = useState('A');
  const [randomCount, setRandomCount] = useState('5');
  const [newAssignment, setNewAssignment] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'teacher'>('student');
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const [addingQuestion, setAddingQuestion] = useState(false);
  const [randomizingQuestions, setRandomizingQuestions] = useState(false);
  const [addingAssignment, setAddingAssignment] = useState(false);
  const [removingQuestionId, setRemovingQuestionId] = useState<string | null>(null);
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;

    const controller = new AbortController();

    const loadTest = async () => {
      setLoading(true);
      setError(null);

      try {
        const [testRes, questionsRes, assignmentsRes] = await Promise.all([
          fetch(`/api/tests/${testId}`, { signal: controller.signal }),
          fetch(`/api/tests/${testId}/questions${isTeacher ? '?view=teacher' : ''}`, { signal: controller.signal }),
          fetch(`/api/tests/${testId}/assignments`, { signal: controller.signal }),
        ]);

        const [testData, questionsData, assignmentsData] = await Promise.all([
          testRes.json(),
          questionsRes.json(),
          assignmentsRes.json(),
        ]);

        const loadedQuestions = (questionsData.questions || []) as Question[];
        const loadedAnswerDrafts = loadedQuestions.reduce<Record<string, string>>((acc, question) => {
          acc[question.id] = question.correct_answer
            ?? (question.question_type === 'mcq' ? question.options?.[0]?.key ?? '' : '');
          return acc;
        }, {});

        setTest(testData.test || null);
        setQuestions(loadedQuestions);
        setAnswerDrafts(loadedAnswerDrafts);
        setAssignments(assignmentsData.assignments || []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Failed to load test');
        }
      } finally {
        setLoading(false);
      }
    };

    loadTest();

    return () => controller.abort();
  }, [testId, isTeacher]);

  const stats = useMemo(
    () => ({
      questionCount: questions.length,
      assignmentCount: assignments.length,
      roleLabel: isTeacher ? 'Teacher Management' : 'Student View',
    }),
    [questions.length, assignments.length, isTeacher],
  );

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTeacher || !newQuestion.trim() || !testId) return;

    if (newQuestionType === 'mcq') {
      const normalizedOptions = newMcqOptions
        .map((option) => ({ key: option.key, text: option.text.trim() }))
        .filter((option) => option.text.length > 0);

      if (normalizedOptions.length < 2) {
        setActionError('Please provide at least 2 answer options for MCQ.');
        return;
      }

      if (!normalizedOptions.some((option) => option.key === newMcqCorrectKey)) {
        setActionError('Please select a valid correct option key for this MCQ.');
        return;
      }
    }

    setAddingQuestion(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newQuestion.trim(),
          question_type: newQuestionType,
          correct_answer: newQuestionType === 'mcq' ? newMcqCorrectKey : newQuestionAnswer.trim(),
          options: newQuestionType === 'mcq'
            ? newMcqOptions.map((option) => ({ key: option.key, text: option.text.trim() }))
            : undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.question) {
        setQuestions((prev) => [...prev, data.question]);
        setAnswerDrafts((prev) => ({
          ...prev,
          [data.question.id]: data.question.correct_answer
            ?? (data.question.question_type === 'mcq' ? data.question.options?.[0]?.key ?? '' : ''),
        }));
        setNewQuestion('');
        setNewQuestionAnswer('');
        setNewMcqOptions(DEFAULT_MCQ_OPTIONS.map((option) => ({ ...option })));
        setNewMcqCorrectKey('A');
      } else {
        setActionError(data.error || 'Unable to add question');
      }
    } catch {
      setActionError('Unable to add question');
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleRemoveQuestion = async (id: string) => {
    if (!isTeacher || !testId) return;

    setRemovingQuestionId(id);
    setActionError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/questions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setQuestions((prev) => prev.filter((question) => question.id !== id));
        setAnswerDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        const data = await res.json();
        setActionError(data.error || 'Unable to remove question');
      }
    } catch {
      setActionError('Unable to remove question');
    } finally {
      setRemovingQuestionId(null);
    }
  };

  const handleAddRandomQuestions = async () => {
    if (!isTeacher || !testId) return;

    const parsedCount = Number(randomCount);
    if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
      setActionError('Random count must be a positive number.');
      return;
    }

    setRandomizingQuestions(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/questions/randomize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: parsedCount }),
      });
      const data = await res.json();

      if (!res.ok || !Array.isArray(data.questions)) {
        setActionError(data.error || 'Unable to randomize questions from database.');
        return;
      }

      const randomQuestions = data.questions as Question[];

      if (randomQuestions.length === 0) {
        setActionError('No more matching question bank entries are available for this test.');
        return;
      }

      setQuestions((prev) => {
        const existingIds = new Set(prev.map((question) => question.id));
        const incoming = randomQuestions.filter((question) => !existingIds.has(question.id));
        return [...prev, ...incoming];
      });

      setAnswerDrafts((prev) => {
        const next = { ...prev };
        for (const question of randomQuestions) {
          next[question.id] = question.correct_answer
            ?? (question.question_type === 'mcq' ? question.options?.[0]?.key ?? '' : '');
        }
        return next;
      });
    } catch {
      setActionError('Unable to randomize questions from database.');
    } finally {
      setRandomizingQuestions(false);
    }
  };

  const handleSaveQuestionAnswer = async (questionId: string) => {
    if (!isTeacher || !testId) return;

    const question = questions.find((row) => row.id === questionId);
    if (!question) return;

    const draftAnswer = answerDrafts[questionId] ?? '';
    if (question.question_type === 'mcq' && !draftAnswer.trim()) {
      setActionError('Please select a correct option before saving the MCQ answer key.');
      return;
    }

    setSavingAnswerId(questionId);
    setActionError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/questions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: questionId,
          correct_answer: draftAnswer,
        }),
      });
      const data = await res.json();

      if (res.ok && data.question) {
        setQuestions((prev) =>
          prev.map((question) => (question.id === questionId ? data.question : question)),
        );
      } else {
        setActionError(data.error || 'Unable to save answer key');
      }
    } catch {
      setActionError('Unable to save answer key');
    } finally {
      setSavingAnswerId(null);
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTeacher || !newAssignment.trim() || !testId) return;

    setAddingAssignment(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: newAssignment.trim(), role: newRole }),
      });

      const data = await res.json();
      if (res.ok && data.assignment) {
        setAssignments((prev) => [...prev, data.assignment]);
        setNewAssignment('');
      } else {
        setActionError(data.error || 'Unable to assign user');
      }
    } catch {
      setActionError('Unable to assign user');
    } finally {
      setAddingAssignment(false);
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    if (!isTeacher || !testId) return;

    setRemovingAssignmentId(id);
    setActionError(null);

    try {
      const res = await fetch(`/api/tests/${testId}/assignments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setAssignments((prev) => prev.filter((assignment) => assignment.id !== id));
      } else {
        const data = await res.json();
        setActionError(data.error || 'Unable to remove assignment');
      }
    } catch {
      setActionError('Unable to remove assignment');
    } finally {
      setRemovingAssignmentId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Loading test details...
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
              <p className="font-semibold">Unable to load test</p>
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
          <p className="mt-1 text-sm text-muted-foreground">The requested test does not exist or was removed.</p>
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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_45%)]" />

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/tests"
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Back to Tests
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles size={11} />
            Assessment Studio
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{test.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage questions, assignments, and publishing context from one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(test.status)}`}
          >
            {formatStatus(test.status)}
          </span>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck size={13} className="text-teal-300" />
            {stats.roleLabel}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link
          href={`/tests/${test.id}/attempt`}
          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
        >
          <Play size={14} />
          Open Attempt
        </Link>
        <Link
          href={`/tests/${test.id}/result`}
          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
        >
          <BarChart3 size={14} />
          View Result
        </Link>
        {isTeacher && (
          <Link
            href={`/tests/${test.id}/review`}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-3 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110"
          >
            <CheckCircle2 size={14} />
            Review Submissions
          </Link>
        )}
      </div>

      {isTeacher && (
        <div className="mb-4 rounded-xl border border-border/70 bg-card/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Student Access Code</p>
          <p className="mt-1 text-sm font-semibold text-teal-300">
            {test.test_code ?? 'Publish this test to generate a code.'}
          </p>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Questions"
          value={String(stats.questionCount)}
          description="Current test question set"
          icon={<ClipboardList size={16} />}
        />
        <StatCard
          title="Assignments"
          value={String(stats.assignmentCount)}
          description="Users assigned to this test"
          icon={<Users size={16} />}
        />
        <StatCard
          title="Updated"
          value={new Date(test.updated_at).toLocaleDateString()}
          description="Latest modification date"
          icon={<Clock3 size={16} />}
        />
        <StatCard
          title="Author"
          value={test.created_by.slice(0, 8)}
          description="Test creator identifier"
          icon={<UserCircle2 size={16} />}
        />
      </div>

      {actionError && (
        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Questions</h2>
              <p className="mt-1 text-xs text-muted-foreground">Build the question set that students will attempt.</p>
            </div>
            <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {questions.length}
            </span>
          </div>

          {isTeacher ? (
            <form onSubmit={handleAddQuestion} className="mb-4 space-y-2">
              <input
                className="h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                placeholder="Add a question prompt..."
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                maxLength={240}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="h-11 w-full rounded-xl border border-border bg-background/90 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  value={newQuestionType}
                  onChange={(e) => setNewQuestionType(e.target.value as 'mcq' | 'sql_fill')}
                >
                  <option value="mcq">MCQ (multiple choice)</option>
                  <option value="sql_fill">SQL / text answer</option>
                </select>
                {newQuestionType === 'mcq' ? (
                  <select
                    className="h-11 w-full rounded-xl border border-border bg-background/90 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    value={newMcqCorrectKey}
                    onChange={(e) => setNewMcqCorrectKey(e.target.value)}
                  >
                    {newMcqOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        Correct Option: {option.key}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    placeholder="Answer key (example: SELECT * FROM students)"
                    value={newQuestionAnswer}
                    onChange={(e) => setNewQuestionAnswer(e.target.value)}
                    maxLength={240}
                  />
                )}
              </div>

              {newQuestionType === 'mcq' && (
                <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    MCQ Options
                  </p>
                  {newMcqOptions.map((option, index) => (
                    <div key={option.key} className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background/70 text-xs font-semibold text-muted-foreground">
                        {option.key}
                      </span>
                      <input
                        className="h-9 w-full rounded-lg border border-border bg-background/90 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                        placeholder={`Option ${option.key}`}
                        value={option.text}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewMcqOptions((prev) => prev.map((row, rowIndex) => (
                            rowIndex === index ? { ...row, text: value } : row
                          )));
                        }}
                        maxLength={180}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={addingQuestion || !newQuestion.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addingQuestion ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
                {addingQuestion ? 'Adding Question...' : 'Add Question'}
              </button>

              <div className="rounded-xl border border-border/70 bg-background/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Add Random Questions From Database
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pull approved sample questions from the question bank based on the selected test mode.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="h-10 w-full rounded-xl border border-border bg-background/90 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 sm:w-32"
                    value={randomCount}
                    onChange={(e) => setRandomCount(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleAddRandomQuestions}
                    disabled={randomizingQuestions}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {randomizingQuestions ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {randomizingQuestions ? 'Randomizing...' : 'Add Random'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="mb-4 rounded-xl border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
              Question management is available to teachers only.
            </div>
          )}

          <div className="space-y-2">
            {questions.length === 0 && (
              <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
                No questions added yet.
              </div>
            )}
            {questions.map((question) => {
              const isRemoving = removingQuestionId === question.id;
              const questionTypeLabel = question.question_type === 'mcq' ? 'MCQ' : 'SQL/TEXT';
              const resolvedAnswer = question.correct_answer?.trim() || 'Not set';
              return (
                <div
                  key={question.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-foreground">{question.text}</p>
                      <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {questionTypeLabel}
                      </span>
                    </div>

                    {question.question_type === 'mcq' && question.options.length > 0 && (
                      <div className="mt-2 grid gap-1">
                        {question.options.map((option) => (
                          <p key={`${question.id}_${option.key}`} className="text-xs text-muted-foreground">
                            {option.key}. {option.text}
                          </p>
                        ))}
                      </div>
                    )}

                    {isTeacher && (
                      <div className="mt-1 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Answer Key: {resolvedAnswer}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {question.question_type === 'mcq' ? (
                            <select
                              value={answerDrafts[question.id] ?? ''}
                              onChange={(e) =>
                                setAnswerDrafts((prev) => ({
                                  ...prev,
                                  [question.id]: e.target.value,
                                }))
                              }
                              className="h-8 w-full rounded-lg border border-border bg-background/80 px-2.5 text-xs outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 sm:w-64"
                            >
                              <option value="">Select correct option</option>
                              {question.options.map((option) => (
                                <option key={`${question.id}_answer_${option.key}`} value={option.key}>
                                  {option.key} - {option.text}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={answerDrafts[question.id] ?? ''}
                              onChange={(e) =>
                                setAnswerDrafts((prev) => ({
                                  ...prev,
                                  [question.id]: e.target.value,
                                }))
                              }
                              placeholder="Set or update answer key"
                              className="h-8 w-full rounded-lg border border-border bg-background/80 px-2.5 text-xs outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 sm:w-64"
                            />
                          )}
                          <button
                            onClick={() => handleSaveQuestionAnswer(question.id)}
                            disabled={savingAnswerId === question.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background/70 px-2 py-1 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingAnswerId === question.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Save size={11} />
                            )}
                            Save Answer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {isTeacher && (
                    <button
                      onClick={() => handleRemoveQuestion(question.id)}
                      disabled={isRemoving}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRemoving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Assignments</h2>
              <p className="mt-1 text-xs text-muted-foreground">Assign students or teachers to this test context.</p>
            </div>
            <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {assignments.length}
            </span>
          </div>

          {isTeacher ? (
            <form onSubmit={handleAddAssignment} className="mb-4 space-y-2">
              <input
                className="h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                placeholder="Assign user by name..."
                value={newAssignment}
                onChange={(e) => setNewAssignment(e.target.value)}
                maxLength={120}
              />
              <div className="flex gap-2">
                <select
                  className="h-11 w-40 rounded-xl border border-border bg-background/90 px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'student' | 'teacher')}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
                <button
                  type="submit"
                  disabled={addingAssignment || !newAssignment.trim()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingAssignment ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
                  {addingAssignment ? 'Assigning...' : 'Assign User'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mb-4 rounded-xl border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
              Assignment management is available to teachers only.
            </div>
          )}

          <div className="space-y-2">
            {assignments.length === 0 && (
              <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
                No assignments yet.
              </div>
            )}
            {assignments.map((assignment) => {
              const isRemoving = removingAssignmentId === assignment.id;
              return (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/50 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{assignment.user}</p>
                    <span className="mt-0.5 inline-flex rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {assignment.role}
                    </span>
                  </div>
                  {isTeacher && (
                    <button
                      onClick={() => handleRemoveAssignment(assignment.id)}
                      disabled={isRemoving}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRemoving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
