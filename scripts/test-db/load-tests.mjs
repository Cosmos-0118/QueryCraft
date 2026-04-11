#!/usr/bin/env node

import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const STUDENT_COUNT = Number.parseInt(process.env.LOAD_STUDENT_COUNT ?? '80', 10);
const SAVE_ROUNDS = Number.parseInt(process.env.LOAD_SAVE_ROUNDS ?? '3', 10);
const WAIT_RETRIES = Number.parseInt(process.env.LOAD_WAIT_RETRIES ?? '90', 10);
const WAIT_DELAY_MS = Number.parseInt(process.env.LOAD_WAIT_DELAY_MS ?? '1000', 10);

const teacherId = `teacher_load_${Date.now()}`;
const teacherName = 'Load Test Teacher';

function percentile(sortedValues, ratio) {
  if (sortedValues.length === 0) return 0;
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.ceil(ratio * sortedValues.length) - 1));
  return sortedValues[index];
}

function summarizeDurations(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    minMs: sorted[0] ?? 0,
    avgMs: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}

function printSummary(name, items) {
  const durations = items.map((item) => item.durationMs);
  const stats = summarizeDurations(durations);
  const success = items.filter((item) => item.ok).length;
  const failed = items.length - success;

  console.log(`\n=== ${name} ===`);
  console.log(`Total: ${items.length}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Latency(ms): min=${stats.minMs.toFixed(1)} avg=${stats.avgMs.toFixed(1)} p50=${stats.p50Ms.toFixed(1)} p95=${stats.p95Ms.toFixed(1)} max=${stats.maxMs.toFixed(1)}`);

  if (failed > 0) {
    const firstErrors = items
      .filter((item) => !item.ok)
      .slice(0, 3)
      .map((item) => item.error ?? `HTTP ${item.status ?? 'unknown'}`);
    console.log(`Sample errors: ${firstErrors.join(' | ')}`);
  }
}

async function requestJson(path, init = {}) {
  const started = performance.now();

  try {
    const response = await fetch(`${BASE_URL}${path}`, init);
    const text = await response.text();
    let body = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
      durationMs: performance.now() - started,
      error: response.ok ? undefined : (body?.error ?? `HTTP ${response.status}`),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      durationMs: performance.now() - started,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

async function waitForServer() {
  for (let attempt = 1; attempt <= WAIT_RETRIES; attempt += 1) {
    const res = await requestJson('/api/tests/health/probe');
    if (res.ok) {
      console.log(`Server ready at ${BASE_URL} (attempt ${attempt}).`);
      return;
    }

    if (attempt % 10 === 0) {
      console.log(`Waiting for server... (${attempt}/${WAIT_RETRIES})`);
    }
    await sleep(WAIT_DELAY_MS);
  }

  throw new Error(`Server did not become ready at ${BASE_URL}`);
}

async function createTestFixture() {
  const createRes = await requestJson('/api/tests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Load Test ${new Date().toISOString()}`,
      created_by: teacherId,
      question_mode: 'mcq_only',
      duration_minutes: 30,
    }),
  });

  if (!createRes.ok || !createRes.body?.test?.id) {
    throw new Error(`Unable to create test: ${createRes.error ?? 'unknown error'}`);
  }

  const testId = createRes.body.test.id;
  const teacherQuery = `?role=teacher&userId=${encodeURIComponent(teacherId)}`;

  const randomizeRes = await requestJson(`/api/tests/${testId}/questions/randomize${teacherQuery}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: 8 }),
  });

  if (!randomizeRes.ok || !Array.isArray(randomizeRes.body?.questions) || randomizeRes.body.questions.length === 0) {
    const fallbackQuestions = [
      {
        text: 'What is the primary key in a relational table?',
        question_type: 'mcq',
        options: [
          { key: 'A', text: 'A unique identifier for each row' },
          { key: 'B', text: 'A column that stores long text' },
          { key: 'C', text: 'A duplicated value in multiple rows' },
          { key: 'D', text: 'A column that stores only NULL' },
        ],
        correct_answer: 'A',
      },
      {
        text: 'Write a SQL query that returns all rows from students.',
        question_type: 'sql_fill',
        correct_answer: 'SELECT * FROM students;',
      },
    ];

    for (const payload of fallbackQuestions) {
      const addRes = await requestJson(`/api/tests/${testId}/questions${teacherQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!addRes.ok) {
        throw new Error(`Unable to create fallback question: ${addRes.error ?? 'unknown error'}`);
      }
    }
  }

  const publishRes = await requestJson(`/api/tests/${testId}/publish${teacherQuery}`, {
    method: 'POST',
  });

  if (!publishRes.ok) {
    throw new Error(`Unable to publish test: ${publishRes.error ?? 'unknown error'}`);
  }

  const detailRes = await requestJson(`/api/tests/${testId}${teacherQuery}`);
  if (!detailRes.ok || !detailRes.body?.test?.test_code) {
    throw new Error(`Unable to read published test code: ${detailRes.error ?? 'unknown error'}`);
  }

  const questionsRes = await requestJson(`/api/tests/${testId}/questions`);
  if (!questionsRes.ok || !Array.isArray(questionsRes.body?.questions) || questionsRes.body.questions.length === 0) {
    throw new Error(`Unable to load test questions: ${questionsRes.error ?? 'unknown error'}`);
  }

  return {
    testId,
    testCode: detailRes.body.test.test_code,
    questions: questionsRes.body.questions,
  };
}

