'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { SymbolPalette, ALL_SYMBOLS, SHORTCUT_CODE_MAP } from './symbol-palette';
import { Play, Keyboard } from 'lucide-react';
import type { TableSchema } from '@/types/database';
import { getTextareaCaretCoordinates } from '@/lib/utils/textarea-caret';

// ── Autocomplete items ─────────────────────────────────────
interface CompletionItem {
  label: string;
  insert: string;
  detail: string;
  kind: 'operator' | 'keyword' | 'table' | 'function' | 'column';
}

const OPERATOR_COMPLETIONS: CompletionItem[] = [
  // Unary operators
  { label: 'σ  selection', insert: 'σ', detail: 'σ[condition](R) — Filter rows', kind: 'operator' },
  { label: 'π  projection', insert: 'π', detail: 'π[col1,col2](R) — Pick columns', kind: 'operator' },
  { label: 'ρ  rename', insert: 'ρ', detail: 'ρ[newName](R) — Rename relation', kind: 'operator' },
  { label: 'γ  aggregation', insert: 'γ', detail: 'γ[grp; COUNT(*) AS c](R) — Aggregate', kind: 'operator' },
  { label: 'τ  sort', insert: 'τ', detail: 'τ[col ASC](R) — Sort/order rows', kind: 'operator' },
  // Set operators
  { label: '∪  union', insert: ' ∪ ', detail: 'R ∪ S — Combine two sets', kind: 'operator' },
  { label: '∩  intersect', insert: ' ∩ ', detail: 'R ∩ S — Common rows', kind: 'operator' },
  { label: '−  difference', insert: ' − ', detail: 'R − S — Subtract rows', kind: 'operator' },
  { label: '÷  division', insert: ' ÷ ', detail: 'R ÷ S — Rows matching all of S', kind: 'operator' },
  { label: '×  cartesian', insert: ' × ', detail: 'R × S — Cross product', kind: 'operator' },
  // Joins
  { label: '⋈  natural join', insert: ' ⋈ ', detail: 'R ⋈ S — Join on shared columns', kind: 'operator' },
  { label: '⟕  left outer join', insert: ' ⟕ ', detail: 'R ⟕ S — Left outer join', kind: 'operator' },
  { label: '⟖  right outer join', insert: ' ⟖ ', detail: 'R ⟖ S — Right outer join', kind: 'operator' },
  { label: '⟗  full outer join', insert: ' ⟗ ', detail: 'R ⟗ S — Full outer join', kind: 'operator' },
  { label: '⋉  semi-join', insert: ' ⋉ ', detail: 'R ⋉ S — Left semi-join', kind: 'operator' },
  { label: '▷  anti-join', insert: ' ▷ ', detail: 'R ▷ S — Anti-join (no match)', kind: 'operator' },
];

