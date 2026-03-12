'use client';

import { useRef } from 'react';
import { SymbolPalette } from './symbol-palette';

interface AlgebraInputProps {
  value: string;
  onChange: (value: string) => void;
  onEvaluate: () => void;
}

export function AlgebraInput({ value, onChange, onEvaluate }: AlgebraInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleInsert = (text: string) => {
    const el = inputRef.current;
    if (!el) { onChange(value + text); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = value.slice(0, start) + text + value.slice(end);
    onChange(newVal);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Expression
        </span>
        <SymbolPalette onInsert={handleInsert} />
      </div>
      <div className="p-3">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              onEvaluate();
            }
          }}
          placeholder="e.g. π[name,gpa](σ[gpa > 3.5](students))"
          rows={3}
          className="w-full resize-none rounded-md bg-background p-3 font-mono text-sm outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Cmd+Enter</kbd> to evaluate
          </p>
          <button
            onClick={onEvaluate}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Evaluate
          </button>
        </div>
      </div>
    </div>
  );
}