function buildStudent(index) {
  const serial = String(index + 1).padStart(3, '0');
  return {
    id: `student_load_${serial}`,
    name: `Load Student ${serial}`,
  };
}

function buildAnswers(questions, studentIndex, round = 0) {
  const answers = {};

  for (const question of questions) {
    if (question.question_type === 'mcq') {
      const options = Array.isArray(question.options) ? question.options : [];
      const picked = options[studentIndex % Math.max(options.length, 1)]?.key ?? 'A';
      answers[question.id] = picked;
    } else {
      answers[question.id] = `SELECT ${studentIndex + 1} AS student_idx, ${round + 1} AS round_idx;`;
    }
  }

  return answers;
}

async function run() {
  if (!Number.isInteger(STUDENT_COUNT) || STUDENT_COUNT <= 0) {
    throw new Error('LOAD_STUDENT_COUNT must be a positive integer.');
  }

  await waitForServer();

  console.log(`\nPreparing fixture with teacher ${teacherName} (${teacherId})...`);
  const fixture = await createTestFixture();
  console.log(`Fixture ready: testId=${fixture.testId}, code=${fixture.testCode}, questions=${fixture.questions.length}`);

  const students = Array.from({ length: STUDENT_COUNT }, (_, index) => buildStudent(index));

  const joinResults = await Promise.all(students.map((student) => (
    requestJson('/api/tests/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: fixture.testCode,
        student_id: student.id,
        student_name: student.name,
      }),
    })
  )));

  printSummary('Setup: Join By Code', joinResults);

  if (joinResults.some((result) => !result.ok)) {
    throw new Error('Join setup failed for one or more students. Aborting load tests.');
  }

  // Test 1: Concurrent attempt start
  const startResults = await Promise.all(students.map((student) => (
    requestJson(`/api/tests/${fixture.testId}/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: student.id,
        student_name: student.name,
      }),
    })
  )));

  printSummary('Test 1: Concurrent Attempt Start', startResults);

  const attempts = startResults
    .map((result, index) => ({ result, student: students[index] }))
    .filter((item) => item.result.ok && typeof item.result.body?.attempt?.id === 'string')
    .map((item) => ({
      student: item.student,
      attemptId: item.result.body.attempt.id,
    }));

  if (attempts.length === 0) {
    throw new Error('No attempts were created successfully. Cannot proceed with remaining tests.');
  }

  // Test 2: Concurrent draft autosave pressure
  const autosaveAllRounds = [];
  for (let round = 0; round < SAVE_ROUNDS; round += 1) {
    const roundResults = await Promise.all(attempts.map((entry, index) => (
      requestJson(`/api/tests/${fixture.testId}/attempts/${entry.attemptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: buildAnswers(fixture.questions, index, round),
        }),
      })
    )));

    autosaveAllRounds.push(...roundResults);
    printSummary(`Test 2.${round + 1}: Concurrent Draft Save Round`, roundResults);
  }

  printSummary('Test 2: Concurrent Draft Save (All Rounds)', autosaveAllRounds);

  // Test 3: Concurrent submit
  const submitResults = await Promise.all(attempts.map((entry, index) => (
    requestJson(`/api/tests/${fixture.testId}/attempts/${entry.attemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: buildAnswers(fixture.questions, index, SAVE_ROUNDS + 1),
      }),
    })
  )));

  printSummary('Test 3: Concurrent Submit', submitResults);

  const allTestsPassed =
    startResults.every((item) => item.ok)
    && autosaveAllRounds.every((item) => item.ok)
    && submitResults.every((item) => item.ok);

  console.log('\n=== Final Verdict ===');
  if (allTestsPassed) {
    console.log('All three concurrency tests passed.');
    process.exit(0);
  }

  console.log('One or more concurrency tests had failures. Check summaries above.');
  process.exit(1);
}

run().catch((error) => {
  console.error(`\nLoad test failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
