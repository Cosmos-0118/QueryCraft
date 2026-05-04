import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TEST_PROCTORING_CONFIG,
  createClipboardIntegrityManager,
} from '@/lib/test/tamper-detection';

describe('tamper-detection clipboard integrity manager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows paste when content matches recent internal copy text', () => {
    const manager = createClipboardIntegrityManager();

    const capture = manager.captureInternalText('SELECT * FROM students;\r\n', 'copy');
    expect(capture).not.toBeNull();

    const decision = manager.evaluatePastedText('SELECT * FROM students;\n');
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('internal_match');
    expect(decision.digest).toBe(capture?.digest ?? null);
    expect(decision.matchAgeMs).toBeTypeOf('number');
  });

  it('blocks external paste content when no internal match exists', () => {
    const manager = createClipboardIntegrityManager();

    const decision = manager.evaluatePastedText('DROP TABLE users;');
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('external_content');
    expect(decision.digest).not.toBeNull();
    expect(decision.textLength).toBeGreaterThan(0);
  });

  it('allows empty clipboard text without hard blocking', () => {
    const manager = createClipboardIntegrityManager();

    const decision = manager.evaluatePastedText('');
    expect(decision.allow).toBe(true);
    expect(decision.reason).toBe('empty_text');
    expect(decision.digest).toBeNull();
    expect(decision.textLength).toBe(0);
  });

  it('expires captured clipboard fingerprints after ttl to reduce stale matches', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));

    const manager = createClipboardIntegrityManager({ ttlMs: 500, maxEntries: 10 });
    const capture = manager.captureInternalText('SELECT 1;', 'copy');
    expect(capture).not.toBeNull();

    vi.setSystemTime(new Date('2026-05-01T00:00:00.700Z'));

    const decision = manager.evaluatePastedText('SELECT 1;');
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('external_content');
  });

  it('evicts oldest fingerprints when maxEntries limit is reached', () => {
    const manager = createClipboardIntegrityManager({ ttlMs: 10_000, maxEntries: 2 });

    manager.captureInternalText('alpha', 'copy');
    manager.captureInternalText('beta', 'copy');
    manager.captureInternalText('gamma', 'copy');

    expect(manager.evaluatePastedText('alpha').allow).toBe(false);
    expect(manager.evaluatePastedText('beta').allow).toBe(true);
    expect(manager.evaluatePastedText('gamma').allow).toBe(true);
  });

  it('uses centralized proctoring config defaults', () => {
    expect(TEST_PROCTORING_CONFIG.violation.maxWarnings).toBe(3);
    expect(TEST_PROCTORING_CONFIG.violation.primaryCooldownMs).toBeGreaterThan(0);
    expect(TEST_PROCTORING_CONFIG.focus.pollIntervalMs).toBeGreaterThan(0);
    expect(TEST_PROCTORING_CONFIG.clipboard.ttlMs).toBeGreaterThan(0);
    expect(TEST_PROCTORING_CONFIG.clipboard.maxEntries).toBeGreaterThan(0);
  });
});
