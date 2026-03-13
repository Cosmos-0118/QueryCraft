'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TableSchema } from '@/types/database';
import { Keyboard, Play } from 'lucide-react';
import { getTextareaCaretCoordinates } from '@/lib/utils/textarea-caret';

interface CompletionItem {
  label: string;
  insert: string;
  detail: string;
  kind: 'keyword' | 'operator' | 'table' | 'column' | 'template';
}

const BASE_COMPLETIONS: CompletionItem[] = [
  { label: 'exists', insert: '∃', detail: 'Existential quantifier', kind: 'keyword' },
  { label: 'forall', insert: '∀', detail: 'Universal quantifier', kind: 'keyword' },
  { label: 'and', insert: ' ∧ ', detail: 'Logical conjunction', kind: 'operator' },
  { label: 'or', insert: ' ∨ ', detail: 'Logical disjunction', kind: 'operator' },
  { label: 'not', insert: '¬', detail: 'Logical negation', kind: 'operator' },
  { label: 'template set', insert: '{ t | relation(t) }', detail: 'Basic TRC set form', kind: 'template' },
  {
    label: 'template projection',
    insert: '{ <t.col1, t.col2> | relation(t) ∧ t.col1 > 0 }',
    detail: 'Projected tuple form',
    kind: 'template',
  },
  {
    label: 'template existential',
    insert: '{ t | relation(t) ∧ ∃u (other(u) ∧ u.id = t.id) }',
    detail: 'Query with existential quantifier',
    kind: 'template',
  },
  {
    label: 'template universal',
    insert: '{ t | relation(t) ∧ ∀u (other(u) ∨ u.id = t.id) }',
    detail: 'Query with universal quantifier',
    kind: 'template',
  },
];

const BRACKET_PAIRS: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
const QUOTE_CHARS = new Set(["'", '"']);
const CLOSE_CHARS = new Set(['}', ']', ')', "'", '"']);

interface TupleCalculusInputProps {
  value: string;
  onChange: (value: string) => void;
  onEvaluate: () => void;
  tables?: TableSchema[];
  executionFeedback?: 'idle' | 'success' | 'error';
}

function rankCompletion(item: CompletionItem, query: string): number {
  const q = query.trim().toLowerCase();
  const haystack = `${item.label} ${item.detail}`.toLowerCase();
  if (!q) return item.kind === 'template' ? 20 : 40;
  if (item.label.toLowerCase() === q) return 0;
  if (item.label.toLowerCase().startsWith(q)) return 10;
  if (haystack.startsWith(q)) return 20;
  if (item.label.toLowerCase().includes(q)) return 30;
  if (haystack.includes(q)) return 40;
  return 999;
}

