type TestStatus = 'draft' | 'published' | 'closed' | 'archived';
type AttemptStatus = 'in_progress' | 'submitted';

export type TestRole = 'student' | 'teacher';

export interface TestRecord {
  id: string;
  title: string;
  description: string;
  status: TestStatus;
  created_by: string;
  updated_at: string;
  published_at: string | null;
  test_code: string | null;
  duration_minutes: number;
  question_mode: 'mcq_only' | 'sql_only' | 'mixed';
}

export interface QuestionRecord {
  id: string;
  test_id: string;
  text: string;
  correct_answer: string | null;
  expected_keywords: string[];
}

export interface AssignmentRecord {
  id: string;
  test_id: string;
  user: string;
  role: TestRole;
}

export interface AttemptAnswer {
  question_id: string;
  question_text: string;
  answer: string;
}

export interface AttemptResult {
  question_id: string;
  question_text: string;
  answer: string;
  is_correct: boolean;
  feedback: string;
}

export interface AttemptRecord {
  id: string;
  test_id: string;
  student_id: string;
  student_name: string;
  status: AttemptStatus;
  started_at: string;
  submitted_at: string | null;
  updated_at: string;
  answers: AttemptAnswer[];
  results: AttemptResult[];
  score: number | null;
  max_score: number;
  violation_count: number;
  published: boolean;
}

interface JoinRecord {
  id: string;
  test_id: string;
  student_id: string;
  student_name: string;
  joined_at: string;
}

interface StoreState {
  tests: TestRecord[];
  questions: QuestionRecord[];
  assignments: AssignmentRecord[];
  joins: JoinRecord[];
  attempts: AttemptRecord[];
}

interface CreateDraftTestInput {
  title: string;
  description?: string;
  created_by: string;
  question_mode?: 'mcq_only' | 'sql_only' | 'mixed';
  duration_minutes?: number;
}

interface UpdateDraftTestInput {
  title?: string;
  description?: string;
  status?: TestStatus;
}

interface StartAttemptInput {
  testId: string;
  studentId: string;
  studentName: string;
}

interface JoinByCodeInput {
  code: string;
  studentId: string;
  studentName: string;
}

declare global {
  var __QUERYCRAFT_TEST_MODULE_STORE__: StoreState | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'QC-';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function deriveKeywords(questionText: string): string[] {
  return questionText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 5)
    .slice(0, 3);
}

function createSeedState(): StoreState {
  const createdAt = nowIso();
  const seededTestId = 'seed_test_foundations';

  const tests: TestRecord[] = [
    {
      id: seededTestId,
      title: 'DBMS Foundations Quiz',
      description: 'Starter assessment for SQL and normalization fundamentals.',
      status: 'published',
      created_by: 'seed_teacher',
      updated_at: createdAt,
      published_at: createdAt,
      test_code: 'QC-START1',
      duration_minutes: 30,
      question_mode: 'mixed',
    },
  ];

  const baseQuestions = [
    'Explain what normalization solves in database design.',
    'Write one SQL query that filters rows using a WHERE clause.',
    'Why is a primary key important in relational tables?',
  ];

  const questions: QuestionRecord[] = baseQuestions.map((text, index) => ({
    id: `seed_q_${index + 1}`,
    test_id: seededTestId,
    text,
    correct_answer: null,
    expected_keywords: deriveKeywords(text),
  }));

  const assignments: AssignmentRecord[] = [
    {
      id: 'seed_asg_teacher',
      test_id: seededTestId,
      user: 'Seed Teacher',
      role: 'teacher',
    },
  ];

  return {
    tests,
    questions,
    assignments,
    joins: [],
    attempts: [],
  };
}

function getStore(): StoreState {
  if (!globalThis.__QUERYCRAFT_TEST_MODULE_STORE__) {
    globalThis.__QUERYCRAFT_TEST_MODULE_STORE__ = createSeedState();
  }
  return globalThis.__QUERYCRAFT_TEST_MODULE_STORE__;
}