const KEYWORD_COMPLETIONS: CompletionItem[] = [
  { label: 'sigma', insert: 'σ', detail: 'Selection — text alias', kind: 'keyword' },
  { label: 'select', insert: 'σ', detail: 'Selection — text alias', kind: 'keyword' },
  { label: 'pi', insert: 'π', detail: 'Projection — text alias', kind: 'keyword' },
  { label: 'project', insert: 'π', detail: 'Projection — text alias', kind: 'keyword' },
  { label: 'rho', insert: 'ρ', detail: 'Rename — text alias', kind: 'keyword' },
  { label: 'rename', insert: 'ρ', detail: 'Rename — text alias', kind: 'keyword' },
  { label: 'gamma', insert: 'γ', detail: 'Aggregation — text alias', kind: 'keyword' },
  { label: 'aggregate', insert: 'γ', detail: 'Aggregation — text alias', kind: 'keyword' },
  { label: 'tau', insert: 'τ', detail: 'Sort — text alias', kind: 'keyword' },
  { label: 'sort', insert: 'τ', detail: 'Sort — text alias', kind: 'keyword' },
  { label: 'orderby', insert: 'τ', detail: 'Sort — text alias', kind: 'keyword' },
  { label: 'union', insert: ' ∪ ', detail: 'Set union', kind: 'keyword' },
  { label: 'intersect', insert: ' ∩ ', detail: 'Set intersection', kind: 'keyword' },
  { label: 'minus', insert: ' − ', detail: 'Set difference', kind: 'keyword' },
  { label: 'diff', insert: ' − ', detail: 'Set difference', kind: 'keyword' },
  { label: 'cross', insert: ' × ', detail: 'Cartesian product', kind: 'keyword' },
  { label: 'div', insert: ' ÷ ', detail: 'Division', kind: 'keyword' },
  { label: 'join', insert: ' ⋈ ', detail: 'Natural join', kind: 'keyword' },
  { label: 'njoin', insert: ' ⋈ ', detail: 'Natural join', kind: 'keyword' },
  { label: 'ljoin', insert: ' ⟕ ', detail: 'Left outer join', kind: 'keyword' },
  { label: 'rjoin', insert: ' ⟖ ', detail: 'Right outer join', kind: 'keyword' },
  { label: 'fjoin', insert: ' ⟗ ', detail: 'Full outer join', kind: 'keyword' },
  { label: 'semijoin', insert: ' ⋉ ', detail: 'Semi-join', kind: 'keyword' },
  { label: 'antijoin', insert: ' ▷ ', detail: 'Anti-join', kind: 'keyword' },
];

const FUNCTION_COMPLETIONS: CompletionItem[] = [
  { label: 'COUNT', insert: 'COUNT', detail: 'Count values', kind: 'function' },
  { label: 'SUM', insert: 'SUM', detail: 'Sum values', kind: 'function' },
  { label: 'AVG', insert: 'AVG', detail: 'Average values', kind: 'function' },
  { label: 'MIN', insert: 'MIN', detail: 'Minimum value', kind: 'function' },
  { label: 'MAX', insert: 'MAX', detail: 'Maximum value', kind: 'function' },
];

const ALL_COMPLETIONS = [...OPERATOR_COMPLETIONS, ...KEYWORD_COMPLETIONS, ...FUNCTION_COMPLETIONS];

// ── Auto-close pairs ───────────────────────────────────────
const BRACKET_PAIRS: Record<string, string> = { '[': ']', '(': ')', '{': '}' };
const QUOTE_CHARS = new Set(["'", '"']);
const CLOSE_CHARS = new Set([']', ')', '}', "'", '"']);

interface AlgebraInputProps {
  value: string;
  onChange: (value: string) => void;
  onEvaluate: () => void;
  tables?: TableSchema[];
  tableNames?: string[];
  historyExpressions?: string[];
  executionFeedback?: 'idle' | 'success' | 'error';
  focusRequestKey?: number;
}

function rankCompletion(item: CompletionItem, query: string): number {
  const q = query.trim().toLowerCase();
  const haystack = `${item.label} ${item.detail}`.toLowerCase();
  if (!q) return item.kind === 'operator' ? 10 : 30;
  if (item.label.toLowerCase() === q) return 0;
  if (item.label.toLowerCase().startsWith(q)) return 10;
  if (haystack.startsWith(q)) return 20;
  if (item.label.toLowerCase().includes(q)) return 30;
  if (haystack.includes(q)) return 40;
  return 999;
}

