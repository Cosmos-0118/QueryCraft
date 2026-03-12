'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { SymbolPalette, ALL_SYMBOLS, SHORTCUT_CODE_MAP } from './symbol-palette';
import { Play, Keyboard } from 'lucide-react';

// ── Autocomplete items ─────────────────────────────────────
interface CompletionItem {
  label: string;
  insert: string;
  detail: string;
  kind: 'operator' | 'keyword' | 'table' | 'function';
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
  tableNames?: string[];
}

export function AlgebraInput({ value, onChange, onEvaluate, tableNames = [] }: AlgebraInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMac] = useState(() =>
    typeof navigator !== 'undefined' ? /Mac|iPhone|iPad|iPod/.test(navigator.platform) : false,
  );

  // Build table completions dynamically
  const tableCompletions: CompletionItem[] = tableNames.map((name) => ({
    label: name,
    insert: name,
    detail: 'Table',
    kind: 'table' as const,
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
      const newVal = value.slice(0, wordStart) + item.insert + value.slice(cursor);
      onChange(newVal);
      setShowComplete(false);
      requestAnimationFrame(() => {
        el.focus();
        const pos = wordStart + item.insert.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [value, onChange],
  );

  // Update completions on value/cursor change
  const updateCompletions = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    // Extract the current word
    let wordStart = cursor;
    while (wordStart > 0 && /[\w]/.test(value[wordStart - 1])) {
      wordStart--;
    }
    const word = value.slice(wordStart, cursor).toLowerCase();

    if (word.length === 0) {
      setShowComplete(false);
      return;
    }

    const allItems = [...ALL_COMPLETIONS, ...tableCompletions];
    const filtered = allItems.filter((c) =>
      c.label.toLowerCase().includes(word),
    );

    if (filtered.length > 0) {
      setCompletions(filtered.slice(0, 12));
      setSelectedIdx(0);
      setShowComplete(true);
    } else {
      setShowComplete(false);
    }
  }, [value, tableCompletions]);

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter → evaluate
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onEvaluate();
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
    },
    [showComplete, completions, selectedIdx, onEvaluate, handleInsert, applyCompletion, value, onChange],
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
  };
  const kindBg: Record<string, string> = {
    operator: 'bg-violet-500/15 text-violet-400',
    keyword: 'bg-sky-500/15 text-sky-400',
    table: 'bg-emerald-500/15 text-emerald-400',
    function: 'bg-amber-500/15 text-amber-400',
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/60">
      <div className="flex items-center justify-between border-b border-zinc-700/40 bg-zinc-800/30 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Expression
        </span>
        <SymbolPalette onInsert={handleInsert} />
      </div>
      <div className="relative p-3">
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="e.g. π[name, gpa](σ[gpa > 3.5](students))  —  Start typing or use shortcuts"
          rows={3}
          className="w-full resize-none rounded-lg border border-zinc-700/30 bg-zinc-950/50 p-3 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
          autoComplete="off"
          spellCheck={false}
        />
        {/* ── Autocomplete dropdown ─── */}
        {showComplete && completions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-3 right-3 top-[calc(100%-8px)] z-50 max-h-64 overflow-y-auto rounded-lg border border-zinc-700/60 bg-zinc-900/98 shadow-xl shadow-black/40 backdrop-blur-sm"
          >
            {completions.map((item, i) => (
              <button
                key={`${item.kind}-${item.label}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyCompletion(item);
                }}
                onMouseEnter={() => setSelectedIdx(i)}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                  i === selectedIdx ? 'bg-violet-500/15' : 'hover:bg-zinc-800/60'
                }`}
              >
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${kindBg[item.kind]}`}>
                  {item.kind === 'operator' ? 'OP' : item.kind === 'keyword' ? 'KW' : item.kind === 'table' ? 'TBL' : 'FN'}
                </span>
                <span className={`font-mono text-sm font-semibold ${kindColors[item.kind]}`}>
                  {item.label}
                </span>
                <span className="ml-auto text-[11px] text-zinc-600">{item.detail}</span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-600">
              Press{' '}
              <kbd className="rounded border border-zinc-700/50 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                {isMac ? '⌘' : 'Ctrl'} Enter
              </kbd>{' '}
              to evaluate
            </span>
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="flex items-center gap-1 text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
            >
              <Keyboard className="h-3 w-3" />
              Shortcuts
            </button>
          </div>
          <button
            onClick={onEvaluate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-violet-500/20 transition-all hover:bg-violet-500 hover:shadow-violet-500/30 active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5" />
            Evaluate
          </button>
        </div>
        {/* ── Keyboard shortcuts panel ── */}
        {showShortcuts && (
          <div className="mt-3 rounded-lg border border-zinc-700/40 bg-zinc-800/50 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Keyboard Shortcuts — hold {isMac ? '⌥ Option' : 'Alt'} + key
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
              {ALL_SYMBOLS.filter((s) => s.key).map((s) => (
                <div key={s.symbol} className="flex items-center gap-2 text-xs">
                  <kbd className="inline-flex h-5 min-w-[3rem] items-center justify-center rounded border border-zinc-700/60 bg-zinc-900/80 px-1.5 font-mono text-[10px] text-zinc-400">
                    {isMac ? '⌥' : 'Alt+'}{s.key.replace('Key', '')}
                  </kbd>
                  <span className="font-mono text-sm text-violet-400">{s.symbol}</span>
                  <span className="text-zinc-500">{s.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">
              You can also type text aliases: <code className="text-zinc-400">sigma</code>, <code className="text-zinc-400">pi</code>, <code className="text-zinc-400">intersect</code>, <code className="text-zinc-400">join</code>, <code className="text-zinc-400">gamma</code>, <code className="text-zinc-400">tau</code>, etc.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
