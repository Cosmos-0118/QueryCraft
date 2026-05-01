import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { signTestAuthToken } from '@/lib/test-auth/crypto';

vi.mock('@/lib/test/test-module-db', async () => {
  const store = await import('@/lib/test/test-module-store');
  return store;
});

const BASE = process.env.TEST_API_BASE || 'http://localhost:3001/api/tests';
const USE_EXTERNAL_SERVER = Boolean(process.env.TEST_API_BASE);
const INTERNAL_BASE = 'http://localhost:3000';
const TEACHER_ID = '999f68ef-cd80-4a7a-b02e-75f33c56a77f';
const TEACHER_EMAIL = 'teacher.integration@querycraft.test';
const TEACHER_DISPLAY_NAME = 'Integration Teacher';
const TEST_API_TOKEN = process.env.TEST_API_TOKEN?.trim();

const LOCAL_TEACHER_TOKEN = signTestAuthToken({
  sub: TEACHER_ID,
  email: TEACHER_EMAIL,
  role: 'teacher',
  displayName: TEACHER_DISPLAY_NAME,
});

let testId: string;

interface ApiCallResult {
  status: number;
  data: Record<string, unknown>;
}

function resolveAuthToken() {
  return TEST_API_TOKEN || LOCAL_TEACHER_TOKEN;
}

function buildAuthHeaders(includeJsonContentType = true): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${resolveAuthToken()}`,
  };

  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function buildJsonRequest(url: string, method: 'POST' | 'PATCH', body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: buildAuthHeaders(true),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function callCreateTest(): Promise<ApiCallResult> {
  if (USE_EXTERNAL_SERVER) {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: buildAuthHeaders(true),
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
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: buildAuthHeaders(true),
      body: JSON.stringify({ title: 'Integration Test Patched' }),
    });

    return {
      status: res.status,
      data: await res.json(),
    };
  }

  const request = buildJsonRequest(
    `${INTERNAL_BASE}/api/tests/${id}`,
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
    const res = await fetch(`${BASE}/${id}/publish`, {
      method: 'POST',
      headers: buildAuthHeaders(false),
    });

    return {
      status: res.status,
      data: await res.json(),
    };
  }

  const request = buildJsonRequest(`${INTERNAL_BASE}/api/tests/${id}/publish`, 'POST');
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
