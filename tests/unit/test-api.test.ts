import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/test/test-module-db', async () => {
  const store = await import('@/lib/test/test-module-store');
  return store;
});

const BASE = process.env.TEST_API_BASE || 'http://localhost:3001/api/tests';
const USE_EXTERNAL_SERVER = Boolean(process.env.TEST_API_BASE);
const INTERNAL_BASE = 'http://localhost:3000';
const TEACHER_ID = '999f68ef-cd80-4a7a-b02e-75f33c56a77f';
const TEACHER_ACCESS_QUERY = `?role=teacher&userId=${encodeURIComponent(TEACHER_ID)}`;

let testId: string;

interface ApiCallResult {
  status: number;
  data: Record<string, unknown>;
}

function buildJsonRequest(url: string, method: 'POST' | 'PATCH', body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function callCreateTest(): Promise<ApiCallResult> {
  if (USE_EXTERNAL_SERVER) {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Integration Test',
        created_by: TEACHER_ID,
        question_mode: 'mcq_only',
        duration_minutes: 30,
        anti_cheat_policy: {},
        mix_mcq_percent: null,
        mix_sql_fill_percent: null,
      }),
    });

    return {
      status: res.status,
      data: await res.json(),
    };
  }

  const request = buildJsonRequest(`${INTERNAL_BASE}/api/tests`, 'POST', {
    title: 'Integration Test',
    created_by: TEACHER_ID,
    question_mode: 'mcq_only',
    duration_minutes: 30,
    anti_cheat_policy: {},
    mix_mcq_percent: null,
    mix_sql_fill_percent: null,
  });
  const { POST: createTestRoute } = await import('@/app/api/tests/route');
  const res = await createTestRoute(request);

  return {
    status: res.status,
    data: await res.json(),
  };
}

async function callPatchTest(id: string): Promise<ApiCallResult> {
  if (USE_EXTERNAL_SERVER) {
    const res = await fetch(`${BASE}/${id}${TEACHER_ACCESS_QUERY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Integration Test Patched' }),
    });

    return {
      status: res.status,
      data: await res.json(),
    };
  }

  const request = buildJsonRequest(
    `${INTERNAL_BASE}/api/tests/${id}${TEACHER_ACCESS_QUERY}`,
    'PATCH',
    { title: 'Integration Test Patched' },
  );
  const { PATCH: updateTestRoute } = await import('@/app/api/tests/[id]/route');
  const res = await updateTestRoute(request, { params: { id } });

  return {
    status: res.status,
    data: await res.json(),
  };
}

async function callPublishTest(id: string): Promise<ApiCallResult> {
  if (USE_EXTERNAL_SERVER) {
    const res = await fetch(`${BASE}/${id}/publish${TEACHER_ACCESS_QUERY}`, { method: 'POST' });

    return {
      status: res.status,
      data: await res.json(),
    };
  }

  const request = buildJsonRequest(`${INTERNAL_BASE}/api/tests/${id}/publish${TEACHER_ACCESS_QUERY}`, 'POST');
  const { POST: publishTestRoute } = await import('@/app/api/tests/[id]/publish/route');
  const res = await publishTestRoute(request, { params: { id } });

  return {
    status: res.status,
    data: await res.json(),
  };
}

// Integration tests for Test APIs
describe('Test API integration', () => {
  it('POST /api/tests creates a draft test', async () => {
    const result = await callCreateTest();

    expect(result.status).toBe(201);
    expect(result.data.test).toBeDefined();
    testId = (result.data.test as { id: string }).id;
  });

  it('PATCH /api/tests/:id updates the test', async () => {
    const result = await callPatchTest(testId);

    expect(result.status).toBe(200);
    expect((result.data.test as { title: string }).title).toBe('Integration Test Patched');
  });

  it('POST /api/tests/:id/publish publishes the test', async () => {
    const result = await callPublishTest(testId);

    expect(result.status).toBe(200);
    expect((result.data.test as { status: string }).status).toBe('published');
  });
});
