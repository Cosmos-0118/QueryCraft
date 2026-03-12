'use client';

import { useRef, useEffect } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { sql, MySQL } from '@codemirror/lang-sql';
import { defaultKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion } from '@codemirror/autocomplete';
import type { TableSchema } from '@/types/database';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  tables?: TableSchema[];
  className?: string;
}

export function SqlEditor({ value, onChange, onExecute, tables = [], className }: SqlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const schemaObj: Record<string, string[]> = {};
    tables.forEach((t) => {
      schemaObj[t.name] = t.columns.map((c) => c.name);
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        sql({ dialect: MySQL, schema: schemaObj }),
        autocompletion(),
        oneDark,
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              onExecute();
              return true;
            },
          },
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            fontSize: '13px',
            background: 'transparent',
          },
          '.cm-content': { padding: '14px 0', fontFamily: 'var(--font-mono), monospace' },
          '.cm-gutters': { background: 'transparent', border: 'none', color: '#3f3f46' },
          '.cm-scroller': { borderRadius: '12px' },
          '.cm-activeLine': { backgroundColor: 'rgba(113,113,122,0.08)' },
          '.cm-activeLineGutter': { backgroundColor: 'transparent' },
        }),
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // Only recreate editor on mount/tables change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.map((t) => t.name).join(',')]);

  return (
    <div className={className}>
      <div
        className="overflow-hidden rounded-xl border border-zinc-700/50"
        style={{ background: 'linear-gradient(180deg, rgba(24,24,27,0.95) 0%, rgba(18,18,21,0.98) 100%)' }}
        ref={editorRef}
      />
      <p className="mt-1.5 text-right text-[11px] text-zinc-600">
        Press <kbd className="rounded-md border border-zinc-700/50 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">⌘ Enter</kbd> to execute
      </p>
    </div>
  );
}