export function AlgebraInput({
  value,
  onChange,
  onEvaluate,
  tables = [],
  tableNames = [],
  historyExpressions = [],
  executionFeedback = 'idle',
  focusRequestKey,
}: AlgebraInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ left: 0, top: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const historyIndexRef = useRef<number | null>(null);
  const historyDraftRef = useRef('');
  const [isMac] = useState(() =>
    typeof navigator !== 'undefined' ? /Mac|iPhone|iPad|iPod/.test(navigator.platform) : false,
  );

  // Build table + column completions dynamically
  const effectiveTableNames = tableNames.length > 0 ? tableNames : tables.map((table) => table.name);
  const tableCompletions: CompletionItem[] = effectiveTableNames.map((name) => ({
    label: name,
    insert: name,
    detail: 'Table',
    kind: 'table' as const,
  }));

  const columnCompletions: CompletionItem[] = Array.from(
    new Set(tables.flatMap((table) => table.columns.map((column) => column.name))),
  ).map((column) => ({
    label: column,
    insert: column,
    detail: 'Column',
    kind: 'column' as const,
  }));

  const handleInsert = useCallback(
    (text: string) => {
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
    },
    [value, onChange],
  );

  // Autocomplete: apply selected item
  const applyCompletion = useCallback(
    (item: CompletionItem) => {
      const el = inputRef.current;
      if (!el) return;
      const cursor = el.selectionStart;
      // Find the word being typed (look back for word chars)
      let wordStart = cursor;
      while (wordStart > 0 && /[\w]/.test(value[wordStart - 1])) {
        wordStart--;
      }
      // Trim leading space if at start or already preceded by a space
      let text = item.insert;
      const charBefore = wordStart > 0 ? value[wordStart - 1] : '';
      if (charBefore === '' || charBefore === ' ') {
        text = text.replace(/^ /, '');
      }
      const newVal = value.slice(0, wordStart) + text + value.slice(cursor);
      onChange(newVal);
      setShowComplete(false);
      requestAnimationFrame(() => {
        el.focus();
        const pos = wordStart + text.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [value, onChange],
  );

  // Update completions on value/cursor change
  const updateCompletions = useCallback((force = false) => {
    const el = inputRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    // Extract the current word
    let wordStart = cursor;
    while (wordStart > 0 && /[\w]/.test(value[wordStart - 1])) {
      wordStart--;
    }
    const word = value.slice(wordStart, cursor).toLowerCase();

    if (!force && word.length === 0) {
      setShowComplete(false);
      return;
    }

    const allItems = [...ALL_COMPLETIONS, ...tableCompletions, ...columnCompletions];
    const filtered = allItems
      .map((item) => ({ item, rank: rankCompletion(item, word) }))
      .filter((entry) => force || entry.rank < 999)
      .sort((a, b) => a.rank - b.rank || a.item.label.localeCompare(b.item.label))
      .slice(0, 8)
      .map((entry) => entry.item);

    if (filtered.length > 0) {
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
      setCompletions(filtered);
      setSelectedIdx(0);
      setShowComplete(true);
    } else {
      setShowComplete(false);
    }
  }, [columnCompletions, tableCompletions, value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  // Trigger autocomplete on every keystroke
  useEffect(() => {
    updateCompletions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (focusRequestKey === undefined) return;
    const el = inputRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const pos = input.value.length;
      input.setSelectionRange(pos, pos);
    });
  }, [focusRequestKey]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter → evaluate
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onEvaluate();
        return;
      }

      // Cmd/Ctrl+Space -> open suggestions explicitly
      if ((e.metaKey || e.ctrlKey) && e.key === ' ') {
        e.preventDefault();
        updateCompletions(true);
        return;
      }

      // Auto-close brackets: [ → [], ( → (), { → {}
      const closing = BRACKET_PAIRS[e.key];
      if (closing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = inputRef.current;
        if (el) {
          e.preventDefault();
          const start = el.selectionStart;
          const end = el.selectionEnd;
          const selected = value.slice(start, end);
          const newVal = value.slice(0, start) + e.key + selected + closing + value.slice(end);
          onChange(newVal);
          requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + 1, start + 1 + selected.length);
          });
          return;
        }
      }

      // Auto-close quotes: ' → '', " → ""
      if (QUOTE_CHARS.has(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = inputRef.current;
        if (el) {
          const start = el.selectionStart;
          const end = el.selectionEnd;
          // If next char is the same quote, skip over it
          if (start === end && value[start] === e.key) {
            e.preventDefault();
            el.setSelectionRange(start + 1, start + 1);
            return;
          }
          // Otherwise auto-close
          e.preventDefault();
          const selected = value.slice(start, end);
          const newVal = value.slice(0, start) + e.key + selected + e.key + value.slice(end);
          onChange(newVal);
          requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + 1, start + 1 + selected.length);
          });
          return;
        }
      }

      // Skip over closing bracket if already there
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

      // Backspace: delete matching pair (brackets and quotes)
      if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = inputRef.current;
        if (el) {
          const pos = el.selectionStart;
          if (pos > 0 && pos === el.selectionEnd) {
            const before = value[pos - 1];
            const after = value[pos];
            const isMatchingPair =
              BRACKET_PAIRS[before] === after ||
              (QUOTE_CHARS.has(before) && before === after);
            if (isMatchingPair) {
              e.preventDefault();
              const newVal = value.slice(0, pos - 1) + value.slice(pos + 1);
              onChange(newVal);
              requestAnimationFrame(() => {
                el.focus();
                el.setSelectionRange(pos - 1, pos - 1);
              });
              return;
            }
          }
        }
      }

      // Alt/Option+key shortcuts for symbol insertion (use e.code for Mac)
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const template = SHORTCUT_CODE_MAP[e.code];
        if (template) {
          e.preventDefault();
          handleInsert(template);
          setShowComplete(false);
          return;
        }
      }

      // Autocomplete navigation
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

      if (!showComplete && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const history = Array.from(
          new Set(historyExpressions.map((entry) => entry.trim()).filter(Boolean)),
        );
        const el = inputRef.current;
        if (!el || history.length === 0) return;

        const hasLineBeforeCursor = value.slice(0, el.selectionStart).includes('\n');
        const hasLineAfterCursor = value.slice(el.selectionStart).includes('\n');

        if (e.key === 'ArrowUp' && !hasLineBeforeCursor && el.selectionStart === el.selectionEnd) {
          e.preventDefault();
          const nextIndex =
            historyIndexRef.current === null
              ? 0
              : Math.min(historyIndexRef.current + 1, history.length - 1);

          if (historyIndexRef.current === null) {
            historyDraftRef.current = value;
          }

          historyIndexRef.current = nextIndex;
          const nextValue = history[nextIndex] ?? '';
          onChange(nextValue);
          requestAnimationFrame(() => {
            const target = inputRef.current;
            if (!target) return;
            target.focus();
            target.setSelectionRange(nextValue.length, nextValue.length);
          });
          return;
        }

        if (e.key === 'ArrowDown' && !hasLineAfterCursor && el.selectionStart === el.selectionEnd) {
          if (historyIndexRef.current === null) return;
          e.preventDefault();

          const nextIndex = historyIndexRef.current - 1;
          const nextValue = nextIndex < 0 ? historyDraftRef.current : (history[nextIndex] ?? '');
          historyIndexRef.current = nextIndex < 0 ? null : nextIndex;
          onChange(nextValue);
          requestAnimationFrame(() => {
            const target = inputRef.current;
            if (!target) return;
            target.focus();
            target.setSelectionRange(nextValue.length, nextValue.length);
          });
          return;
        }
      }
    },
    [
      showComplete,
      completions,
      selectedIdx,
      onEvaluate,
      handleInsert,
      applyCompletion,
      value,
      onChange,
      updateCompletions,
      historyExpressions,
    ],
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowComplete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const kindColors: Record<string, string> = {
    operator: 'text-violet-400',
    keyword: 'text-sky-400',
    table: 'text-emerald-400',
    function: 'text-amber-400',
    column: 'text-cyan-300',
  };
  const kindBg: Record<string, string> = {
    operator: 'bg-violet-500/15 text-violet-400',
    keyword: 'bg-sky-500/15 text-sky-400',
    table: 'bg-emerald-500/15 text-emerald-400',
    function: 'bg-amber-500/15 text-amber-400',
    column: 'bg-cyan-500/15 text-cyan-300',
  };

  return (
    <div
      className={`rounded-xl border border-slate-300 bg-white ${executionFeedback === 'success'
          ? 'execute-feedback-success'
          : executionFeedback === 'error'
            ? 'execute-feedback-error'
            : ''
        }`}
    >
      <div className="flex items-center justify-between rounded-t-xl border-b border-slate-300 bg-slate-200/70 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Expression
        </span>
        <SymbolPalette onInsert={handleInsert} />
      </div>
      <div ref={containerRef} className="relative p-3">
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="e.g. π[name, gpa](σ[gpa > 3.5](students))  —  Start typing or use shortcuts"
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-400 bg-white p-3 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-slate-600 focus:ring-1 focus:ring-slate-400"
          autoComplete="off"
          spellCheck={false}
          onClick={() => updateCompletions(showComplete)}
          onKeyUp={() => updateCompletions(showComplete)}
        />
        {/* ── Autocomplete dropdown ─── */}
        {showComplete && completions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-3 top-[calc(100%-8px)] z-50 max-h-52 w-[min(92vw,36rem)] overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-lg shadow-slate-400/20 backdrop-blur-sm"
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
                className={`flex w-full items-center gap-2 px-2.5 py-1 text-left transition-colors ${i === selectedIdx ? 'bg-slate-200' : 'hover:bg-slate-100'
                  }`}
              >
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${kindBg[item.kind]}`}>
                  {item.kind === 'operator' ? 'OP' : item.kind === 'keyword' ? 'KW' : item.kind === 'table' ? 'TBL' : item.kind === 'column' ? 'COL' : 'FN'}
                </span>
                <span className={`font-mono text-[13px] font-semibold ${kindColors[item.kind]}`}>
                  {item.label}
                </span>
                <span className="ml-auto hidden max-w-[45%] truncate text-[10px] text-slate-500 md:block">{item.detail}</span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">
              Press{' '}
              <kbd className="rounded border border-slate-400 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-100">
                {isMac ? '⌘' : 'Ctrl'} Enter
              </kbd>{' '}
              to evaluate
            </span>
            <span className="text-xs text-slate-600">
              <kbd className="rounded border border-slate-400 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-100">
                {isMac ? '⌘' : 'Ctrl'} Space
              </kbd>{' '}
              suggestions
            </span>
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="flex items-center gap-1 text-[11px] text-slate-600 transition-colors hover:text-slate-800"
            >
              <Keyboard className="h-3 w-3" />
              Shortcuts
            </button>
          </div>
          <button
            onClick={onEvaluate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-700 px-4 py-1.5 text-sm font-semibold text-slate-50 shadow-sm transition-colors hover:border-slate-800 hover:bg-slate-800 active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5" />
            Evaluate
          </button>
        </div>
        {/* ── Keyboard shortcuts panel ── */}
        {showShortcuts && (
          <div className="mt-3 rounded-lg border border-slate-300 bg-slate-100 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Keyboard Shortcuts — hold {isMac ? '⌥ Option' : 'Alt'} + key
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
              {ALL_SYMBOLS.filter((s) => s.key).map((s) => (
                <div key={s.symbol} className="flex items-center gap-2 text-xs">
                  <kbd className="inline-flex h-5 min-w-[3rem] items-center justify-center rounded border border-slate-300 bg-white px-1.5 font-mono text-[10px] text-slate-600">
                    {isMac ? '⌥' : 'Alt+'}{s.key.replace('Key', '')}
                  </kbd>
                  <span className="font-mono text-sm text-violet-400">{s.symbol}</span>
                  <span className="text-slate-600">{s.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-600">
              You can also type text aliases: <code className="text-slate-800">sigma</code>, <code className="text-slate-800">pi</code>, <code className="text-slate-800">intersect</code>, <code className="text-slate-800">join</code>, <code className="text-slate-800">gamma</code>, <code className="text-slate-800">tau</code>, etc.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
