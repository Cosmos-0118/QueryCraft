'use client';

const SYMBOLS = [
  { symbol: 'σ', label: 'Selection', desc: 'Filter rows by condition', template: 'σ[condition](' },
  { symbol: 'π', label: 'Projection', desc: 'Pick specific columns', template: 'π[col1,col2](' },
  { symbol: '⋈', label: 'Natural Join', desc: 'Join on shared columns', template: ' ⋈ ' },
  { symbol: '∪', label: 'Union', desc: 'Combine rows from two sets', template: ' ∪ ' },
  { symbol: '−', label: 'Difference', desc: 'Subtract rows of one set', template: ' − ' },
  { symbol: '×', label: 'Cartesian', desc: 'Cross product of sets', template: ' × ' },
  { symbol: 'ρ', label: 'Rename', desc: 'Rename a relation', template: 'ρ[newName](' },
];

interface SymbolPaletteProps {
  onInsert: (text: string) => void;
}

export function SymbolPalette({ onInsert }: SymbolPaletteProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {SYMBOLS.map((s) => (
        <button
          key={s.symbol}
          onClick={() => onInsert(s.template)}
          title={`${s.label} — ${s.desc}`}
          className="group relative flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/40 text-base font-bold text-zinc-300 transition-all hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300 hover:shadow-sm hover:shadow-violet-500/10"
        >
          {s.symbol}
        </button>
      ))}
    </div>
  );
}
