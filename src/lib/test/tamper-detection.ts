function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
