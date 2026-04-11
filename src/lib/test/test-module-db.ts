import { sql } from '@/lib/test-db';

type TestStatus = 'draft' | 'published' | 'closed' | 'archived';
type AttemptStatus = 'in_progress' | 'submitted';

type QuestionMode = 'mcq_only' | 'sql_only' | 'mixed';
type StoredQuestionType = 'mcq' | 'sql_fill';
type RandomQuestionTypeFilter = StoredQuestionType | 'mixed';

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
  question_mode: QuestionMode;
}

export interface QuestionRecord {
  id: string;
  test_id: string;
  text: string;
  question_type: StoredQuestionType;
  options: QuestionOption[];
  correct_answer: string | null;
  expected_keywords: string[];
}

export interface QuestionOption {
  key: string;
  text: string;
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

interface CreateDraftTestInput {
  title: string;
  description?: string;
  created_by: string;
  question_mode?: QuestionMode;
  duration_minutes?: number;
}

interface CreateQuestionInput {
  text: string;
  question_type?: StoredQuestionType;
  correct_answer?: string;
  options?: Array<{
    key?: string;
    text: string;
  }>;
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

interface RawTestRow {
  id: string;
  title: string;
  description: string | null;
  status: TestStatus;
  created_by_profile_id: string;
  created_by_app_user_id: string | null;
  updated_at: string;
  published_at: string | null;
  test_code: string | null;
  duration_minutes: number;
  question_mode: QuestionMode;
}

interface UserProfileRow {
  id: string;
  app_user_id: string;
  display_name: string;
  role: TestRole;
}

interface RawQuestionRow {
  id: string;
  test_id: string;
  prompt: string;
  question_type: StoredQuestionType;
  answer_key: unknown;
  options_json: unknown;
  question_snapshot: unknown;
}

interface RandomQuestionBankRow {
  question_bank_id: string;
  prompt: string;
  question_type: StoredQuestionType;
  answer_key: unknown;
  options_json: unknown;
  marks: number | string;
}

interface QuestionForEvaluation {
  id: string;
  text: string;
  correct_answer: string | null;
  expected_keywords: string[];
  question_type: StoredQuestionType;
}

interface AttemptHeaderRow {
  id: string;
  test_id: string;
  student_id: string;
  student_name: string;
  status: AttemptStatus;
  started_at: string;
  submitted_at: string | null;
  updated_at: string;
  violation_count: number;
  score_raw: number | string | null;
  published_raw: boolean | null;
}

interface AttemptAnswerRow {
  question_id: string;
  question_text: string;
  answer: string;
}

interface AttemptResultRow {
  question_id: string;
  question_text: string;
  answer: string;
  diagnostics: unknown;
}

interface EvaluationResult {
  question_id: string;
  question_text: string;
  answer: string;
  is_correct: boolean;
  feedback: string;
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length === value.length ? strings : null;
}

function normalizeOptionKey(value: string): string {
  const compact = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return compact.slice(0, 1);
}

function buildOptionKey(index: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index >= 0 && index < alphabet.length) {
    return alphabet[index];
  }
  return String(index + 1);
}

function sanitizeQuestionOptions(
  value: unknown,
): QuestionOption[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized: QuestionOption[] = [];
  const used = new Set<string>();

  for (let index = 0; index < value.length; index += 1) {
    const row = asObject(value[index]);
    if (!row) {
      return null;
    }

    const rowKey = asString(row.key) ?? asString(row.option_key) ?? buildOptionKey(index);
    const rowText = asString(row.text) ?? asString(row.option_text);
    const key = normalizeOptionKey(rowKey);
    const text = rowText?.trim() ?? '';

    if (!key || !text || used.has(key)) {
      continue;
    }

    used.add(key);
    normalized.push({ key, text });
  }

  return normalized;
}

function nowIso() {
  return new Date().toISOString();
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

function mapTestRecord(row: RawTestRow): TestRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    created_by: row.created_by_app_user_id ?? row.created_by_profile_id,
    updated_at: row.updated_at,
    published_at: row.published_at,
    test_code: row.test_code,
    duration_minutes: row.duration_minutes,
    question_mode: row.question_mode,
  };
}

function mapQuestionRecord(row: RawQuestionRow): QuestionRecord {
  const snapshot = asObject(row.question_snapshot) ?? {};
  const answerKey = asObject(row.answer_key) ?? {};

  const text = asString(snapshot.text) ?? row.prompt;
  const snapshotType = asString(snapshot.question_type);
  const questionType: StoredQuestionType = snapshotType === 'mcq' || snapshotType === 'sql_fill'
    ? snapshotType
    : row.question_type;

  const snapshotOptions = sanitizeQuestionOptions(snapshot.options);
  const rowOptions = sanitizeQuestionOptions(row.options_json);
  const options = snapshotOptions ?? rowOptions ?? [];

  const snapshotCorrect = asString(snapshot.correct_answer);
  const answerKeyCorrect = asString(answerKey.correctAnswer) ?? asString(answerKey.correctOptionKey);
  const correctAnswer = questionType === 'mcq'
    ? normalizeOptionKey(snapshotCorrect ?? answerKeyCorrect ?? '') || null
    : snapshotCorrect ?? answerKeyCorrect ?? null;

  const snapshotKeywords = asStringArray(snapshot.expected_keywords);
  const answerKeyKeywords = asStringArray(answerKey.expectedKeywords);
  const expectedKeywords = snapshotKeywords ?? answerKeyKeywords ?? deriveKeywords(correctAnswer || text);

  return {
    id: row.id,
    test_id: row.test_id,
    text,
    question_type: questionType,
    options,
    correct_answer: correctAnswer,
    expected_keywords: expectedKeywords,
  };
}

async function ensureUserProfile(options: {
  appUserId: string;
  role: TestRole;
  displayName?: string;
}): Promise<UserProfileRow> {
  const trimmedId = options.appUserId.trim();
  const displayName = (options.displayName ?? '').trim() || trimmedId;

  const result = await sql.raw(
    `
    INSERT INTO users_test_profile (app_user_id, role, display_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (app_user_id)
    DO UPDATE
      SET role = EXCLUDED.role,
          display_name = CASE
            WHEN users_test_profile.display_name IS NULL OR users_test_profile.display_name = '' THEN EXCLUDED.display_name
            ELSE users_test_profile.display_name
          END,
          updated_at = now()
    RETURNING id, app_user_id, display_name, role;
    `,
    [trimmedId, options.role, displayName],
  );

  return result.rows[0] as UserProfileRow;
}

async function getAnyActiveTopicId(): Promise<string> {
  const result = await sql.raw(
    `
    SELECT id
    FROM topics
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
    `,
    [],
  );

  const row = result.rows[0] as { id: string } | undefined;
  if (!row?.id) {
    throw new Error('No active topics found in test question bank seed.');
  }

  return row.id;
}

function buildAttemptAnswersInsertSql(
  answers: Array<{
    attemptId: string;
    questionId: string;
    questionType: StoredQuestionType;
    answer: string;
    isFinal: boolean;
    answeredAt: string;
    updatedAt: string;
  }>,
  options?: {
    upsert?: boolean;
  },
): { text: string; values: unknown[] } {
  if (answers.length === 0) {
    return { text: '', values: [] };
  }

  const values: unknown[] = [];
  const tuples = answers.map((entry, index) => {
    const base = index * 8;
    values.push(
      entry.attemptId,
      entry.questionId,
      entry.questionType,
      entry.questionType === 'mcq' ? entry.answer : null,
      entry.questionType === 'sql_fill' ? entry.answer : null,
      entry.isFinal,
      entry.answeredAt,
      entry.updatedAt,
    );

    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  });

  const upsertClause = options?.upsert
    ? `
    ON CONFLICT (attempt_id, test_question_id)
    DO UPDATE
      SET question_type = EXCLUDED.question_type,
          selected_option_key = EXCLUDED.selected_option_key,
          sql_text = EXCLUDED.sql_text,
          is_final = EXCLUDED.is_final,
          answered_at = EXCLUDED.answered_at,
          updated_at = now()
  `
    : '';

  const text = `
    INSERT INTO attempt_answers (
      attempt_id,
      test_question_id,
      question_type,
      selected_option_key,
      sql_text,
      is_final,
      answered_at,
      updated_at
    )
    VALUES ${tuples.join(', ')}
    ${upsertClause}
    RETURNING id, test_question_id, COALESCE(sql_text, selected_option_key, '') AS answer;
  `;

  return { text, values };
}

