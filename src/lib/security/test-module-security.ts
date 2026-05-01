import { NextRequest, NextResponse } from 'next/server';
import {
  getAttemptById,
  getLatestAttemptForStudent,
  getTestById,
  listLatestSubmittedAttemptSummariesForStudents,
  listTests,
  type AttemptRecord,
  type StudentSubmittedAttemptSummaryRecord,
  type TestRecord,
} from '@/lib/test/test-module-db';
import { readTestAuthSession } from '@/lib/test-auth/session';
import type { TestAuthTokenPayload } from '@/lib/test-auth/crypto';

type SessionRole = TestAuthTokenPayload['role'];

export interface TestModuleActor {
  role: SessionRole;
  email: string;
  displayName: string;
  /** Email is the canonical identity for new writes in the test module. */
  primaryUserId: string;
  /** Includes email id plus legacy subject id for backward compatibility. */
  userIdAliases: string[];
  session: TestAuthTokenPayload;
}

export type SecurityResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: NextResponse };

function normalizePrincipal(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function asError(status: number, message: string): SecurityResult<never> {
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status }),
  };
}

function toActor(session: TestAuthTokenPayload): TestModuleActor {
  const emailId = normalizePrincipal(session.email);
  const legacyId = normalizePrincipal(session.sub);

  const aliases = Array.from(new Set([emailId, legacyId].filter(Boolean)));

  return {
    role: session.role,
    email: session.email,
    displayName: session.displayName,
    primaryUserId: emailId,
    userIdAliases: aliases,
    session,
  };
}

export function requireTestActor(
  req: NextRequest,
  options?: { allowedRoles?: SessionRole[] },
): SecurityResult<TestModuleActor> {
  const session = readTestAuthSession(req);
  if (!session) {
    return asError(401, 'Authentication required. Please sign in to the test module.');
  }

  if (options?.allowedRoles && !options.allowedRoles.includes(session.role)) {
    return asError(403, 'You do not have permission to access this resource.');
  }

  return { ok: true, value: toActor(session) };
}

export function actorMatchesPrincipal(actor: TestModuleActor, candidate: string | null | undefined): boolean {
  const normalized = normalizePrincipal(candidate);
  return normalized.length > 0 && actor.userIdAliases.includes(normalized);
}

export async function listTestsForActor(actor: TestModuleActor): Promise<TestRecord[]> {
  if (actor.role === 'admin') {
    return listTests();
  }

  if (actor.role !== 'teacher' && actor.role !== 'student') {
    return [];
  }

  const scopedRole: 'teacher' | 'student' = actor.role;

  const scopedLists = await Promise.all(
    actor.userIdAliases.map((userId) => listTests({ role: scopedRole, userId })),
  );

  const byId = new Map<string, TestRecord>();

  for (const rows of scopedLists) {
    for (const row of rows) {
      const existing = byId.get(row.id);
      if (!existing) {
        byId.set(row.id, row);
        continue;
      }

      const existingTs = new Date(existing.updated_at).getTime();
      const rowTs = new Date(row.updated_at).getTime();
      if (rowTs > existingTs) {
        byId.set(row.id, row);
      }
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function listSubmittedAttemptSummariesForActor(
  actor: TestModuleActor,
  testIds?: string[],
): Promise<StudentSubmittedAttemptSummaryRecord[]> {
  if (actor.role !== 'student') {
    return [];
  }

  return listLatestSubmittedAttemptSummariesForStudents({
    studentIds: actor.userIdAliases,
    testIds,
  });
}

export async function ensureTeacherOwnsTest(
  actor: TestModuleActor,
  testId: string,
): Promise<SecurityResult<TestRecord>> {
  if (actor.role !== 'teacher' && actor.role !== 'admin') {
    return asError(403, 'Teacher access is required.');
  }

  const test = await getTestById(testId);
  if (!test) {
    return asError(404, 'Test not found.');
  }

  if (actor.role === 'admin') {
    return { ok: true, value: test };
  }

  if (!actorMatchesPrincipal(actor, test.created_by)) {
    return asError(403, 'You do not have access to this test.');
  }

  return { ok: true, value: test };
}

export async function ensureStudentCanAccessTest(
  actor: TestModuleActor,
  testId: string,
): Promise<SecurityResult<TestRecord>> {
  if (actor.role !== 'student') {
    return asError(403, 'Student access is required.');
  }

  const test = await getTestById(testId);
  if (!test) {
    return asError(404, 'Test not found.');
  }

  const visibleTests = await listTestsForActor(actor);
  const hasAccess = visibleTests.some((candidate) => candidate.id === testId);

  if (!hasAccess) {
    return asError(403, 'You are not enrolled in this test or your access has expired.');
  }

  return { ok: true, value: test };
}

export async function ensureAttemptAccess(
  actor: TestModuleActor,
  options: {
    testId: string;
    attemptId: string;
    allowTeacherOwner?: boolean;
  },
): Promise<SecurityResult<AttemptRecord>> {
  const attempt = await getAttemptById(options.testId, options.attemptId);
  if (!attempt) {
    return asError(404, 'Attempt not found.');
  }

  if (actor.role === 'admin') {
    return { ok: true, value: attempt };
  }

  if (actor.role === 'student') {
    if (!actorMatchesPrincipal(actor, attempt.student_id)) {
      return asError(403, 'You do not have access to this attempt.');
    }

    return { ok: true, value: attempt };
  }

  if (actor.role === 'teacher') {
    if (options.allowTeacherOwner === false) {
      return asError(403, 'Teacher access is not allowed for this action.');
    }

    const ownsTest = await ensureTeacherOwnsTest(actor, options.testId);
    if (!ownsTest.ok) {
      return ownsTest;
    }

    return { ok: true, value: attempt };
  }

  return asError(403, 'Unsupported role for attempt access.');
}

export async function getLatestAttemptForActor(
  testId: string,
  actor: TestModuleActor,
): Promise<AttemptRecord | null> {
  if (actor.role !== 'student') {
    return null;
  }

  const attempts = await Promise.all(
    actor.userIdAliases.map((candidateId) => getLatestAttemptForStudent(testId, candidateId)),
  );

  const candidates = attempts.filter((attempt): attempt is AttemptRecord => attempt !== null);
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return candidates[0];
}
