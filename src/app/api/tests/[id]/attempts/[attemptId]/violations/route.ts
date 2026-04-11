import { NextRequest, NextResponse } from 'next/server';
import { recordAttemptViolationEvent } from '@/lib/test/test-module-db';

async function resolveParams(
  context:
    | { params: { id: string; attemptId: string } }
    | { params: Promise<{ id: string; attemptId: string }> },
) {
  const params = await Promise.resolve(context.params);
  return {
    testId: params.id,
    attemptId: params.attemptId,
  };
}

// POST /api/tests/:id/attempts/:attemptId/violations
export async function POST(
  req: NextRequest,
  context:
    | { params: { id: string; attemptId: string } }
    | { params: Promise<{ id: string; attemptId: string }> },
) {
  try {
    const { testId, attemptId } = await resolveParams(context);
    if (!testId || !attemptId) {
      return NextResponse.json({ error: 'Test ID and attempt ID are required.' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const rawEventType = (body as { event_type?: unknown }).event_type;
    const rawActionTaken = (body as { action_taken?: unknown }).action_taken;
    const rawEventPayload = (body as { event_payload?: unknown }).event_payload;
    const rawOccurredAt = (body as { occurred_at?: unknown }).occurred_at;

    if (typeof rawEventType !== 'string' || !rawEventType.trim()) {
      return NextResponse.json({ error: 'event_type is required.' }, { status: 400 });
    }

    if (typeof rawActionTaken !== 'string' || !rawActionTaken.trim()) {
      return NextResponse.json({ error: 'action_taken is required.' }, { status: 400 });
    }

    if (
      rawEventPayload !== undefined
      && (typeof rawEventPayload !== 'object' || rawEventPayload === null || Array.isArray(rawEventPayload))
    ) {
      return NextResponse.json(
        { error: 'event_payload must be an object when provided.' },
        { status: 400 },
      );
    }

    if (rawOccurredAt !== undefined && typeof rawOccurredAt !== 'string') {
      return NextResponse.json({ error: 'occurred_at must be a string when provided.' }, { status: 400 });
    }

    const event = await recordAttemptViolationEvent({
      testId,
      attemptId,
      eventType: rawEventType.trim() as
        | 'tab_switch'
        | 'blur'
        | 'copy'
        | 'paste'
        | 'cut'
        | 'context_menu',
      actionTaken: rawActionTaken.trim() as 'logged' | 'warned' | 'blocked' | 'force_submitted',
      eventPayload: (rawEventPayload as Record<string, unknown> | undefined) ?? undefined,
      occurredAt: rawOccurredAt?.trim() || undefined,
    });

    return NextResponse.json({ event }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to record violation event.';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
