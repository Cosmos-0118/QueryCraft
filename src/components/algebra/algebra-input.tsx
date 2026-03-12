'use client';

import { useRef } from 'react';
import { SymbolPalette } from './symbol-palette';
import { Play } from 'lucide-react';

interface AlgebraInputProps {
  value: string;
  onChange: (value: string) => void;
  onEvaluate: () => void;
}

export function AlgebraInput({ value, onChange, onEvaluate }: AlgebraInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleInsert = (text: string) => {
    const el = inputRef.current;
    if (!el) {
      onChange(value + text);
      return;
    }
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
    <div className="overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/60">
      <div className="flex items-center justify-between border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
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
          placeholder="e.g. π[name, gpa](σ[gpa > 3.5](students))"
          rows={3}
          className="w-full resize-none rounded-lg border border-zinc-700/30 bg-zinc-950/50 p-3 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
        />
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-xs text-zinc-600">
            Press{' '}
            <kbd className="rounded border border-zinc-700/50 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              ⌘ Enter
            </kbd>{' '}
            to evaluate
          </span>
          <button
            onClick={onEvaluate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-violet-500/20 transition-all hover:bg-violet-500 hover:shadow-violet-500/30 active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5" />
            Evaluate
          </button>
        </div>
      </div>
    </div>
  );
}
