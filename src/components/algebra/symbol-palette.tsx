'use client';

const SYMBOLS = [
  { symbol: 'σ', label: 'Selection', template: 'σ[condition](' },
  { symbol: 'π', label: 'Projection', template: 'π[col1,col2](' },
  { symbol: '⋈', label: 'Natural Join', template: ' ⋈ ' },
  { symbol: '∪', label: 'Union', template: ' ∪ ' },
  { symbol: '−', label: 'Difference', template: ' − ' },
  { symbol: '×', label: 'Cartesian', template: ' × ' },
  { symbol: 'ρ', label: 'Rename', template: 'ρ[newName](' },
];

interface SymbolPaletteProps {
  onInsert: (text: string) => void;
}

export function SymbolPalette({ onInsert }: SymbolPaletteProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SYMBOLS.map((s) => (
        <button
          key={s.symbol}
          onClick={() => onInsert(s.template)}
          title={s.label}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-lg font-bold transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
        >
          {s.symbol}
        </button>
      ))}
    </div>
  );
}
