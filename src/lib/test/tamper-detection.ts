function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const DEFAULT_CLIPBOARD_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_CLIPBOARD_ENTRIES = 40;
const MAX_TRACKED_CLIPBOARD_TEXT_LENGTH = 24_000;
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'date',
  'datetime-local',
  'file',
  'hidden',
  'image',
  'month',
  'number',
  'radio',
  'range',
  'reset',
  'submit',
  'time',
  'week',
]);

type ClipboardSource = 'copy' | 'cut';

interface InternalClipboardFingerprint {
  digest: string;
  textLength: number;
  capturedAt: number;
  source: ClipboardSource;
}

export interface ClipboardCaptureResult {
  digest: string;
  textLength: number;
  capturedAt: number;
  source: ClipboardSource;
}

export interface ClipboardPasteDecision {
  allow: boolean;
  reason: 'empty_text' | 'internal_match' | 'external_content';
  digest: string | null;
  textLength: number;
  matchAgeMs?: number;
}

function normalizeClipboardText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .slice(0, MAX_TRACKED_CLIPBOARD_TEXT_LENGTH);
}

function hashText(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isTextEditableInput(input: HTMLInputElement) {
  return !NON_TEXT_INPUT_TYPES.has((input.type || 'text').toLowerCase());
}

function readSelectionTextFromElement(element: Element | null): string {
  if (!element) {
    return '';
  }

  if (element instanceof HTMLTextAreaElement) {
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? start;
    return end > start ? element.value.slice(start, end) : '';
  }

  if (element instanceof HTMLInputElement && isTextEditableInput(element)) {
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? start;
    return end > start ? element.value.slice(start, end) : '';
  }

  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  return selection?.toString() ?? '';
}

function readClipboardSelectionFromCopyEvent(event: ClipboardEvent): string {
  const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
  const fromActive = readSelectionTextFromElement(activeElement);
  if (fromActive) {
    return fromActive;
  }

  const eventTarget = event.target;
  const fromTarget = eventTarget instanceof Element
    ? readSelectionTextFromElement(eventTarget)
    : '';
  return fromTarget;
}

function normalizeAndFingerprint(text: string): { digest: string; textLength: number } | null {
  const normalized = normalizeClipboardText(text);
  if (!normalized) {
    return null;
  }

  return {
    digest: `${normalized.length}:${hashText(normalized)}`,
    textLength: normalized.length,
  };
}

export function isEditableClipboardTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target instanceof HTMLTextAreaElement) {
    return true;
  }

  if (target instanceof HTMLInputElement) {
    return isTextEditableInput(target);
  }

  const closestEditable = target.closest('textarea, input, [contenteditable="true"], [contenteditable=""]');
  if (!closestEditable) {
    return false;
  }

  if (closestEditable instanceof HTMLInputElement) {
    return isTextEditableInput(closestEditable);
  }

  return true;
}

export function createClipboardIntegrityManager(options?: {
  ttlMs?: number;
  maxEntries?: number;
}) {
  const ttlMs = options?.ttlMs ?? DEFAULT_CLIPBOARD_TTL_MS;
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_CLIPBOARD_ENTRIES;
  const fingerprints: InternalClipboardFingerprint[] = [];

  const pruneExpired = (now: number) => {
    for (let index = fingerprints.length - 1; index >= 0; index -= 1) {
      if (now - fingerprints[index].capturedAt > ttlMs) {
        fingerprints.splice(index, 1);
      }
    }
  };

  const registerInternalText = (
    text: string,
    source: ClipboardSource,
  ): ClipboardCaptureResult | null => {
    const normalized = normalizeAndFingerprint(text);
    if (!normalized) {
      return null;
    }

    const capturedAt = Date.now();
    pruneExpired(capturedAt);

    for (let index = fingerprints.length - 1; index >= 0; index -= 1) {
      const existing = fingerprints[index];
      if (existing.digest === normalized.digest && existing.textLength === normalized.textLength) {
        fingerprints.splice(index, 1);
      }
    }

    fingerprints.unshift({
      digest: normalized.digest,
      textLength: normalized.textLength,
      capturedAt,
      source,
    });

    if (fingerprints.length > maxEntries) {
      fingerprints.splice(maxEntries);
    }

    return {
      digest: normalized.digest,
      textLength: normalized.textLength,
      capturedAt,
      source,
    };
  };

  return {
    captureInternalClipboardEvent(event: ClipboardEvent, source: ClipboardSource) {
      return registerInternalText(readClipboardSelectionFromCopyEvent(event), source);
    },
    evaluatePasteEvent(event: ClipboardEvent): ClipboardPasteDecision {
      const rawText = event.clipboardData?.getData('text/plain') ?? '';
      const normalized = normalizeAndFingerprint(rawText);

      if (!normalized) {
        return {
          allow: true,
          reason: 'empty_text',
          digest: null,
          textLength: 0,
        };
      }

      const now = Date.now();
      pruneExpired(now);

      const match = fingerprints.find(
        (entry) => entry.digest === normalized.digest && entry.textLength === normalized.textLength,
      );

      if (!match) {
        return {
          allow: false,
          reason: 'external_content',
          digest: normalized.digest,
          textLength: normalized.textLength,
        };
      }

      return {
        allow: true,
        reason: 'internal_match',
        digest: normalized.digest,
        textLength: normalized.textLength,
        matchAgeMs: Math.max(0, now - match.capturedAt),
      };
    },
  };
}

function resolveScreenDimension(primary: number, fallback: number, inner: number) {
  if (Number.isFinite(primary) && primary > 0) {
    return primary;
  }

  if (Number.isFinite(fallback) && fallback > 0) {
    return fallback;
  }

  return Math.max(1, inner);
}

export function getViewportCoverageRatio() {
  if (typeof window === 'undefined') {
    return 1;
  }

  const screenWidth = resolveScreenDimension(
    window.screen?.availWidth ?? 0,
    window.screen?.width ?? 0,
    window.innerWidth,
  );
  const screenHeight = resolveScreenDimension(
    window.screen?.availHeight ?? 0,
    window.screen?.height ?? 0,
    window.innerHeight,
  );

  const widthRatio = clamp(window.innerWidth / screenWidth, 0, 1.25);
  const heightRatio = clamp(window.innerHeight / screenHeight, 0, 1.25);

  return clamp(Math.min(widthRatio, heightRatio), 0, 1.25);
}

export function getSuspiciousShortcutDescriptor(event: KeyboardEvent): string | null {
  const key = event.key.toLowerCase();
  const code = event.code.toLowerCase();

  const isSpace = code === 'space' || key === ' ' || key === 'spacebar';
  if (isSpace && (event.metaKey || event.ctrlKey)) {
    return event.metaKey ? 'Meta+Space' : 'Ctrl+Space';
  }

  if (key === 'tab' && (event.metaKey || event.altKey)) {
    return event.metaKey ? 'Meta+Tab' : 'Alt+Tab';
  }

  return null;
}
