import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { exerciseSubmissions } from '@/lib/db/schema';
import { exercises } from '@/lib/exercises/exercise-bank';
import type { ExerciseType, Difficulty } from '@/types/exercise';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');
    const type = searchParams.get('type') as ExerciseType | null;
    const difficulty = searchParams.get('difficulty') as Difficulty | null;

    // Filter exercises
    let filtered = [...exercises];
    if (topic) filtered = filtered.filter((e) => e.topicSlug === topic);
    if (type) filtered = filtered.filter((e) => e.type === type);
    if (difficulty) filtered = filtered.filter((e) => e.difficulty === difficulty);

    // Fetch user's submissions to annotate past results
    const submissions = await db
      .select({
        exerciseId: exerciseSubmissions.exerciseId,
        isCorrect: exerciseSubmissions.isCorrect,
        attemptNumber: exerciseSubmissions.attemptNumber,
        submittedAt: exerciseSubmissions.submittedAt,
      })
      .from(exerciseSubmissions)
      .where(eq(exerciseSubmissions.userId, auth.userId));

    // Build a map: exerciseId → best result
    const resultMap = new Map<string, { solved: boolean; attempts: number; lastAttempt: string }>();
    for (const sub of submissions) {
      const existing = resultMap.get(sub.exerciseId);
      const subDate = sub.submittedAt?.toISOString() ?? '';
      if (!existing) {
        resultMap.set(sub.exerciseId, {
          solved: sub.isCorrect,
          attempts: sub.attemptNumber,
          lastAttempt: subDate,
        });
      } else {
        existing.attempts = Math.max(existing.attempts, sub.attemptNumber);
        existing.solved = existing.solved || sub.isCorrect;
        if (subDate > existing.lastAttempt) existing.lastAttempt = subDate;
      }
    }

    const result = filtered.map((e) => {
      const past = resultMap.get(e.id);
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        difficulty: e.difficulty,
        topicSlug: e.topicSlug,
        hintCount: e.hints.length,
        userResult: past ?? null,
      };
    });

    return NextResponse.json({ exercises: result, total: result.length });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
