'use client';

import { useRef, useEffect } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { sql, SQLite } from '@codemirror/lang-sql';
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
        sql({ dialect: SQLite, schema: schemaObj }),
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
            fontSize: '14px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          },
          '.cm-content': { padding: '12px 0', fontFamily: 'var(--font-mono), monospace' },
          '.cm-gutters': { borderRadius: '8px 0 0 8px' },
          '.cm-scroller': { borderRadius: '8px' },
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
      <div ref={editorRef} />
      <p className="mt-1 text-right text-xs text-muted-foreground">
        Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Cmd+Enter</kbd> to execute
      </p>
    </div>
  );
}
