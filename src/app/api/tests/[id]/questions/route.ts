import { NextResponse } from 'next/server';
import {
  addQuestionToTest,
  listQuestionsForTest,
  removeQuestionFromTest,
  updateQuestionAnswer,
} from '@/lib/test/test-module-db';

export async function GET(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const includeAnswer = new URL(req.url).searchParams.get('view') === 'teacher';
  const questions = (await listQuestionsForTest(params.id)).map((question) => (
    includeAnswer
      ? question
      : {
        ...question,
        correct_answer: null,
      }
  ));
  return NextResponse.json({ questions });
}


export async function POST(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const body = await req.json();
  if (!body?.text || typeof body.text !== 'string') {
    return NextResponse.json({ error: 'Question text is required.' }, { status: 400 });
  }

  if (body?.correct_answer !== undefined && typeof body.correct_answer !== 'string') {
    return NextResponse.json({ error: 'Question answer must be a string.' }, { status: 400 });
  }

  const question = await addQuestionToTest(params.id, body.text.trim(), body.correct_answer);
  if (!question) {
    return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
  }

  return NextResponse.json({ question });
}

export async function PATCH(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const body = await req.json();

  if (!body?.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Question id is required.' }, { status: 400 });
  }
  if (body?.correct_answer === undefined || typeof body.correct_answer !== 'string') {
    return NextResponse.json({ error: 'Question answer is required.' }, { status: 400 });
  }

  const question = await updateQuestionAnswer(params.id, body.id, body.correct_answer);
  if (!question) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
  }

  return NextResponse.json({ question });
}


export async function DELETE(req: Request, context: { params: { id: string } } | { params: Promise<{ id: string }> }) {
  const params = await Promise.resolve(context.params);
  const body = await req.json();

  if (!body?.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Question id is required.' }, { status: 400 });
  }

  const removed = await removeQuestionFromTest(params.id, body.id);
  if (!removed) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
