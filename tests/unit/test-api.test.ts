import { describe, it, expect } from 'vitest';

const BASE = process.env.TEST_API_BASE || 'http://localhost:3001/api/tests';
const TEACHER_ID = '999f68ef-cd80-4a7a-b02e-75f33c56a77f';
const TEACHER_ACCESS_QUERY = `?role=teacher&userId=${encodeURIComponent(TEACHER_ID)}`;

let testId: string;

// Integration tests for Test APIs

describe('Test API integration', () => {
  it('POST /api/tests creates a draft test', async () => {
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
        mix_sql_fill_percent: null
      })
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.test).toBeDefined();
    testId = data.test.id;
  });

  it('PATCH /api/tests/:id updates the test', async () => {
    const res = await fetch(`${BASE}/${testId}${TEACHER_ACCESS_QUERY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Integration Test Patched' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.test.title).toBe('Integration Test Patched');
  });

  it('POST /api/tests/:id/publish publishes the test', async () => {
    const res = await fetch(`${BASE}/${testId}/publish${TEACHER_ACCESS_QUERY}`, { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.test.status).toBe('published');
  });
});
