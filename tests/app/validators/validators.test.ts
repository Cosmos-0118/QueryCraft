import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema, sessionSaveSchema } from '@/shared/auth/validators';

describe('Validators', () => {
  it('accepts valid account inputs and rejects invalid credentials', () => {
    expect(registerSchema.safeParse({
      email: 'learner@example.com',
      password: 'password123',
      displayName: 'SQL Learner',
    }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'learner@example.com', password: 'password123' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'invalid', password: '' }).success).toBe(false);
    expect(registerSchema.safeParse({
      email: 'learner@example.com',
      password: 'short',
      displayName: '<script>',
    }).success).toBe(false);
  });

  it.each(['sandbox', 'algebra', 'er-builder', 'normalizer'])('preserves arbitrary %s workspace state', (sessionType) => {
    const session = {
      sessionType,
      sessionName: 'Saved workspace',
      stateJson: { query: 'SELECT 1', rows: [{ id: 1 }], enabled: true, selected: null },
    };
    expect(sessionSaveSchema.parse(session)).toEqual(session);
    expect(sessionSaveSchema.parse({ sessionType, stateJson: {} }).stateJson).toEqual({});
  });

  it.each([null, [], 'SELECT 1', 42])('rejects non-object session state %j', (stateJson) => {
    expect(sessionSaveSchema.safeParse({ sessionType: 'sandbox', stateJson }).success).toBe(false);
  });

  it('rejects unsupported workspace types', () => {
    expect(sessionSaveSchema.safeParse({ sessionType: 'unknown', stateJson: {} }).success).toBe(false);
  });
});