export function TupleCalculusInput({
  value,
  onChange,
  onEvaluate,
  tables = [],
  executionFeedback = 'idle',
}: TupleCalculusInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showComplete, setShowComplete] = useState(false);
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ left: 0, top: 0 });
  const [isMac] = useState(() =>
    typeof navigator !== 'undefined' ? /Mac|iPhone|iPad|iPod/.test(navigator.platform) : false,
  );

  const tableCompletions = useMemo<CompletionItem[]>(() => {
    return tables.map((table) => ({
      label: table.name,
      insert: `${table.name}(t)`,
      detail: 'Relation predicate',
      kind: 'table',
    }));
  }, [tables]);

  const columnCompletions = useMemo<CompletionItem[]>(() => {
    const unique = new Set<string>();
    const items: CompletionItem[] = [];
    for (const table of tables) {
      for (const column of table.columns) {
        const key = column.name.toLowerCase();
        if (unique.has(key)) continue;
        unique.add(key);
        items.push({
          label: column.name,
          insert: `t.${column.name}`,
          detail: 'Tuple attribute',
          kind: 'column',
        });
      }
    }
    return items;
  }, [tables]);

  const allCompletions = useMemo(
    () => [...BASE_COMPLETIONS, ...tableCompletions, ...columnCompletions],
    [tableCompletions, columnCompletions],
  );

  const applyCompletion = useCallback(
    (item: CompletionItem) => {
      const el = inputRef.current;
      if (!el) return;

      const cursor = el.selectionStart;
      let wordStart = cursor;
      while (wordStart > 0 && /[\w]/.test(value[wordStart - 1])) {
        wordStart--;
      }

      let insertText = item.insert;
      const before = wordStart > 0 ? value[wordStart - 1] : '';
      if (before === '' || before === ' ') {
        insertText = insertText.replace(/^ /, '');
      }

      const nextValue = value.slice(0, wordStart) + insertText + value.slice(cursor);
      onChange(nextValue);
      setShowComplete(false);

      requestAnimationFrame(() => {
        el.focus();
        const pos = wordStart + insertText.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [onChange, value],
  );

  const updateCompletions = useCallback(
    (force = false) => {
      const el = inputRef.current;
      if (!el) return;

      const cursor = el.selectionStart;
      let wordStart = cursor;
      while (wordStart > 0 && /[\w]/.test(value[wordStart - 1])) {
        wordStart--;
      }
      const word = value.slice(wordStart, cursor).toLowerCase();

      if (!force && word.length === 0) {
        setShowComplete(false);
        return;
      }

      const ranked = allCompletions
        .map((item) => ({ item, rank: rankCompletion(item, word) }))
        .filter((entry) => force || entry.rank < 999)
        .sort((a, b) => a.rank - b.rank || a.item.label.localeCompare(b.item.label))
        .slice(0, 8)
        .map((entry) => entry.item);

      if (ranked.length === 0) {
        setShowComplete(false);
        return;
      }

      if (inputRef.current && containerRef.current) {
        const caret = getTextareaCaretCoordinates(inputRef.current, inputRef.current.selectionStart);
        const containerWidth = containerRef.current.clientWidth;
        const desiredLeft = caret.left + 12;
        const maxLeft = Math.max(12, containerWidth - 12 - 576);
        setDropdownPos({
          left: Math.min(desiredLeft, maxLeft),
          top: caret.top + caret.lineHeight + 10,
        });
      }

      setCompletions(ranked);
      setSelectedIdx(0);
      setShowComplete(true);
    },
    [allCompletions, value],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ' ') {
        e.preventDefault();
        updateCompletions(true);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onEvaluate();
        return;
      }

      const closing = BRACKET_PAIRS[e.key];
      if (closing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = inputRef.current;
        if (el) {
          e.preventDefault();
          const start = el.selectionStart;
          const end = el.selectionEnd;
          const selected = value.slice(start, end);
          const nextValue = value.slice(0, start) + e.key + selected + closing + value.slice(end);
          onChange(nextValue);
          requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + 1, start + 1 + selected.length);
          });
          return;
        }
      }

      if (QUOTE_CHARS.has(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = inputRef.current;
        if (el) {
          const start = el.selectionStart;
          const end = el.selectionEnd;
          if (start === end && value[start] === e.key) {
            e.preventDefault();
            el.setSelectionRange(start + 1, start + 1);
            return;
          }
          e.preventDefault();
          const selected = value.slice(start, end);
          const nextValue = value.slice(0, start) + e.key + selected + e.key + value.slice(end);
          onChange(nextValue);
          requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + 1, start + 1 + selected.length);
          });
          return;
        }
      }

      if (CLOSE_CHARS.has(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = inputRef.current;
        if (el) {
          const pos = el.selectionStart;
          if (value[pos] === e.key) {
            e.preventDefault();
            el.setSelectionRange(pos + 1, pos + 1);
            return;
          }
        }
      }

      if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = inputRef.current;
        if (el) {
          const pos = el.selectionStart;
          if (pos > 0 && pos === el.selectionEnd) {
            const before = value[pos - 1];
            const after = value[pos];
            const pair = BRACKET_PAIRS[before];
            const isPair = pair === after || (QUOTE_CHARS.has(before) && before === after);
            if (isPair) {
              e.preventDefault();
              const nextValue = value.slice(0, pos - 1) + value.slice(pos + 1);
              onChange(nextValue);
              requestAnimationFrame(() => {
                el.focus();
                el.setSelectionRange(pos - 1, pos - 1);
              });
              return;
            }
          }
        }
      }

      if (showComplete && completions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIdx((prev) => (prev + 1) % completions.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIdx((prev) => (prev - 1 + completions.length) % completions.length);
          return;
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          applyCompletion(completions[selectedIdx]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowComplete(false);
          return;
        }
      }
    },
    [applyCompletion, completions, onChange, onEvaluate, selectedIdx, showComplete, updateCompletions, value],
  );

  useEffect(() => {
    updateCompletions(false);
  }, [updateCompletions, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowComplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const kindBadge: Record<CompletionItem['kind'], string> = {
    keyword: 'bg-cyan-500/15 text-cyan-300',
    operator: 'bg-blue-500/15 text-blue-300',
    table: 'bg-emerald-500/15 text-emerald-300',
    column: 'bg-violet-500/15 text-violet-300',
    template: 'bg-zinc-700/60 text-zinc-300',
  };

  return (
    <div
      className={`rounded-xl border border-zinc-700/50 bg-zinc-900/60 ${
        executionFeedback === 'success'
          ? 'execute-feedback-success'
          : executionFeedback === 'error'
            ? 'execute-feedback-error'
            : ''
      }`}
    >
      <div className="flex items-center justify-between rounded-t-xl border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">TRC Expression</span>
        <div className="flex items-center gap-1.5">
          {[
            { label: '∃', insert: '∃' },
            { label: '∀', insert: '∀' },
            { label: '∧', insert: ' ∧ ' },
            { label: '∨', insert: ' ∨ ' },
            { label: '¬', insert: '¬' },
          ].map((token) => (
            <button
              key={token.label}
              onClick={() => {
                const el = inputRef.current;
                if (!el) {
                  onChange(value + token.insert);
                  return;
                }
                const start = el.selectionStart;
                const end = el.selectionEnd;
                const nextValue = value.slice(0, start) + token.insert + value.slice(end);
                onChange(nextValue);
                requestAnimationFrame(() => {
                  el.focus();
                  const pos = start + token.insert.length;
                  el.setSelectionRange(pos, pos);
                });
              }}
              className="rounded-md border border-zinc-700/50 bg-zinc-900/60 px-2 py-0.5 font-mono text-xs text-cyan-300 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10"
            >
              {token.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative p-3">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          className="w-full resize-none rounded-lg border border-zinc-700/30 bg-zinc-950/50 p-3 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
          placeholder="{ <t.name, t.gpa> | students(t) ∧ t.gpa > 3.5 }"
          autoComplete="off"
          spellCheck={false}
          onClick={() => updateCompletions(showComplete)}
          onKeyUp={() => updateCompletions(showComplete)}
        />

        {showComplete && completions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-3 top-[calc(100%-8px)] z-50 max-h-52 w-[min(92vw,36rem)] overflow-y-auto rounded-lg border border-zinc-700/70 bg-zinc-900/98 shadow-xl shadow-black/40"
            style={{ left: dropdownPos.left, top: dropdownPos.top }}
          >
            {completions.map((item, i) => (
              <button
                key={`${item.kind}-${item.label}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyCompletion(item);
                }}
                onMouseEnter={() => setSelectedIdx(i)}
                className={`flex w-full items-center gap-2 px-2.5 py-1 text-left transition-colors ${
                  i === selectedIdx ? 'bg-cyan-500/15' : 'hover:bg-zinc-800/60'
                }`}
              >
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${kindBadge[item.kind]}`}>
                  {item.kind.slice(0, 3)}
                </span>
                <span className="font-mono text-[13px] text-zinc-200">{item.label}</span>
                <span className="ml-auto hidden max-w-[45%] truncate text-[10px] text-zinc-500 md:block">{item.detail}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-600">
              <kbd className="rounded border border-zinc-700/50 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                {isMac ? '⌘' : 'Ctrl'} Enter
              </kbd>{' '}
              evaluate
            </span>
            <span className="text-xs text-zinc-600">
              <kbd className="rounded border border-zinc-700/50 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                {isMac ? '⌘' : 'Ctrl'} Space
              </kbd>{' '}
              suggestions
            </span>
            <button
              onClick={() => setShowHelp((prev) => !prev)}
              className="flex items-center gap-1 text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
            >
              <Keyboard className="h-3 w-3" />
              Help
            </button>
          </div>
          <button
            onClick={onEvaluate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-1.5 text-sm font-semibold text-white transition-all hover:bg-cyan-500"
          >
            <Play className="h-3.5 w-3.5" />
            Evaluate TRC
          </button>
        </div>

        {showHelp && (
          <div className="mt-3 rounded-lg border border-zinc-700/40 bg-zinc-800/50 p-3 text-xs text-zinc-400">
            Use TRC set form: <span className="font-mono text-cyan-300">{`{ target | formula }`}</span>. Relation predicates use
            <span className="font-mono text-cyan-300"> relation(t)</span>. Quantifiers: <span className="font-mono text-cyan-300">∃</span>,
            <span className="font-mono text-cyan-300"> ∀</span>. Attributes: <span className="font-mono text-cyan-300">t.column</span>.
          </div>
        )}
      </div>
    </div>
  );
}
