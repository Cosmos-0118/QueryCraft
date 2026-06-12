export interface CaretCoordinates {
  left: number;
  top: number;
  lineHeight: number;
}

const MIRROR_STYLE_KEYS = [
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontFamily',
  'lineHeight',
  'letterSpacing',
  'textTransform',
  'textIndent',
  'textDecoration',
  'textAlign',
  'tabSize',
  'whiteSpace',
  'wordBreak',
  'wordSpacing',
] as const;

export function getTextareaCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number,
): CaretCoordinates {
  const computed = window.getComputedStyle(textarea);

  const mirror = document.createElement('div');
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';

  for (const key of MIRROR_STYLE_KEYS) {
    mirror.style[key] = computed[key];
  }

  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.textContent = textarea.value.slice(0, position);

  const marker = document.createElement('span');
  marker.textContent = textarea.value.slice(position) || ' ';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const lineHeight = Number.parseFloat(computed.lineHeight) || 20;

  const left = markerRect.left - mirrorRect.left - textarea.scrollLeft;
  const top = markerRect.top - mirrorRect.top - textarea.scrollTop;

  document.body.removeChild(mirror);

  return {
    left,
    top,
    lineHeight,
  };
}
