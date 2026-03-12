'use client';

import { useState } from 'react';

// Physical key code → shortcut key letter (used for matching in keyDown handler)
const SYMBOL_GROUPS = [
  {
    title: 'Unary',
    symbols: [
      { symbol: 'σ', label: 'Selection', desc: 'Filter rows by condition', template: 'σ', key: 'KeyS' },
      { symbol: 'π', label: 'Projection', desc: 'Pick specific columns', template: 'π', key: 'KeyP' },
      { symbol: 'ρ', label: 'Rename', desc: 'Rename a relation', template: 'ρ', key: 'KeyR' },
      { symbol: 'γ', label: 'Aggregation', desc: 'Group and aggregate', template: 'γ', key: 'KeyG' },
      { symbol: 'τ', label: 'Sort', desc: 'Order rows', template: 'τ', key: 'KeyT' },
    ],
  },
  {
    title: 'Set',
    symbols: [
      { symbol: '∪', label: 'Union', desc: 'Combine two sets', template: ' ∪ ', key: 'KeyU' },
      { symbol: '∩', label: 'Intersect', desc: 'Common rows from two sets', template: ' ∩ ', key: 'KeyI' },
      { symbol: '−', label: 'Difference', desc: 'Subtract rows of one set', template: ' − ', key: 'KeyD' },
      { symbol: '÷', label: 'Division', desc: 'Rows in R matching all of S', template: ' ÷ ', key: 'Slash' },
      { symbol: '×', label: 'Cartesian', desc: 'Cross product of sets', template: ' × ', key: 'KeyX' },
    ],
  },
  {
    title: 'Joins',
    symbols: [
      { symbol: '⋈', label: 'Natural Join', desc: 'Join on shared columns', template: ' ⋈ ', key: 'KeyJ' },
      { symbol: '⟕', label: 'Left Join', desc: 'Left outer join', template: ' ⟕ ', key: 'KeyL' },
      { symbol: '⟖', label: 'Right Join', desc: 'Right outer join', template: ' ⟖ ', key: '' },
      { symbol: '⟗', label: 'Full Join', desc: 'Full outer join', template: ' ⟗ ', key: 'KeyF' },
      { symbol: '⋉', label: 'Semi-Join', desc: 'Left semi-join', template: ' ⋉ ', key: '' },
      { symbol: '▷', label: 'Anti-Join', desc: 'Rows with no match', template: ' ▷ ', key: 'KeyA' },
    ],
  },
];

// Flat list for shortcut lookups
export const ALL_SYMBOLS = SYMBOL_GROUPS.flatMap((g) => g.symbols);

// Build code→template map for keyboard handler
export const SHORTCUT_CODE_MAP: Record<string, string> = {};
for (const s of ALL_SYMBOLS) {
  if (s.key) SHORTCUT_CODE_MAP[s.key] = s.template;
}

// Map physical KeyCode → display letter
function keyLabel(code: string): string {
  if (code === 'Slash') return '/';
  return code.replace('Key', '');
}

interface SymbolPaletteProps {
  onInsert: (text: string) => void;
}

export function SymbolPalette({ onInsert }: SymbolPaletteProps) {
  const [isMac] = useState(() =>
    typeof navigator !== 'undefined'
      ? (navigator.platform?.includes('Mac') ?? /Mac|iPhone|iPad/.test(navigator.userAgent))
      : true,
  );
  const mod = isMac ? '⌥' : 'Alt+';

  return (
    <div className="flex items-center gap-3">
      {SYMBOL_GROUPS.map((group) => (
        <div key={group.title} className="flex items-center gap-0.5">
          <span className="mr-1 text-[9px] font-medium uppercase tracking-wider text-zinc-600">
            {group.title}
          </span>
          {group.symbols.map((s) => (
            <button
              key={s.symbol}
              onClick={() => onInsert(s.template)}
              title={`${s.label} — ${s.desc}${s.key ? `\n${mod}${keyLabel(s.key)}` : ''}`}
              className="group relative flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700/40 text-sm font-bold text-zinc-300 transition-all hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300 hover:shadow-sm hover:shadow-violet-500/10"
            >
              {s.symbol}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