function buildEvaluationsInsertSql(
  evaluations: Array<{
    attemptAnswerId: string;
    evaluationType: 'mcq_auto' | 'sql_syntax';
    awardedScore: number;
    isCorrect: boolean;
    feedback: string;
  }>,
): { text: string; values: unknown[] } {
  if (evaluations.length === 0) {
    return { text: '', values: [] };
  }

  const values: unknown[] = [];
  const tuples = evaluations.map((entry, index) => {
    const base = index * 6;
    values.push(
      entry.attemptAnswerId,
      entry.evaluationType,
      entry.awardedScore,
      entry.isCorrect,
      JSON.stringify({
        is_correct: entry.isCorrect,
        feedback: entry.feedback,
      }),
      nowIso(),
    );

    return `($${base + 1}, $${base + 2}, 'syntax_only', $${base + 3}, 1, $${base + 4}, $${base + 5}::jsonb, $${base + 6})`;
  });

  const text = `
    INSERT INTO answer_evaluations (
      attempt_answer_id,
      evaluation_type,
      evaluation_mode,
      awarded_score,
      max_score,
      is_valid,
      diagnostics,
      evaluated_at
    )
    VALUES ${tuples.join(', ')};
  `;

  return { text, values };
}

async function updateTestUpdatedAt(testId: string) {
  await sql.raw(
    `
    UPDATE tests
    SET updated_at = now()
    WHERE id = $1;
    `,
    [testId],
  );
}

async function listEvaluationQuestions(testId: string): Promise<QuestionForEvaluation[]> {
  const result = await sql.raw(
    `
    SELECT
      tq.id,
      tq.question_snapshot,
      qb.prompt,
      qb.answer_key,
      qb.question_type
    FROM test_questions tq
    JOIN question_bank qb ON qb.id = tq.question_bank_id
    WHERE tq.test_id = $1
    ORDER BY tq.display_order ASC, tq.created_at ASC;
    `,
    [testId],
  );

  return (result.rows as Array<{
    id: string;
    question_snapshot: unknown;
    prompt: string;
    answer_key: unknown;
    question_type: StoredQuestionType;
  }>).map((row) => {
    const snapshot = asObject(row.question_snapshot) ?? {};
    const answerKey = asObject(row.answer_key) ?? {};

    const text = asString(snapshot.text) ?? row.prompt;
    const snapshotCorrect = asString(snapshot.correct_answer);
    const answerKeyCorrect = asString(answerKey.correctAnswer) ?? asString(answerKey.correctOptionKey);
    const correctAnswer = snapshotCorrect ?? answerKeyCorrect ?? null;

    const snapshotKeywords = asStringArray(snapshot.expected_keywords);
    const answerKeyKeywords = asStringArray(answerKey.expectedKeywords);
    const expectedKeywords = snapshotKeywords ?? answerKeyKeywords ?? deriveKeywords(correctAnswer || text);

    return {
      id: row.id,
      text,
      correct_answer: correctAnswer,
      expected_keywords: expectedKeywords,
      question_type: row.question_type,
    };
  });
}

