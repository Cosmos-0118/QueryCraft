import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { progress } from '@/lib/db/schema';
import { sanitizeInput } from '@/lib/security/input-sanitizer';
import { eq, and } from 'drizzle-orm';

// GET /api/progress — retrieve all progress for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');

    const rows = await (topic
      ? db
          .select()
          .from(progress)
          .where(and(eq(progress.userId, auth.userId), eq(progress.topicSlug, topic)))
      : db.select().from(progress).where(eq(progress.userId, auth.userId)));

    return NextResponse.json({
      progress: rows.map((r) => ({
        id: r.id,
        topicSlug: r.topicSlug,
        lessonSlug: r.lessonSlug,
        currentStep: r.currentStep,
        completed: r.completed,
        completedAt: r.completedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt?.toISOString() ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/progress — save or update progress for a specific topic/lesson
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const topicSlug = typeof body.topicSlug === 'string' ? sanitizeInput(body.topicSlug, 100) : '';
    const lessonSlug =
      typeof body.lessonSlug === 'string' ? sanitizeInput(body.lessonSlug, 100) : null;
    const currentStep = typeof body.currentStep === 'number' ? body.currentStep : 0;
    const completed = typeof body.completed === 'boolean' ? body.completed : false;

    if (!topicSlug.trim()) {
      return NextResponse.json({ error: 'topicSlug is required' }, { status: 400 });
    }

    // Check if record exists
    const conditions = lessonSlug
      ? and(
          eq(progress.userId, auth.userId),
          eq(progress.topicSlug, topicSlug),
          eq(progress.lessonSlug, lessonSlug),
        )
      : and(eq(progress.userId, auth.userId), eq(progress.topicSlug, topicSlug));

    const [existing] = await db.select().from(progress).where(conditions).limit(1);

    if (existing) {
      // Update
      await db
        .update(progress)
        .set({
          currentStep,
          completed,
          completedAt: completed && !existing.completed ? new Date() : existing.completedAt,
          updatedAt: new Date(),
        })
        .where(eq(progress.id, existing.id));

      return NextResponse.json({ message: 'Progress updated', id: existing.id });
    }

    // Insert
    const [created] = await db
      .insert(progress)
      .values({
        userId: auth.userId,
        topicSlug,
        lessonSlug,
        currentStep,
        completed,
        completedAt: completed ? new Date() : null,
      })
      .returning({ id: progress.id });

    return NextResponse.json({ message: 'Progress created', id: created.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