export function listTests(options?: { role?: TestRole; userId?: string }) {
  const store = getStore();
  const role = options?.role;
  const userId = options?.userId;

  let rows = role === 'student'
    ? store.tests.filter((test) => test.status === 'published')
    : store.tests;

  if (role === 'student' && userId) {
    const joinedTestIds = new Set(
      store.joins
        .filter((join) => join.student_id === userId)
        .map((join) => join.test_id),
    );

    rows = rows.filter((test) => joinedTestIds.has(test.id));
  }

  return [...rows].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function getTestById(testId: string) {
  const store = getStore();
  return store.tests.find((test) => test.id === testId) ?? null;
}

export function createDraftTest(input: CreateDraftTestInput): TestRecord {
  const store = getStore();
  const timestamp = nowIso();

  const test: TestRecord = {
    id: randomId('test'),
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    status: 'draft',
    created_by: input.created_by,
    updated_at: timestamp,
    published_at: null,
    test_code: null,
    duration_minutes: input.duration_minutes ?? 30,
    question_mode: input.question_mode ?? 'mcq_only',
  };

  store.tests.push(test);
  return test;
}

export function updateDraftTest(testId: string, input: UpdateDraftTestInput) {
  const store = getStore();
  const target = store.tests.find((test) => test.id === testId);
  if (!target) return null;

  if (input.title !== undefined) target.title = input.title.trim();
  if (input.description !== undefined) target.description = input.description.trim();
  if (input.status !== undefined) target.status = input.status;
  target.updated_at = nowIso();

  return target;
}

export function publishTest(testId: string) {
  const store = getStore();
  const target = store.tests.find((test) => test.id === testId);
  if (!target || target.status !== 'draft') return null;

  const timestamp = nowIso();
  target.status = 'published';
  target.updated_at = timestamp;
  target.published_at = timestamp;
  target.test_code = target.test_code ?? buildCode();

  return target;
}

export function listQuestionsForTest(testId: string) {
  const store = getStore();
  return store.questions.filter((question) => question.test_id === testId);
}

export function addQuestionToTest(testId: string, text: string, correctAnswer?: string) {
  const store = getStore();
  const test = store.tests.find((row) => row.id === testId);
  if (!test) return null;

  const normalizedText = text.trim();
  const normalizedAnswer = (correctAnswer ?? '').trim();
  const keywordSource = normalizedAnswer || normalizedText;

  const question: QuestionRecord = {
    id: randomId('q'),
    test_id: testId,
    text: normalizedText,
    correct_answer: normalizedAnswer || null,
    expected_keywords: deriveKeywords(keywordSource),
  };

  store.questions.push(question);
  test.updated_at = nowIso();

  return question;
}

export function updateQuestionAnswer(testId: string, questionId: string, correctAnswer: string) {
  const store = getStore();
  const question = store.questions.find(
    (row) => row.test_id === testId && row.id === questionId,
  );
  if (!question) return null;

  const normalizedAnswer = correctAnswer.trim();
  question.correct_answer = normalizedAnswer || null;
  question.expected_keywords = deriveKeywords(normalizedAnswer || question.text);

  const test = store.tests.find((row) => row.id === testId);
  if (test) {
    test.updated_at = nowIso();
  }

  return question;
}

export function removeQuestionFromTest(testId: string, questionId: string) {
  const store = getStore();
  const idx = store.questions.findIndex(
    (question) => question.test_id === testId && question.id === questionId,
  );
  if (idx === -1) return false;

  store.questions.splice(idx, 1);
  const test = store.tests.find((row) => row.id === testId);
  if (test) test.updated_at = nowIso();
  return true;
}

export function listAssignmentsForTest(testId: string) {
  const store = getStore();
  return store.assignments.filter((assignment) => assignment.test_id === testId);
}

export function addAssignmentToTest(testId: string, user: string, role: TestRole) {
  const store = getStore();
  const test = store.tests.find((row) => row.id === testId);
  if (!test) return null;

  const assignment: AssignmentRecord = {
    id: randomId('asg'),
    test_id: testId,
    user,
    role,
  };

  store.assignments.push(assignment);
  test.updated_at = nowIso();

  return assignment;
}

export function removeAssignmentFromTest(testId: string, assignmentId: string) {
  const store = getStore();
  const idx = store.assignments.findIndex(
    (assignment) => assignment.test_id === testId && assignment.id === assignmentId,
  );
  if (idx === -1) return false;

  store.assignments.splice(idx, 1);
  return true;
}

export function joinPublishedTestByCode(input: JoinByCodeInput) {
  const store = getStore();
  const requestedCode = input.code.trim().toUpperCase();

  const test = store.tests.find(
    (row) => row.status === 'published' && (row.test_code ?? '').toUpperCase() === requestedCode,
  );

  if (!test) {
    throw new Error('Invalid or inactive test code.');
  }

  const alreadyJoined = store.joins.some(
    (join) => join.test_id === test.id && join.student_id === input.studentId,
  );

  if (!alreadyJoined) {
    store.joins.push({
      id: randomId('join'),
      test_id: test.id,
      student_id: input.studentId,
      student_name: input.studentName,
      joined_at: nowIso(),
    });
  }

  const assigned = store.assignments.some(
    (asg) => asg.test_id === test.id && asg.role === 'student' && asg.user === input.studentName,
  );

  if (!assigned) {
    store.assignments.push({
      id: randomId('asg'),
      test_id: test.id,
      user: input.studentName,
      role: 'student',
    });
  }

  return test;
}

function hasStudentJoinedTest(testId: string, studentId: string) {
  const store = getStore();
  return store.joins.some((join) => join.test_id === testId && join.student_id === studentId);
}

export function startOrResumeAttempt(input: StartAttemptInput) {
  const store = getStore();
  const test = store.tests.find((row) => row.id === input.testId);
  if (!test) throw new Error('Test not found.');

  if (test.status !== 'published') {
    throw new Error('This test is not published yet.');
  }

  if (!hasStudentJoinedTest(input.testId, input.studentId)) {
    throw new Error('Enter a valid test code first to access this test.');
  }

  const existingInProgress = store.attempts.find(
    (attempt) =>
      attempt.test_id === input.testId &&
      attempt.student_id === input.studentId &&
      attempt.status === 'in_progress',
  );

  if (existingInProgress) return existingInProgress;

  const existingSubmitted = [...store.attempts]
    .filter(
      (attempt) =>
        attempt.test_id === input.testId &&
        attempt.student_id === input.studentId &&
        attempt.status === 'submitted',
    )
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

  if (existingSubmitted) return existingSubmitted;

  const attempt: AttemptRecord = {
    id: randomId('att'),
    test_id: input.testId,
    student_id: input.studentId,
    student_name: input.studentName,
    status: 'in_progress',
    started_at: nowIso(),
    submitted_at: null,
    updated_at: nowIso(),
    answers: [],
    results: [],
    score: null,
    max_score: 0,
    violation_count: 0,
    published: false,
  };

  store.attempts.push(attempt);
  return attempt;
}

export function getLatestAttemptForStudent(testId: string, studentId: string) {
  const store = getStore();
  const rows = store.attempts
    .filter((attempt) => attempt.test_id === testId && attempt.student_id === studentId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return rows[0] ?? null;
}

export function getAttemptById(testId: string, attemptId: string) {
  const store = getStore();
  return (
    store.attempts.find((attempt) => attempt.test_id === testId && attempt.id === attemptId) ?? null
  );
}

export function saveAttemptAnswers(options: {
  testId: string;
  attemptId: string;
  answers: Record<string, string>;
}) {
  const attempt = getAttemptById(options.testId, options.attemptId);
  if (!attempt) throw new Error('Attempt not found.');

  if (attempt.status !== 'in_progress') {
    return attempt;
  }

  const questions = listQuestionsForTest(options.testId);
  const questionById = new Map(questions.map((question) => [question.id, question]));

  const merged: AttemptAnswer[] = [];
  for (const [questionId, answer] of Object.entries(options.answers)) {
    const question = questionById.get(questionId);
    if (!question) continue;

    merged.push({
      question_id: question.id,
      question_text: question.text,
      answer,
    });
  }

  attempt.answers = merged;
  attempt.updated_at = nowIso();
  return attempt;
}

function normalizeAnswerText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeChoice(value: string) {
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return compact.slice(0, 1);
}

function matchesExpectedAnswer(answer: string, expected: string) {
  const normalizedAnswer = normalizeAnswerText(answer);
  const normalizedExpected = normalizeAnswerText(expected);

  if (!normalizedAnswer || !normalizedExpected) {
    return false;
  }

  if (normalizedAnswer === normalizedExpected) {
    return true;
  }

  if (/^[a-z0-9]$/.test(normalizedExpected)) {
    return normalizeChoice(normalizedAnswer) === normalizedExpected;
  }

  return normalizedAnswer.includes(normalizedExpected);
}

function evaluateAttemptAnswers(testId: string, answers: AttemptAnswer[]) {
  const questions = listQuestionsForTest(testId);
  const answerMap = new Map(answers.map((answer) => [answer.question_id, answer]));

  const results: AttemptResult[] = questions.map((question) => {
    const candidate = answerMap.get(question.id);
    const answer = candidate?.answer ?? '';
    const normalized = answer.toLowerCase();

    const hasTeacherAnswer = !!question.correct_answer?.trim();
    const teacherAnswer = question.correct_answer?.trim() ?? '';

    let isCorrect = false;
    let feedback = '';

    if (hasTeacherAnswer) {
      isCorrect = matchesExpectedAnswer(answer, teacherAnswer);
      feedback = isCorrect
        ? 'Correct. This matches the teacher answer key.'
        : `Needs work. Expected answer: ${teacherAnswer}`;
    } else {
      const keywordHit = question.expected_keywords.some((keyword) => normalized.includes(keyword));
      const longEnough = normalized.trim().length >= 12;

      isCorrect = keywordHit || longEnough;
      feedback = isCorrect
        ? 'Good response. This answer captures the main concept.'
        : 'Needs more detail. Add a clearer explanation or SQL statement.';
    }

    return {
      question_id: question.id,
      question_text: question.text,
      answer,
      is_correct: isCorrect,
      feedback,
    };
  });

  const correct = results.filter((row) => row.is_correct).length;
  const total = results.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);

  return {
    results,
    score,
    maxScore: total,
  };
}

export function submitAttempt(options: {
  testId: string;
  attemptId: string;
  answers?: Record<string, string>;
}) {
  const attempt = getAttemptById(options.testId, options.attemptId);
  if (!attempt) throw new Error('Attempt not found.');

  if (attempt.status === 'submitted') {
    return attempt;
  }

  if (options.answers) {
    saveAttemptAnswers({
      testId: options.testId,
      attemptId: options.attemptId,
      answers: options.answers,
    });
  }

  const evaluated = evaluateAttemptAnswers(options.testId, attempt.answers);

  attempt.status = 'submitted';
  attempt.submitted_at = nowIso();
  attempt.updated_at = nowIso();
  attempt.results = evaluated.results;
  attempt.score = evaluated.score;
  attempt.max_score = evaluated.maxScore;

  return attempt;
}

export function listReviewSubmissions(testId: string) {
  const store = getStore();
  return store.attempts
    .filter((attempt) => attempt.test_id === testId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function setSubmissionPublishState(options: {
  testId: string;
  attemptId: string;
  published: boolean;
}) {
  const attempt = getAttemptById(options.testId, options.attemptId);
  if (!attempt) return null;
  attempt.published = options.published;
  attempt.updated_at = nowIso();
  return attempt;
}

export function publishSubmittedResults(testId: string, attemptIds?: string[]) {
  const store = getStore();
  const targetIds = new Set(attemptIds ?? []);

  let changed = 0;
  for (const attempt of store.attempts) {
    if (attempt.test_id !== testId) continue;
    if (attempt.status !== 'submitted') continue;
    if (attemptIds && !targetIds.has(attempt.id)) continue;

    if (!attempt.published) {
      attempt.published = true;
      attempt.updated_at = nowIso();
      changed += 1;
    }
  }

  return changed;
}
