'use client';

import { useEffect, useRef } from 'react';
import type { ThemeMode } from '@/lib/theme';

/**
 * High-performance Canvas-based tile wave background.
 *
 * Renders a grid of subtle tiles with a smooth, fast-moving diagonal wave.
 * Includes a built-in left-side vignette so hero text remains readable.
 * Colors are driven by the active theme.
 */

// ─── Tuning constants ───────────────────────────────────────────────
const BASE_TILE_SIZE = 52;
const GAP = 1;
const CORNER_RADIUS = 2;

const WAVE1_SPEED = 0.8;
const WAVE1_FREQ = 4.0;
const WAVE2_SPEED = 0.5;
const WAVE2_FREQ = 2.8;
const MAX_HIGHLIGHT = 0.18;
const COLOR_STEPS = 48;

// ─── Per-theme palette ───────────────────────────────────────────────

type CanvasPalette = {
  bg: string;
  tileBase: [number, number, number];
  tileHl: [number, number, number];
  borderRgb: [number, number, number];
  vignetteRgb: [number, number, number];
};

const CANVAS_THEMES: Record<ThemeMode, CanvasPalette> = {
  dark: {
    bg: '#070a13',
    tileBase: [18, 26, 42],
    tileHl: [125, 211, 252],
    borderRgb: [38, 50, 71],
    vignetteRgb: [7, 10, 19],
  },
  light: {
    bg: '#f1f5f9',
    tileBase: [200, 214, 232],
    tileHl: [37, 99, 235],
    borderRgb: [170, 190, 215],
    vignetteRgb: [241, 245, 249],
  },
  signature: {
    bg: '#061815',
    tileBase: [12, 36, 30],
    tileHl: [45, 212, 191],
    borderRgb: [22, 62, 54],
    vignetteRgb: [6, 24, 21],
  },
  crimson: {
    bg: '#18070d',
    tileBase: [38, 16, 26],
    tileHl: [251, 113, 133],
    borderRgb: [76, 30, 50],
    vignetteRgb: [24, 7, 13],
  },
  aurora: {
    bg: '#041811',
    tileBase: [12, 38, 28],
    tileHl: [52, 211, 153],
    borderRgb: [20, 64, 46],
    vignetteRgb: [4, 24, 17],
  },
  'electric-night': {
    bg: '#0a0718',
    tileBase: [22, 15, 42],
    tileHl: [192, 132, 252],
    borderRgb: [44, 30, 88],
    vignetteRgb: [10, 7, 24],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────

function buildColorLut(
  baseRgb: [number, number, number],
  hlRgb: [number, number, number],
): string[] {
  const lut: string[] = [];
  for (let i = 0; i < COLOR_STEPS; i++) {
    const t = i / (COLOR_STEPS - 1);
    const r = Math.round(baseRgb[0] + (hlRgb[0] - baseRgb[0]) * t);
    const g = Math.round(baseRgb[1] + (hlRgb[1] - baseRgb[1]) * t);
    const b = Math.round(baseRgb[2] + (hlRgb[2] - baseRgb[2]) * t);
    const a = (0.4 + t * 0.2).toFixed(3);
    lut.push(`rgba(${r},${g},${b},${a})`);
  }
  return lut;
}

function smoothwave(x: number): number {
  const clamped = Math.max(-1, Math.min(1, x));
  return (1 - Math.cos((clamped + 1) * Math.PI * 0.5)) * 0.5;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ─── Component ──────────────────────────────────────────────────────

export default function TileWaveCanvas({ theme = 'dark' }: { theme?: ThemeMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const palette = CANVAS_THEMES[theme] ?? CANVAS_THEMES.dark;
    const colorLut = buildColorLut(palette.tileBase, palette.tileHl);
    const [br, bg, bb] = palette.borderRgb;
    const borderColor = `rgba(${br},${bg},${bb},0.15)`;
    const [vr, vg, vb] = palette.vignetteRgb;

    let rafId: number;

    const draw = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      const bufferW = Math.round(w * dpr);
      const bufferH = Math.round(h * dpr);
      if (canvas.width !== bufferW || canvas.height !== bufferH) {
        canvas.width = bufferW;
        canvas.height = bufferH;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, w, h);

      const tileSize =
        w < 640 ? BASE_TILE_SIZE * 0.72 :
        w < 1280 ? BASE_TILE_SIZE * 0.82 :
        BASE_TILE_SIZE;
      const step = tileSize + GAP;

      const cols = Math.ceil(w / step) + 1;
      const rows = Math.ceil(h / step) + 1;
      const invCols = 1 / cols;
      const invRows = 1 / rows;

      const phase1 = elapsed * WAVE1_SPEED;
      const phase2 = elapsed * WAVE2_SPEED;
      const twoPi = Math.PI * 2;

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 0.5;

      for (let row = 0; row < rows; row++) {
        const ny = row * invRows;
        const py = row * step;

        for (let col = 0; col < cols; col++) {
          const nx = col * invCols;
          const px = col * step;

          const d1 = nx + ny;
          const wave1 = Math.sin(phase1 + d1 * twoPi * WAVE1_FREQ);

          const d2 = nx * 0.6 - ny * 0.4;
          const wave2 = Math.sin(phase2 + d2 * twoPi * WAVE2_FREQ);

          const combined = wave1 * 0.65 + wave2 * 0.35;
          const highlight = smoothwave(combined) * MAX_HIGHLIGHT;

          const lutIdx = Math.min(
            COLOR_STEPS - 1,
            Math.max(0, (highlight / MAX_HIGHLIGHT * (COLOR_STEPS - 1)) | 0),
          );

          ctx.fillStyle = colorLut[lutIdx];
          roundedRect(ctx, px, py, tileSize, tileSize, CORNER_RADIUS);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Left-side vignette for text readability
      const vignetteW = w * 0.55;
      const vignette = ctx.createLinearGradient(0, 0, vignetteW, 0);
      vignette.addColorStop(0,    `rgba(${vr},${vg},${vb},0.88)`);
      vignette.addColorStop(0.35, `rgba(${vr},${vg},${vb},0.72)`);
      vignette.addColorStop(0.7,  `rgba(${vr},${vg},${vb},0.35)`);
      vignette.addColorStop(1,    `rgba(${vr},${vg},${vb},0)`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, vignetteW, h);

      // Subtle bottom fade
      const bottomFade = ctx.createLinearGradient(0, h * 0.7, 0, h);
      bottomFade.addColorStop(0, `rgba(${vr},${vg},${vb},0)`);
      bottomFade.addColorStop(1, `rgba(${vr},${vg},${vb},0.5)`);
      ctx.fillStyle = bottomFade;
      ctx.fillRect(0, h * 0.7, w, h * 0.3);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    />
  );
}
