import { NextRequest, NextResponse } from 'next/server';
import {
  listReviewSubmissions,
  publishSubmittedResults,
  setSubmissionPublishState,
} from '@/lib/test/test-module-db';

async function resolveTestId(
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  const params = await Promise.resolve(context.params);
  return params.id;
}

// GET /api/tests/:id/review
export async function GET(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  try {
    const testId = await resolveTestId(context);
    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    const submissions = await listReviewSubmissions(testId);
    return NextResponse.json({ submissions }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load review board.' },
      { status: 500 },
    );
  }
}

// POST /api/tests/:id/review
export async function POST(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> },
) {
  try {
    const testId = await resolveTestId(context);
    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
    }

    const body = await req.json();

    if (body?.publishAll) {
      const changed = await publishSubmittedResults(testId, body.attemptIds);
      return NextResponse.json({ ok: true, changed }, { status: 200 });
    }

    if (typeof body?.attemptId === 'string' && typeof body?.published === 'boolean') {
      const updated = await setSubmissionPublishState({
        testId,
        attemptId: body.attemptId,
        published: body.published,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
      }

      return NextResponse.json({ ok: true, submission: updated }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid review action payload.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update review state.' },
      { status: 400 },
    );
  }
}
