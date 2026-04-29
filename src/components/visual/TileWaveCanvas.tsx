'use client';

import { useEffect, useRef } from 'react';

/**
 * High-performance Canvas-based tile wave background.
 *
 * Renders a grid of subtle dark tiles with a smooth, fast-moving diagonal
 * teal wave. Includes a built-in left-side vignette so hero text remains
 * readable without additional DOM overlays.
 */

// ─── Tuning constants ───────────────────────────────────────────────
const BASE_TILE_SIZE = 52;
const GAP = 1;
const CORNER_RADIUS = 2;

// Wave speeds (radians/sec) — faster for a lively feel
const WAVE1_SPEED = 0.8;
const WAVE1_FREQ = 4.0;
const WAVE2_SPEED = 0.5;
const WAVE2_FREQ = 2.8;

// Base tile color: a muted dark slate
const BG_COLOR = '#050810';
const TILE_BASE_R = 22, TILE_BASE_G = 32, TILE_BASE_B = 48;
// Highlight color: teal — but kept subtle
const TILE_HL_R = 40,   TILE_HL_G = 180,  TILE_HL_B = 165;
const BORDER_COLOR = 'rgba(148, 163, 184, 0.06)';

// Max highlight blend — kept LOW so it's atmospheric, not blinding
const MAX_HIGHLIGHT = 0.18;

// Pre-compute a 48-step color LUT
const COLOR_STEPS = 48;
const COLOR_LUT: string[] = [];
for (let i = 0; i < COLOR_STEPS; i++) {
  const t = i / (COLOR_STEPS - 1);
  const r = Math.round(TILE_BASE_R + (TILE_HL_R - TILE_BASE_R) * t);
  const g = Math.round(TILE_BASE_G + (TILE_HL_G - TILE_BASE_G) * t);
  const b = Math.round(TILE_BASE_B + (TILE_HL_B - TILE_BASE_B) * t);
  // Base alpha 0.4, peaks at 0.6 for highlighted tiles
  const a = (0.4 + t * 0.2).toFixed(3);
  COLOR_LUT.push(`rgba(${r},${g},${b},${a})`);
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Attempt to use cosine-based interpolation for ultra-smooth blending */
function smoothwave(x: number): number {
  // Maps [-1,1] → [0,1] with smooth cosine falloff
  const clamped = Math.max(-1, Math.min(1, x));
  return (1 - Math.cos((clamped + 1) * Math.PI * 0.5)) * 0.5;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
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

export default function TileWaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
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

    // Resize canvas buffer when dimensions change
    const bufferW = Math.round(w * dpr);
    const bufferH = Math.round(h * dpr);
    if (canvas.width !== bufferW || canvas.height !== bufferH) {
      canvas.width = bufferW;
      canvas.height = bufferH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Responsive tile size
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

    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 0.5;

    for (let row = 0; row < rows; row++) {
      const ny = row * invRows;
      const py = row * step;

      for (let col = 0; col < cols; col++) {
        const nx = col * invCols;
        const px = col * step;

        // Primary wave: smooth diagonal sweep
        const d1 = nx + ny;
        const wave1 = Math.sin(phase1 + d1 * twoPi * WAVE1_FREQ);

        // Secondary wave: cross-angle for organic texture
        const d2 = nx * 0.6 - ny * 0.4;
        const wave2 = Math.sin(phase2 + d2 * twoPi * WAVE2_FREQ);

        // Blend waves — cosine interpolation for silky smooth transitions
        const combined = wave1 * 0.65 + wave2 * 0.35;
        const highlight = smoothwave(combined) * MAX_HIGHLIGHT;

        // LUT index
        const lutIdx = Math.min(
          COLOR_STEPS - 1,
          Math.max(0, (highlight / MAX_HIGHLIGHT * (COLOR_STEPS - 1)) | 0)
        );

        ctx.fillStyle = COLOR_LUT[lutIdx];
        roundedRect(ctx, px, py, tileSize, tileSize, CORNER_RADIUS);
        ctx.fill();
        ctx.stroke();
      }
    }

    // ── Left-side vignette for text readability ──
    // A wide horizontal gradient from opaque dark on the left to transparent on the right
    const vignetteW = w * 0.55;
    const vignette = ctx.createLinearGradient(0, 0, vignetteW, 0);
    vignette.addColorStop(0, 'rgba(5,8,16,0.88)');
    vignette.addColorStop(0.35, 'rgba(5,8,16,0.72)');
    vignette.addColorStop(0.7, 'rgba(5,8,16,0.35)');
    vignette.addColorStop(1, 'rgba(5,8,16,0)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, vignetteW, h);

    // ── Subtle bottom fade so footer/cards stand out ──
    const bottomFade = ctx.createLinearGradient(0, h * 0.7, 0, h);
    bottomFade.addColorStop(0, 'rgba(5,8,16,0)');
    bottomFade.addColorStop(1, 'rgba(5,8,16,0.5)');
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);

    rafId = requestAnimationFrame(draw);
  };

  rafId = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(rafId);
  };
}, []);


  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    />
  );
}