function evaluateAttemptAnswers(
  questions: QuestionForEvaluation[],
  answerByQuestionId: Map<string, string>,
): {
  results: EvaluationResult[];
  score: number;
  maxScore: number;
} {
  const results = questions.map((question) => {
    const answer = answerByQuestionId.get(question.id) ?? '';
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

  return {
    results,
    score: total === 0 ? 0 : Math.round((correct / total) * 100),
    maxScore: total,
  };
}

async function loadAttemptAnswers(attemptId: string): Promise<AttemptAnswer[]> {
  const answersRes = await sql.raw(
    `
    SELECT
      aa.test_question_id AS question_id,
      COALESCE(tq.question_snapshot->>'text', qb.prompt) AS question_text,
      COALESCE(aa.sql_text, aa.selected_option_key, '') AS answer
    FROM attempt_answers aa
    JOIN test_questions tq ON tq.id = aa.test_question_id
    JOIN question_bank qb ON qb.id = tq.question_bank_id
    WHERE aa.attempt_id = $1
    ORDER BY tq.display_order ASC, tq.created_at ASC;
    `,
    [attemptId],
  );

  return (answersRes.rows as AttemptAnswerRow[]).map((row) => ({
    question_id: row.question_id,
    question_text: row.question_text,
    answer: row.answer,
  }));
}

async function loadAttemptResults(attemptId: string): Promise<AttemptResult[]> {
  const resultsRes = await sql.raw(
    `
    SELECT
      aa.test_question_id AS question_id,
      COALESCE(tq.question_snapshot->>'text', qb.prompt) AS question_text,
      COALESCE(aa.sql_text, aa.selected_option_key, '') AS answer,
      eval_latest.diagnostics
    FROM attempt_answers aa
    JOIN test_questions tq ON tq.id = aa.test_question_id
    JOIN question_bank qb ON qb.id = tq.question_bank_id
    LEFT JOIN LATERAL (
      SELECT ae.diagnostics
      FROM answer_evaluations ae
      WHERE ae.attempt_answer_id = aa.id
      ORDER BY ae.evaluated_at DESC
      LIMIT 1
    ) eval_latest ON true
    WHERE aa.attempt_id = $1
    ORDER BY tq.display_order ASC, tq.created_at ASC;
    `,
    [attemptId],
  );

  return (resultsRes.rows as AttemptResultRow[]).map((row) => {
    const diagnostics = asObject(row.diagnostics) ?? {};

    return {
      question_id: row.question_id,
      question_text: row.question_text,
      answer: row.answer,
      is_correct: diagnostics.is_correct === true,
      feedback: asString(diagnostics.feedback) ?? '',
    };
  });
}

async function hydrateAttemptById(testId: string, attemptId: string): Promise<AttemptRecord | null> {
  const attemptRes = await sql.raw(
    `
    SELECT
      a.id,
      a.test_id,
      profile.app_user_id AS student_id,
      profile.display_name AS student_name,
      a.status,
      a.started_at,
      a.submitted_at,
      a.updated_at,
      a.violation_count,
      COALESCE(a.final_score, a.auto_score) AS score_raw,
      g.is_published AS published_raw
    FROM attempts a
    JOIN users_test_profile profile ON profile.id = a.student_profile_id
    LEFT JOIN grades g ON g.attempt_id = a.id
    WHERE a.test_id = $1 AND a.id = $2
    LIMIT 1;
    `,
    [testId, attemptId],
  );

  const header = attemptRes.rows[0] as AttemptHeaderRow | undefined;
  if (!header) return null;

  const [answers, results] = await Promise.all([
    loadAttemptAnswers(header.id),
    loadAttemptResults(header.id),
  ]);

  return {
    id: header.id,
    test_id: header.test_id,
    student_id: header.student_id,
    student_name: header.student_name,
    status: header.status,
    started_at: header.started_at,
    submitted_at: header.submitted_at,
    updated_at: header.updated_at,
    answers,
    results,
    score: header.status === 'submitted' ? toNumber(header.score_raw) : null,
    max_score: results.length,
    violation_count: header.violation_count,
    published: header.status === 'submitted' ? header.published_raw === true : false,
  };
}

async function getTestRowById(testId: string): Promise<TestRecord | null> {
  const result = await sql.raw(
    `
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      t.created_by AS created_by_profile_id,
      creator.app_user_id AS created_by_app_user_id,
      t.updated_at,
      t.published_at,
      invite.invite_code AS test_code,
      t.duration_minutes,
      t.question_mode
    FROM tests t
    LEFT JOIN users_test_profile creator ON creator.id = t.created_by
    LEFT JOIN LATERAL (
      SELECT ti.invite_code
      FROM test_invites ti
      WHERE ti.test_id = t.id AND ti.is_active = true
      ORDER BY ti.created_at DESC
      LIMIT 1
    ) invite ON true
    WHERE t.id = $1
    LIMIT 1;
    `,
    [testId],
  );

  const row = result.rows[0] as RawTestRow | undefined;
  return row ? mapTestRecord(row) : null;
}

async function getInviteCodeForTest(testId: string): Promise<string | null> {
  const invite = await sql.raw(
    `
    SELECT invite_code
    FROM test_invites
    WHERE test_id = $1 AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    `,
    [testId],
  );

  const row = invite.rows[0] as { invite_code: string } | undefined;
  return row?.invite_code ?? null;
}

async function createInviteCode(testId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = buildCode();

    try {
      await sql.raw(
        `
        INSERT INTO test_invites (
          test_id,
          invite_code,
          expires_at,
          max_attempts_per_student,
          allowed_cohorts,
          is_active,
          created_at
        )
        VALUES ($1, $2, NULL, 1, NULL, true, now());
        `,
        [testId, code],
      );
      return code;
    } catch (error) {
      const pgCode = (error as { code?: string }).code;
      if (pgCode === '23505') {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Unable to generate a unique test code. Please retry.');
}

async function ensureStudentJoined(testId: string, studentProfileId: string) {
  const joinedRes = await sql.raw(
    `
    SELECT 1
    FROM audit_logs
    WHERE resource_type = 'test_join'
      AND action = 'join_test'
      AND resource_id = $1
      AND actor_profile_id = $2
    LIMIT 1;
    `,
    [testId, studentProfileId],
  );

  return (joinedRes.rowCount ?? 0) > 0;
}

async function ensureStudentAssignmentByName(options: {
  testId: string;
  studentName: string;
}) {
  const assignmentRes = await sql.raw(
    `
    SELECT 1
    FROM audit_logs
    WHERE resource_type = 'test_assignment'
      AND action = 'assignment_add'
      AND metadata->>'test_id' = $1
      AND metadata->>'role' = 'student'
      AND LOWER(TRIM(metadata->>'user')) = LOWER(TRIM($2))
    LIMIT 1;
    `,
    [options.testId, options.studentName],
  );

  if ((assignmentRes.rowCount ?? 0) > 0) {
    return;
  }

  await sql.raw(
    `
    INSERT INTO audit_logs (
      actor_profile_id,
      actor_role,
      action,
      resource_type,
      resource_id,
      metadata,
      created_at
    )
    VALUES (
      NULL,
      'student',
      'assignment_add',
      'test_assignment',
      $1,
      $2::jsonb,
      now()
    );
    `,
    [
      crypto.randomUUID(),
      JSON.stringify({
        test_id: options.testId,
        user: options.studentName.trim(),
        role: 'student',
      }),
    ],
  );
}

export async function listTests(options?: { role?: TestRole; userId?: string }) {
  const role = options?.role;
  const userId = options?.userId?.trim();

  if (role === 'student' && userId) {
    const result = await sql.raw(
      `
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.created_by AS created_by_profile_id,
        creator.app_user_id AS created_by_app_user_id,
        t.updated_at,
        t.published_at,
        invite.invite_code AS test_code,
        t.duration_minutes,
        t.question_mode
      FROM tests t
      LEFT JOIN users_test_profile creator ON creator.id = t.created_by
      LEFT JOIN LATERAL (
        SELECT ti.invite_code
        FROM test_invites ti
        WHERE ti.test_id = t.id AND ti.is_active = true
        ORDER BY ti.created_at DESC
        LIMIT 1
      ) invite ON true
      WHERE t.status = 'published'
        AND EXISTS (
          SELECT 1
          FROM audit_logs join_logs
          JOIN users_test_profile student_profile ON student_profile.id = join_logs.actor_profile_id
          WHERE join_logs.resource_type = 'test_join'
            AND join_logs.action = 'join_test'
            AND join_logs.resource_id = t.id
            AND student_profile.app_user_id = $1
        )
      ORDER BY t.updated_at DESC;
      `,
      [userId],
    );

    return (result.rows as RawTestRow[]).map(mapTestRecord);
  }

  if (role === 'teacher') {
    if (!userId) {
      return [];
    }

    const result = await sql.raw(
      `
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.created_by AS created_by_profile_id,
        creator.app_user_id AS created_by_app_user_id,
        t.updated_at,
        t.published_at,
        invite.invite_code AS test_code,
        t.duration_minutes,
        t.question_mode
      FROM tests t
      LEFT JOIN users_test_profile creator ON creator.id = t.created_by
      LEFT JOIN LATERAL (
        SELECT ti.invite_code
        FROM test_invites ti
        WHERE ti.test_id = t.id AND ti.is_active = true
        ORDER BY ti.created_at DESC
        LIMIT 1
      ) invite ON true
      WHERE creator.app_user_id = $1
      ORDER BY t.updated_at DESC;
      `,
      [userId],
    );

    return (result.rows as RawTestRow[]).map(mapTestRecord);
  }

  const values: unknown[] = [];
  let whereClause = '';

  if (role === 'student') {
    whereClause = "WHERE t.status = 'published'";
  }

  const result = await sql.raw(
    `
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      t.created_by AS created_by_profile_id,
      creator.app_user_id AS created_by_app_user_id,
      t.updated_at,
      t.published_at,
      invite.invite_code AS test_code,
      t.duration_minutes,
      t.question_mode
    FROM tests t
    LEFT JOIN users_test_profile creator ON creator.id = t.created_by
    LEFT JOIN LATERAL (
      SELECT ti.invite_code
      FROM test_invites ti
      WHERE ti.test_id = t.id AND ti.is_active = true
      ORDER BY ti.created_at DESC
      LIMIT 1
    ) invite ON true
    ${whereClause}
    ORDER BY t.updated_at DESC;
    `,
    values,
  );

  return (result.rows as RawTestRow[]).map(mapTestRecord);
}

export async function getTestById(testId: string) {
  return getTestRowById(testId);
}

export async function createDraftTest(input: CreateDraftTestInput): Promise<TestRecord> {
  const profile = await ensureUserProfile({
    appUserId: input.created_by,
    role: 'teacher',
    displayName: input.created_by,
  });

  const result = await sql.raw(
    `
    INSERT INTO tests (
      created_by,
      title,
      description,
      question_mode,
      duration_minutes,
      anti_cheat_policy,
      status,
      starts_at,
      ends_at,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      '{}'::jsonb,
      'draft',
      NULL,
      NULL,
      now(),
      now()
    )
    RETURNING id;
    `,
    [
      profile.id,
      input.title.trim(),
      input.description?.trim() ?? '',
      input.question_mode ?? 'mcq_only',
      input.duration_minutes ?? 30,
    ],
  );

  const createdId = (result.rows[0] as { id: string }).id;
  const created = await getTestRowById(createdId);

  if (!created) {
    throw new Error('Failed to load created test.');
  }

  return created;
}

export async function updateDraftTest(testId: string, input: UpdateDraftTestInput) {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    values.push(input.title.trim());
    fields.push(`title = $${values.length}`);
  }

  if (input.description !== undefined) {
    values.push(input.description.trim());
    fields.push(`description = $${values.length}`);
  }

  if (input.status !== undefined) {
    values.push(input.status);
    fields.push(`status = $${values.length}`);
  }

  if (fields.length === 0) {
    return null;
  }

  values.push(testId);

  const updateRes = await sql.raw(
    `
    UPDATE tests
    SET ${fields.join(', ')}, updated_at = now()
    WHERE id = $${values.length} AND status = 'draft'
    RETURNING id;
    `,
    values,
  );

  if ((updateRes.rowCount ?? 0) === 0) {
    return null;
  }

  return getTestRowById(testId);
}

export async function publishTest(testId: string) {
  const publishRes = await sql.raw(
    `
    UPDATE tests
    SET
      status = 'published',
      published_at = COALESCE(published_at, now()),
      updated_at = now()
    WHERE id = $1 AND status = 'draft'
    RETURNING id;
    `,
    [testId],
  );

  if ((publishRes.rowCount ?? 0) === 0) {
    return null;
  }

  const existingCode = await getInviteCodeForTest(testId);
  if (!existingCode) {
    await createInviteCode(testId);
  }

  return getTestRowById(testId);
}

export async function listQuestionsForTest(testId: string) {
  const result = await sql.raw(
    `
    SELECT
      tq.id,
      tq.test_id,
      tq.question_snapshot,
      qb.prompt,
      qb.answer_key,
      qb.question_type,
      opt.options_json
    FROM test_questions tq
    JOIN question_bank qb ON qb.id = tq.question_bank_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object('key', qo.option_key, 'text', qo.option_text)
        ORDER BY qo.display_order ASC
      ) AS options_json
      FROM question_options qo
      WHERE qo.question_id = qb.id
    ) opt ON true
    WHERE tq.test_id = $1
    ORDER BY tq.display_order ASC, tq.created_at ASC;
    `,
    [testId],
  );

  return (result.rows as RawQuestionRow[]).map(mapQuestionRecord);
}

export async function addRandomQuestionsFromBankToTest(options: {
  testId: string;
  count: number;
  questionType?: RandomQuestionTypeFilter;
}) {
  const normalizedCount = Math.max(1, Math.min(50, Math.floor(options.count)));

  const testRes = await sql.raw(
    `
    SELECT id, question_mode
    FROM tests
    WHERE id = $1
    LIMIT 1;
    `,
    [options.testId],
  );

  const testRow = testRes.rows[0] as { id: string; question_mode: QuestionMode } | undefined;
  if (!testRow) return null;

  const requestedQuestionType: RandomQuestionTypeFilter = options.questionType ?? 'mixed';

  if (
    requestedQuestionType !== 'mcq'
    && requestedQuestionType !== 'sql_fill'
    && requestedQuestionType !== 'mixed'
  ) {
    throw new Error('questionType must be one of mcq, sql_fill, or mixed.');
  }

  const loadRandomRows = async (questionType: StoredQuestionType, limit: number) => {
    if (limit <= 0) return [];

    const randomRowsRes = await sql.raw(
      `
      SELECT
        qb.id AS question_bank_id,
        qb.prompt,
        qb.question_type,
        qb.answer_key,
        opt.options_json,
        qb.marks
      FROM question_bank qb
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object('key', qo.option_key, 'text', qo.option_text)
          ORDER BY qo.display_order ASC
        ) AS options_json
        FROM question_options qo
        WHERE qo.question_id = qb.id
      ) opt ON true
      WHERE qb.status = 'approved'
        AND qb.question_type = $3
        AND NOT EXISTS (
          SELECT 1
          FROM test_questions tq
          WHERE tq.test_id = $1
            AND tq.question_bank_id = qb.id
        )
      ORDER BY random()
      LIMIT $2;
      `,
      [options.testId, limit, questionType],
    );

    return randomRowsRes.rows as RandomQuestionBankRow[];
  };

  let randomRows: RandomQuestionBankRow[] = [];

  if (requestedQuestionType === 'mixed') {
    if (normalizedCount < 2) {
      throw new Error('Mixed questions require at least 2 questions to include both types.');
    }

    let mcqCount = Math.round((normalizedCount * 3) / 5);
    mcqCount = Math.max(1, Math.min(normalizedCount - 1, mcqCount));
    const sqlCount = normalizedCount - mcqCount;

    const [mcqRows, sqlRows] = await Promise.all([
      loadRandomRows('mcq', mcqCount),
      loadRandomRows('sql_fill', sqlCount),
    ]);

    if (mcqRows.length < mcqCount || sqlRows.length < sqlCount) {
      throw new Error(
        `Not enough approved questions for a 3:2 mixed split. Need ${mcqCount} MCQ and ${sqlCount} SQL/TEXT questions.`,
      );
    }

    randomRows = [...mcqRows, ...sqlRows];
    for (let i = randomRows.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [randomRows[i], randomRows[j]] = [randomRows[j], randomRows[i]];
    }
  } else {
    randomRows = await loadRandomRows(requestedQuestionType, normalizedCount);
  }

  if (randomRows.length === 0) {
    return [];
  }

  const orderRes = await sql.raw(
    `
    SELECT COALESCE(MAX(display_order), 0) AS max_order
    FROM test_questions
    WHERE test_id = $1;
    `,
    [options.testId],
  );

  const maxOrderRaw = (orderRes.rows[0] as { max_order: number | string }).max_order;
  const maxOrder = toNumber(maxOrderRaw);

  const values: unknown[] = [];
  const tuples = randomRows.map((row, index) => {
    const answerKey = asObject(row.answer_key) ?? {};
    const rawCorrectAnswer = asString(answerKey.correctAnswer)
      ?? asString(answerKey.correctOptionKey)
      ?? null;
    const correctAnswer = row.question_type === 'mcq'
      ? normalizeOptionKey(rawCorrectAnswer ?? '') || null
      : rawCorrectAnswer;
    const mcqOptions = sanitizeQuestionOptions(row.options_json) ?? [];
    const expectedKeywords = asStringArray(answerKey.expectedKeywords)
      ?? deriveKeywords(correctAnswer || row.prompt);

    const snapshot = JSON.stringify({
      text: row.prompt,
      question_type: row.question_type,
      options: mcqOptions,
      correct_answer: correctAnswer,
      expected_keywords: expectedKeywords,
    });

    const base = index * 5;
    values.push(
      options.testId,
      row.question_bank_id,
      snapshot,
      toNumber(row.marks) || 1,
      maxOrder + index + 1,
    );

    return `($${base + 1}, $${base + 2}, $${base + 3}::jsonb, $${base + 4}, $${base + 5}, now())`;
  });

  const insertRes = await sql.raw(
    `
    INSERT INTO test_questions (
      test_id,
      question_bank_id,
      question_snapshot,
      marks,
      display_order,
      created_at
    )
    VALUES ${tuples.join(', ')}
    RETURNING id, test_id, question_snapshot;
    `,
    values,
  );

  await updateTestUpdatedAt(options.testId);

  return (insertRes.rows as Array<{ id: string; test_id: string; question_snapshot: unknown }>).map((row) => {
    const snapshot = asObject(row.question_snapshot) ?? {};
    const text = asString(snapshot.text) ?? '';
    const snapshotType = asString(snapshot.question_type);
    const questionType: StoredQuestionType = snapshotType === 'mcq' || snapshotType === 'sql_fill'
      ? snapshotType
      : 'sql_fill';
    const optionsList = sanitizeQuestionOptions(snapshot.options) ?? [];
    const correctAnswer = asString(snapshot.correct_answer);
    const expectedKeywords = asStringArray(snapshot.expected_keywords)
      ?? deriveKeywords(correctAnswer || text);

    return {
      id: row.id,
      test_id: row.test_id,
      text,
      question_type: questionType,
      options: optionsList,
      correct_answer: correctAnswer,
      expected_keywords: expectedKeywords,
    } satisfies QuestionRecord;
  });
}

export async function addQuestionToTest(testId: string, input: CreateQuestionInput) {
  const normalizedText = input.text.trim();
  const normalizedAnswer = (input.correct_answer ?? '').trim();
  const providedOptions = (input.options ?? [])
    .map((option, index) => {
      const text = option.text.trim();
      const key = normalizeOptionKey(option.key ?? buildOptionKey(index));
      return { key, text };
    })
    .filter((option) => option.key && option.text);

  const uniqueOptions: QuestionOption[] = [];
  const optionKeys = new Set<string>();
  for (const option of providedOptions) {
    if (optionKeys.has(option.key)) {
      continue;
    }
    optionKeys.add(option.key);
    uniqueOptions.push(option);
  }

  const inferredQuestionType: StoredQuestionType = input.question_type
    ?? (uniqueOptions.length > 0 || /^[a-z0-9]$/i.test(normalizedAnswer) ? 'mcq' : 'sql_fill');

  if (!normalizedText) {
    throw new Error('Question text is required.');
  }

  let expectedKeywords: string[] = [];
  let answerKeyPayload: Record<string, unknown> = {};
  let snapshotCorrectAnswer: string | null = null;

  if (inferredQuestionType === 'mcq') {
    if (uniqueOptions.length < 2) {
      throw new Error('MCQ questions require at least 2 options.');
    }

    const normalizedCorrectKey = normalizeOptionKey(normalizedAnswer);
    if (!normalizedCorrectKey) {
      throw new Error('MCQ answer key is required (for example: A, B, C, or D).');
    }

    const matchingOption = uniqueOptions.find((option) => option.key === normalizedCorrectKey);
    if (!matchingOption) {
      throw new Error('MCQ answer key must match one of the provided option keys.');
    }

    expectedKeywords = deriveKeywords(matchingOption.text || normalizedText);
    answerKeyPayload = {
      correctOptionKey: normalizedCorrectKey,
      expectedKeywords,
    };
    snapshotCorrectAnswer = normalizedCorrectKey;
  } else {
    expectedKeywords = deriveKeywords(normalizedAnswer || normalizedText);
    answerKeyPayload = {
      correctAnswer: normalizedAnswer || null,
      expectedKeywords,
    };
    snapshotCorrectAnswer = normalizedAnswer || null;
  }

  const testResult = await sql.raw(
    `
    SELECT id, created_by
    FROM tests
    WHERE id = $1
    LIMIT 1;
    `,
    [testId],
  );

  const testRow = testResult.rows[0] as { id: string; created_by: string } | undefined;
  if (!testRow) return null;

  const topicId = await getAnyActiveTopicId();
  const tagsPayload = {
    origin: 'teacher_custom',
    created_for_test_id: testId,
  };

  const questionBankInsert = await sql.raw(
    `
    INSERT INTO question_bank (
      topic_id,
      question_type,
      prompt,
      difficulty,
      marks,
      expected_time_sec,
      answer_key,
      syntax_rules,
      explanation,
      tags,
      status,
      version,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      'medium',
      1.00,
      120,
      $4::jsonb,
      NULL,
      NULL,
      $5::jsonb,
      'approved',
      1,
      $6,
      now(),
      now()
    )
    RETURNING id;
    `,
    [
      topicId,
      inferredQuestionType,
      normalizedText,
      JSON.stringify(answerKeyPayload),
      JSON.stringify(tagsPayload),
      testRow.created_by,
    ],
  );

  const questionBankId = (questionBankInsert.rows[0] as { id: string }).id;

  if (inferredQuestionType === 'mcq' && uniqueOptions.length > 0) {
    const optionValues: unknown[] = [];
    const optionTuples = uniqueOptions.map((option, index) => {
      const base = index * 5;
      optionValues.push(
        questionBankId,
        option.key,
        option.text,
        option.key === snapshotCorrectAnswer,
        index + 1,
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });

    await sql.raw(
      `
      INSERT INTO question_options (
        question_id,
        option_key,
        option_text,
        is_correct,
        display_order
      )
      VALUES ${optionTuples.join(', ')};
      `,
      optionValues,
    );
  }

  const insertedQuestion = await sql.raw(
    `
    WITH next_order AS (
      SELECT COALESCE(MAX(display_order), 0) + 1 AS display_order
      FROM test_questions
      WHERE test_id = $1
    )
    INSERT INTO test_questions (
      test_id,
      question_bank_id,
      question_snapshot,
      marks,
      display_order,
      created_at
    )
    VALUES (
      $1,
      $2,
      $3::jsonb,
      1.00,
      (SELECT display_order FROM next_order),
      now()
    )
    RETURNING id, test_id, question_snapshot;
    `,
    [
      testId,
      questionBankId,
      JSON.stringify({
        text: normalizedText,
        question_type: inferredQuestionType,
        options: inferredQuestionType === 'mcq' ? uniqueOptions : [],
        correct_answer: snapshotCorrectAnswer,
        expected_keywords: expectedKeywords,
      }),
    ],
  );

  await updateTestUpdatedAt(testId);

  const row = insertedQuestion.rows[0] as { id: string; test_id: string; question_snapshot: unknown };
  const snapshot = asObject(row.question_snapshot) ?? {};

  return {
    id: row.id,
    test_id: row.test_id,
    text: asString(snapshot.text) ?? normalizedText,
    question_type: inferredQuestionType,
    options: sanitizeQuestionOptions(snapshot.options) ?? (inferredQuestionType === 'mcq' ? uniqueOptions : []),
    correct_answer: asString(snapshot.correct_answer),
    expected_keywords: asStringArray(snapshot.expected_keywords) ?? expectedKeywords,
  } satisfies QuestionRecord;
}

export async function updateQuestionAnswer(testId: string, questionId: string, correctAnswer: string) {
  const targetQuestionRes = await sql.raw(
    `
    SELECT
      tq.id,
      tq.test_id,
      tq.question_snapshot,
      tq.question_bank_id,
      qb.prompt,
      qb.answer_key,
      qb.question_type
    FROM test_questions tq
    JOIN question_bank qb ON qb.id = tq.question_bank_id
    WHERE tq.test_id = $1 AND tq.id = $2
    LIMIT 1;
    `,
    [testId, questionId],
  );

  const row = targetQuestionRes.rows[0] as {
    id: string;
    test_id: string;
    question_snapshot: unknown;
    question_bank_id: string;
    prompt: string;
    answer_key: unknown;
    question_type: StoredQuestionType;
  } | undefined;

  if (!row) return null;

  const normalizedAnswer = row.question_type === 'mcq'
    ? normalizeOptionKey(correctAnswer)
    : correctAnswer.trim();

  if (row.question_type === 'mcq' && !normalizedAnswer) {
    throw new Error('MCQ answer key is required (for example: A, B, C, or D).');
  }

  if (row.question_type === 'mcq') {
    const optionRes = await sql.raw(
      `
      SELECT 1
      FROM question_options
      WHERE question_id = $1
        AND option_key = $2
      LIMIT 1;
      `,
      [row.question_bank_id, normalizedAnswer],
    );

    if ((optionRes.rowCount ?? 0) === 0) {
      throw new Error('MCQ answer key must match one of the existing options.');
    }
  }

  const snapshot = asObject(row.question_snapshot) ?? {};
  const text = asString(snapshot.text) ?? row.prompt;
  const expectedKeywords = deriveKeywords(normalizedAnswer || text);

  if (row.question_type === 'mcq') {
    await sql.raw(
      `
      UPDATE question_options
      SET is_correct = (option_key = $1)
      WHERE question_id = $2;
      `,
      [normalizedAnswer, row.question_bank_id],
    );
  }

  await sql.raw(
    `
    UPDATE question_bank
    SET
      answer_key = $1::jsonb,
      updated_at = now()
    WHERE id = $2;
    `,
    [
      JSON.stringify({
        ...(asObject(row.answer_key) ?? {}),
        correctAnswer: row.question_type === 'sql_fill' ? normalizedAnswer || null : undefined,
        correctOptionKey: row.question_type === 'mcq' ? normalizedAnswer || null : undefined,
        expectedKeywords,
      }),
      row.question_bank_id,
    ],
  );

  const optionRowsRes = await sql.raw(
    `
    SELECT option_key, option_text
    FROM question_options
    WHERE question_id = $1
    ORDER BY display_order ASC;
    `,
    [row.question_bank_id],
  );

  const resolvedOptions = sanitizeQuestionOptions(
    (optionRowsRes.rows as Array<{ option_key: string; option_text: string }>).map((entry) => ({
      option_key: entry.option_key,
      option_text: entry.option_text,
    })),
  ) ?? [];

  const updateSnapshotRes = await sql.raw(
    `
    UPDATE test_questions
    SET question_snapshot = $1::jsonb
    WHERE id = $2 AND test_id = $3
    RETURNING id, test_id, question_snapshot;
    `,
    [
      JSON.stringify({
        ...snapshot,
        text,
        question_type: row.question_type,
        options: row.question_type === 'mcq' ? resolvedOptions : [],
        correct_answer: normalizedAnswer || null,
        expected_keywords: expectedKeywords,
      }),
      questionId,
      testId,
    ],
  );

  await updateTestUpdatedAt(testId);

  const updated = updateSnapshotRes.rows[0] as {
    id: string;
    test_id: string;
    question_snapshot: unknown;
  };

  const updatedSnapshot = asObject(updated.question_snapshot) ?? {};

  return {
    id: updated.id,
    test_id: updated.test_id,
    text: asString(updatedSnapshot.text) ?? text,
    question_type: row.question_type,
    options: row.question_type === 'mcq'
      ? sanitizeQuestionOptions(updatedSnapshot.options) ?? resolvedOptions
      : [],
    correct_answer: asString(updatedSnapshot.correct_answer),
    expected_keywords: asStringArray(updatedSnapshot.expected_keywords) ?? expectedKeywords,
  } satisfies QuestionRecord;
}

export async function removeQuestionFromTest(testId: string, questionId: string) {
  const deleteRes = await sql.raw(
    `
    DELETE FROM test_questions
    WHERE test_id = $1 AND id = $2
    RETURNING question_bank_id;
    `,
    [testId, questionId],
  );

  const deleted = deleteRes.rows[0] as { question_bank_id: string } | undefined;
  if (!deleted) return false;

  await sql.raw(
    `
    DELETE FROM question_bank qb
    WHERE qb.id = $1
      AND qb.tags->>'origin' = 'teacher_custom'
      AND NOT EXISTS (
        SELECT 1
        FROM test_questions tq
        WHERE tq.question_bank_id = qb.id
      );
    `,
    [deleted.question_bank_id],
  );

  await updateTestUpdatedAt(testId);
  return true;
}

export async function listAssignmentsForTest(testId: string) {
  const result = await sql.raw(
    `
    SELECT
      resource_id::text AS id,
      metadata
    FROM audit_logs
    WHERE resource_type = 'test_assignment'
      AND action = 'assignment_add'
      AND metadata->>'test_id' = $1
    ORDER BY created_at ASC;
    `,
    [testId],
  );

  return (result.rows as Array<{ id: string; metadata: unknown }>).flatMap((row) => {
    const metadata = asObject(row.metadata);
    const user = metadata ? asString(metadata.user) : null;
    const roleValue = metadata ? asString(metadata.role) : null;

    if (!user || (roleValue !== 'student' && roleValue !== 'teacher')) {
      return [];
    }

    return [
      {
        id: row.id,
        test_id: testId,
        user,
        role: roleValue,
      } satisfies AssignmentRecord,
    ];
  });
}

export async function addAssignmentToTest(testId: string, user: string, role: TestRole) {
  const testRes = await sql.raw(
    `
    SELECT id
    FROM tests
    WHERE id = $1
    LIMIT 1;
    `,
    [testId],
  );

  if ((testRes.rowCount ?? 0) === 0) {
    return null;
  }

  const assignmentId = crypto.randomUUID();
  const normalizedUser = user.trim();

  await sql.raw(
    `
    INSERT INTO audit_logs (
      actor_profile_id,
      actor_role,
      action,
      resource_type,
      resource_id,
      metadata,
      created_at
    )
    VALUES (
      NULL,
      $1,
      'assignment_add',
      'test_assignment',
      $2,
      $3::jsonb,
      now()
    );
    `,
    [
      role,
      assignmentId,
      JSON.stringify({
        test_id: testId,
        user: normalizedUser,
        role,
      }),
    ],
  );

  await updateTestUpdatedAt(testId);

  return {
    id: assignmentId,
    test_id: testId,
    user: normalizedUser,
    role,
  } satisfies AssignmentRecord;
}

export async function removeAssignmentFromTest(testId: string, assignmentId: string) {
  const deleteRes = await sql.raw(
    `
    DELETE FROM audit_logs
    WHERE resource_type = 'test_assignment'
      AND action = 'assignment_add'
      AND metadata->>'test_id' = $1
      AND resource_id::text = $2;
    `,
    [testId, assignmentId],
  );

  if ((deleteRes.rowCount ?? 0) === 0) {
    return false;
  }

  await updateTestUpdatedAt(testId);
  return true;
}

export async function joinPublishedTestByCode(input: JoinByCodeInput) {
  const requestedCode = input.code.trim().toUpperCase();

  const result = await sql.raw(
    `
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      t.created_by AS created_by_profile_id,
      creator.app_user_id AS created_by_app_user_id,
      t.updated_at,
      t.published_at,
      ti.invite_code AS test_code,
      t.duration_minutes,
      t.question_mode
    FROM test_invites ti
    JOIN tests t ON t.id = ti.test_id
    LEFT JOIN users_test_profile creator ON creator.id = t.created_by
    WHERE UPPER(ti.invite_code) = $1
      AND ti.is_active = true
      AND t.status = 'published'
    ORDER BY ti.created_at DESC
    LIMIT 1;
    `,
    [requestedCode],
  );

  const testRow = result.rows[0] as RawTestRow | undefined;
  if (!testRow) {
    throw new Error('Invalid or inactive test code.');
  }

  const studentProfile = await ensureUserProfile({
    appUserId: input.studentId,
    role: 'student',
    displayName: input.studentName,
  });

  const hasJoin = await ensureStudentJoined(testRow.id, studentProfile.id);

  if (!hasJoin) {
    await sql.raw(
      `
      INSERT INTO audit_logs (
        actor_profile_id,
        actor_role,
        action,
        resource_type,
        resource_id,
        metadata,
        created_at
      )
      VALUES (
        $1,
        'student',
        'join_test',
        'test_join',
        $2,
        $3::jsonb,
        now()
      );
      `,
      [
        studentProfile.id,
        testRow.id,
        JSON.stringify({
          test_id: testRow.id,
          student_id: input.studentId,
          student_name: input.studentName.trim(),
        }),
      ],
    );
  }

  await ensureStudentAssignmentByName({
    testId: testRow.id,
    studentName: input.studentName,
  });

  return mapTestRecord(testRow);
}

async function hasStudentJoinedTest(testId: string, studentId: string) {
  const joinedRes = await sql.raw(
    `
    SELECT 1
    FROM audit_logs join_logs
    JOIN users_test_profile student_profile ON student_profile.id = join_logs.actor_profile_id
    WHERE join_logs.resource_type = 'test_join'
      AND join_logs.action = 'join_test'
      AND join_logs.resource_id = $1
      AND student_profile.app_user_id = $2
    LIMIT 1;
    `,
    [testId, studentId],
  );

  return (joinedRes.rowCount ?? 0) > 0;
}

export async function startOrResumeAttempt(input: StartAttemptInput) {
  const test = await getTestRowById(input.testId);
  if (!test) throw new Error('Test not found.');

  if (test.status !== 'published') {
    throw new Error('This test is not published yet.');
  }

  const studentProfile = await ensureUserProfile({
    appUserId: input.studentId,
    role: 'student',
    displayName: input.studentName,
  });

  const joined = await hasStudentJoinedTest(input.testId, input.studentId);
  if (!joined) {
    throw new Error('Enter a valid test code first to access this test.');
  }

  const existingAttemptRes = await sql.raw(
    `
    SELECT id
    FROM attempts
    WHERE test_id = $1
      AND student_profile_id = $2
      AND status IN ('in_progress', 'submitted')
    ORDER BY
      CASE WHEN status = 'in_progress' THEN 0 ELSE 1 END,
      updated_at DESC
    LIMIT 1;
    `,
    [input.testId, studentProfile.id],
  );

  const existingAttemptId = (existingAttemptRes.rows[0] as { id: string } | undefined)?.id;
  if (existingAttemptId) {
    const existing = await hydrateAttemptById(input.testId, existingAttemptId);
    if (existing) return existing;
  }

  const insertedRes = await sql.raw(
    `
    WITH next_attempt AS (
      SELECT COALESCE(MAX(attempt_number), 0) + 1 AS attempt_number
      FROM attempts
      WHERE test_id = $1 AND student_profile_id = $2
    )
    INSERT INTO attempts (
      test_id,
      student_profile_id,
      attempt_number,
      status,
      started_at,
      submitted_at,
      violation_count,
      auto_score,
      manual_score,
      final_score,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      (SELECT attempt_number FROM next_attempt),
      'in_progress',
      now(),
      NULL,
      0,
      NULL,
      NULL,
      NULL,
      now(),
      now()
    )
    RETURNING id;
    `,
    [input.testId, studentProfile.id],
  );

  const insertedId = (insertedRes.rows[0] as { id: string }).id;
  const attempt = await hydrateAttemptById(input.testId, insertedId);

  if (!attempt) {
    throw new Error('Unable to initialize attempt.');
  }

  return attempt;
}

export async function getLatestAttemptForStudent(testId: string, studentId: string) {
  const latestRes = await sql.raw(
    `
    SELECT a.id
    FROM attempts a
    JOIN users_test_profile profile ON profile.id = a.student_profile_id
    WHERE a.test_id = $1
      AND profile.app_user_id = $2
    ORDER BY a.updated_at DESC
    LIMIT 1;
    `,
    [testId, studentId],
  );

  const attemptId = (latestRes.rows[0] as { id: string } | undefined)?.id;
  if (!attemptId) return null;

  return hydrateAttemptById(testId, attemptId);
}

export async function getAttemptById(testId: string, attemptId: string) {
  return hydrateAttemptById(testId, attemptId);
}

export async function saveAttemptAnswers(options: {
  testId: string;
  attemptId: string;
  answers: Record<string, string>;
}) {
  const attemptRes = await sql.raw(
    `
    SELECT id, status, updated_at
    FROM attempts
    WHERE test_id = $1
      AND id = $2
    LIMIT 1;
    `,
    [options.testId, options.attemptId],
  );

  const attempt = attemptRes.rows[0] as {
    id: string;
    status: AttemptStatus;
    updated_at: string;
  } | undefined;

  if (!attempt) {
    throw new Error('Attempt not found.');
  }

  if (attempt.status !== 'in_progress') {
    return {
      id: attempt.id,
      status: attempt.status,
      updated_at: attempt.updated_at,
    };
  }

  const incomingEntries = Object.entries(options.answers);
  if (incomingEntries.length === 0) {
    const touchedRes = await sql.raw(
      `
      UPDATE attempts
      SET updated_at = now()
      WHERE id = $1
      RETURNING id, status, updated_at;
      `,
      [options.attemptId],
    );

    const touched = touchedRes.rows[0] as {
      id: string;
      status: AttemptStatus;
      updated_at: string;
    } | undefined;

    return touched ?? {
      id: attempt.id,
      status: attempt.status,
      updated_at: attempt.updated_at,
    };
  }

  const questionTypeRes = await sql.raw(
    `
    SELECT
      tq.id::text AS id,
      qb.question_type
    FROM test_questions tq
    JOIN question_bank qb ON qb.id = tq.question_bank_id
    WHERE tq.test_id = $1
      AND tq.id::text = ANY($2::text[]);
    `,
    [
      options.testId,
      incomingEntries.map(([questionId]) => questionId),
    ],
  );

  const questionTypeMap = new Map(
    (questionTypeRes.rows as Array<{ id: string; question_type: StoredQuestionType }>).map((row) => [
      row.id,
      row.question_type,
    ]),
  );

  const answeredRows: Array<{
    attemptId: string;
    questionId: string;
    questionType: StoredQuestionType;
    answer: string;
    isFinal: boolean;
    answeredAt: string;
    updatedAt: string;
  }> = [];
  const clearedQuestionIds: string[] = [];

  for (const [questionId, answer] of incomingEntries) {
    const questionType = questionTypeMap.get(questionId);
    if (!questionType) continue;

    const trimmed = answer.trim();
    if (!trimmed) {
      clearedQuestionIds.push(questionId);
      continue;
    }

    const normalizedAnswer = questionType === 'mcq'
      ? normalizeOptionKey(answer)
      : answer;

    if (!normalizedAnswer) {
      clearedQuestionIds.push(questionId);
      continue;
    }

    answeredRows.push({
      attemptId: options.attemptId,
      questionId,
      questionType,
      answer: normalizedAnswer,
      isFinal: false,
      answeredAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  if (answeredRows.length > 0) {
    const insert = buildAttemptAnswersInsertSql(answeredRows, { upsert: true });
    await sql.raw(insert.text, insert.values);
  }

  if (clearedQuestionIds.length > 0) {
    await sql.raw(
      `
      DELETE FROM attempt_answers
      WHERE attempt_id = $1
        AND test_question_id::text = ANY($2::text[]);
      `,
      [options.attemptId, clearedQuestionIds],
    );
  }

  const touchedRes = await sql.raw(
    `
    UPDATE attempts
    SET updated_at = now()
    WHERE id = $1
    RETURNING id, status, updated_at;
    `,
    [options.attemptId],
  );

  const touched = touchedRes.rows[0] as {
    id: string;
    status: AttemptStatus;
    updated_at: string;
  } | undefined;

  return touched ?? {
    id: attempt.id,
    status: attempt.status,
    updated_at: attempt.updated_at,
  };
}

export async function submitAttempt(options: {
  testId: string;
  attemptId: string;
  answers?: Record<string, string>;
}) {
  const statusRes = await sql.raw(
    `
    SELECT status
    FROM attempts
    WHERE test_id = $1
      AND id = $2
    LIMIT 1;
    `,
    [options.testId, options.attemptId],
  );

  const statusRow = statusRes.rows[0] as { status: AttemptStatus } | undefined;
  if (!statusRow) {
    throw new Error('Attempt not found.');
  }

  if (statusRow.status === 'submitted') {
    const existing = await getAttemptById(options.testId, options.attemptId);
    if (!existing) {
      throw new Error('Attempt not found.');
    }
    return existing;
  }

  if (options.answers) {
    await saveAttemptAnswers({
      testId: options.testId,
      attemptId: options.attemptId,
      answers: options.answers,
    });
  }

  const questions = await listEvaluationQuestions(options.testId);

  const existingAnswersRes = await sql.raw(
    `
    SELECT
      test_question_id,
      COALESCE(sql_text, selected_option_key, '') AS answer
    FROM attempt_answers
    WHERE attempt_id = $1;
    `,
    [options.attemptId],
  );

  const existingAnswerMap = new Map(
    (existingAnswersRes.rows as Array<{ test_question_id: string; answer: string }>).map((row) => [
      row.test_question_id,
      row.answer,
    ]),
  );

  const finalizedRows = questions.map((question) => ({
    attemptId: options.attemptId,
    questionId: question.id,
    questionType: question.question_type,
    answer: existingAnswerMap.get(question.id) ?? '',
    isFinal: true,
    answeredAt: nowIso(),
    updatedAt: nowIso(),
  }));

  const insertAnswers = buildAttemptAnswersInsertSql(finalizedRows, { upsert: true });
  const insertedAnswersRes = await sql.raw(insertAnswers.text, insertAnswers.values);

  await sql.raw(
    `
    DELETE FROM answer_evaluations ae
    USING attempt_answers aa
    WHERE ae.attempt_answer_id = aa.id
      AND aa.attempt_id = $1;
    `,
    [options.attemptId],
  );

  const answerByQuestionId = new Map(
    finalizedRows.map((row) => [row.questionId, row.answer]),
  );

  const evaluated = evaluateAttemptAnswers(questions, answerByQuestionId);

  const insertedAnswerRows = insertedAnswersRes.rows as Array<{
    id: string;
    test_question_id: string;
    answer: string;
  }>;

  const answerIdByQuestionId = new Map(
    insertedAnswerRows.map((row) => [row.test_question_id, row.id]),
  );

  const questionById = new Map(questions.map((question) => [question.id, question]));

  const evaluations = evaluated.results.map((result) => {
    const question = questionById.get(result.question_id);
    return {
      attemptAnswerId: answerIdByQuestionId.get(result.question_id) ?? '',
      evaluationType: question?.question_type === 'mcq' ? 'mcq_auto' : 'sql_syntax',
      awardedScore: result.is_correct ? 1 : 0,
      isCorrect: result.is_correct,
      feedback: result.feedback,
    } as const;
  }).filter((row) => row.attemptAnswerId);

  if (evaluations.length > 0) {
    const insertEvaluations = buildEvaluationsInsertSql(evaluations);
    await sql.raw(insertEvaluations.text, insertEvaluations.values);
  }

  await sql.raw(
    `
    UPDATE attempts
    SET
      status = 'submitted',
      submitted_at = now(),
      updated_at = now(),
      auto_score = $1,
      final_score = $1
    WHERE id = $2;
    `,
    [evaluated.score, options.attemptId],
  );

  await sql.raw(
    `
    INSERT INTO grades (
      attempt_id,
      auto_score,
      manual_adjustment,
      final_score,
      feedback,
      is_published,
      published_at,
      graded_by,
      graded_at,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      0,
      $2,
      NULL,
      false,
      NULL,
      NULL,
      now(),
      now(),
      now()
    )
    ON CONFLICT (attempt_id)
    DO UPDATE
      SET auto_score = EXCLUDED.auto_score,
          final_score = EXCLUDED.final_score,
          graded_at = now(),
          updated_at = now();
    `,
    [options.attemptId, evaluated.score],
  );

  const submitted = await getAttemptById(options.testId, options.attemptId);
  if (!submitted) {
    throw new Error('Unable to load submitted attempt.');
  }

  return submitted;
}

export async function listReviewSubmissions(testId: string) {
  const attemptsRes = await sql.raw(
    `
    SELECT id
    FROM attempts
    WHERE test_id = $1
    ORDER BY updated_at DESC;
    `,
    [testId],
  );

  const attemptIds = (attemptsRes.rows as Array<{ id: string }>).map((row) => row.id);
  const hydrated = await Promise.all(attemptIds.map((attemptId) => hydrateAttemptById(testId, attemptId)));

  return hydrated.filter((item): item is AttemptRecord => item !== null);
}

export async function setSubmissionPublishState(options: {
  testId: string;
  attemptId: string;
  published: boolean;
}) {
  const attemptRes = await sql.raw(
    `
    SELECT id, COALESCE(final_score, auto_score, 0) AS score
    FROM attempts
    WHERE id = $1 AND test_id = $2
    LIMIT 1;
    `,
    [options.attemptId, options.testId],
  );

  const attempt = attemptRes.rows[0] as { id: string; score: string | number } | undefined;
  if (!attempt) {
    return null;
  }

  await sql.raw(
    `
    INSERT INTO grades (
      attempt_id,
      auto_score,
      manual_adjustment,
      final_score,
      feedback,
      is_published,
      published_at,
      graded_by,
      graded_at,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      0,
      $2,
      NULL,
      $3,
      CASE WHEN $3 THEN now() ELSE NULL END,
      NULL,
      now(),
      now(),
      now()
    )
    ON CONFLICT (attempt_id)
    DO UPDATE
      SET is_published = EXCLUDED.is_published,
          published_at = CASE
            WHEN EXCLUDED.is_published THEN COALESCE(grades.published_at, now())
            ELSE NULL
          END,
          updated_at = now();
    `,
    [options.attemptId, toNumber(attempt.score), options.published],
  );

  await sql.raw(
    `
    UPDATE attempts
    SET updated_at = now()
    WHERE id = $1;
    `,
    [options.attemptId],
  );

  return getAttemptById(options.testId, options.attemptId);
}

export async function publishSubmittedResults(testId: string, attemptIds?: string[]) {
  const filteredAttemptIds = Array.isArray(attemptIds) ? attemptIds.filter(Boolean) : null;

  const targetRes = await sql.raw(
    `
    SELECT
      a.id,
      COALESCE(a.final_score, a.auto_score, 0) AS score,
      COALESCE(g.is_published, false) AS was_published
    FROM attempts a
    LEFT JOIN grades g ON g.attempt_id = a.id
    WHERE a.test_id = $1
      AND a.status = 'submitted'
      AND ($2::text[] IS NULL OR a.id::text = ANY($2::text[]));
    `,
    [testId, filteredAttemptIds],
  );

  const targets = targetRes.rows as Array<{
    id: string;
    score: string | number;
    was_published: boolean;
  }>;

  if (targets.length === 0) {
    return 0;
  }

  let changed = 0;

  for (const target of targets) {
    if (!target.was_published) {
      changed += 1;
    }

    await sql.raw(
      `
      INSERT INTO grades (
        attempt_id,
        auto_score,
        manual_adjustment,
        final_score,
        feedback,
        is_published,
        published_at,
        graded_by,
        graded_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        0,
        $2,
        NULL,
        true,
        now(),
        NULL,
        now(),
        now(),
        now()
      )
      ON CONFLICT (attempt_id)
      DO UPDATE
        SET is_published = true,
            published_at = COALESCE(grades.published_at, now()),
            updated_at = now();
      `,
      [target.id, toNumber(target.score)],
    );

    await sql.raw(
      `
      UPDATE attempts
      SET updated_at = now()
      WHERE id = $1;
      `,
      [target.id],
    );
  }

  return changed;
}
