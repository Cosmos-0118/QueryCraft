'use client';

import { use, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getExerciseById } from '@/lib/exercises/exercise-bank';
import { useSessionPersistence } from '@/hooks/use-session-persistence';
import type { GradingResult } from '@/types/exercise';
import { useProgressStore } from '@/stores/progress-store';
import {
  ArrowLeft, CheckCircle2, XCircle, Lightbulb, Star, Zap, Trophy,
  Send, Eye, EyeOff, Code2, Sigma, RefreshCw, PenTool,
} from 'lucide-react';

export default function ExercisePage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = use(params);
  const router = useRouter();
  const exercise = getExerciseById(exerciseId);

  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<GradingResult | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const { recordExerciseAttempt } = useProgressStore();

  // Auto-save session
  const { save } = useSessionPersistence();
  useEffect(() => {
    save({ lastPage: 'exercise', lastExerciseId: exerciseId });
  }, [save, exerciseId]);

  const handleSubmit = useCallback(() => {
    if (!exercise) return;

    let isCorrect = false;

    if (exercise.type === 'sql' && exercise.expectedResult) {
      const trimmed = answer.trim();
      if (!trimmed) {
        setResult({ isCorrect: false, feedback: 'Please enter your answer before submitting.' });
        return;
      }

      const solution = exercise.hints[exercise.hints.length - 1];
      const normalizeStr = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/;$/, '');
      if (normalizeStr(trimmed) === normalizeStr(solution)) {
        isCorrect = true;
        setResult({
          isCorrect: true,
          feedback: 'Correct! Your query matches the expected solution.',
          expected: exercise.expectedResult,
          actual: exercise.expectedResult,
        });
      } else {
        setResult({
          isCorrect: false,
          feedback: 'Your query doesn\'t match the expected solution. Try checking the hints for guidance, or compare your approach with the expected output.',
          expected: exercise.expectedResult,
        });
      }
    } else {
      const trimmed = answer.trim();
      if (!trimmed) {
        setResult({ isCorrect: false, feedback: 'Please enter your answer before submitting.' });
        return;
      }
      const solution = exercise.hints[exercise.hints.length - 1];
      const normalizeStr = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
      if (normalizeStr(trimmed) === normalizeStr(solution)) {
        isCorrect = true;
        setResult({ isCorrect: true, feedback: 'Correct! Well done.' });
      } else {
        setResult({
          isCorrect: false,
          feedback: 'Not quite. Review your answer and try again. Use hints if you\'re stuck.',
        });
      }
    }

    recordExerciseAttempt(exercise.id, exercise.type, exercise.difficulty, exercise.topicSlug, isCorrect);
  }, [exercise, answer, recordExerciseAttempt]);

  if (!exercise) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-zinc-200">Exercise Not Found</h2>
          <button
            onClick={() => router.push('/practice')}
            className="mt-4 text-sm text-blue-400 hover:text-blue-300"
          >
            ← Back to Practice
          </button>
        </div>
      </div>
    );
  }

  const typeIcons = { sql: Code2, algebra: Sigma, normalization: RefreshCw, 'er-diagram': PenTool };
  const TypeIcon = typeIcons[exercise.type] ?? Code2;
  const diffMeta = {
    easy: { icon: Star, color: 'text-emerald-400 bg-emerald-500/10' },
    medium: { icon: Zap, color: 'text-amber-400 bg-amber-500/10' },
    hard: { icon: Trophy, color: 'text-rose-400 bg-rose-500/10' },
  };
  const diff = diffMeta[exercise.difficulty];
  const DiffIcon = diff.icon;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      {/* Back */}
      <button
        onClick={() => router.push('/practice')}
        className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft size={14} /> Back to Practice
      </button>

      {/* Exercise Header */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-zinc-800 p-2.5">
            <TypeIcon size={20} className="text-zinc-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-100">{exercise.title}</h1>
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${diff.color}`}>
                <DiffIcon size={10} /> {exercise.difficulty}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">{exercise.description}</p>
          </div>
        </div>

        {/* Setup SQL info */}
        {exercise.setupSql && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Setup Tables</span>
            <pre className="mt-1 overflow-x-auto text-xs text-zinc-400">
              {exercise.setupSql}
            </pre>
          </div>
        )}
      </div>

      {/* Answer Input */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <label className="text-sm font-medium text-zinc-300">Your Answer</label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={
            exercise.type === 'sql'
              ? 'Write your SQL query here...'
              : 'Write your answer here...'
          }
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-200 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          rows={5}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Send size={14} /> Submit Answer
          </button>
          <button
            onClick={() => setShowHints(!showHints)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            {showHints ? <EyeOff size={14} /> : <Eye size={14} />}
            {showHints ? 'Hide Hints' : 'Show Hints'}
          </button>
        </div>
      </div>

      {/* Hints */}
      {showHints && exercise.hints.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
            <Lightbulb size={14} /> Hints
          </div>
          {exercise.hints.slice(0, hintsShown + 1).map((hint, i) => (
            <div key={i} className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3 text-sm text-zinc-300">
              <span className="mr-2 text-xs font-bold text-amber-500/60">Hint {i + 1}:</span>
              {hint}
            </div>
          ))}
          {hintsShown < exercise.hints.length - 1 && (
            <button
              onClick={() => setHintsShown((h) => h + 1)}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              Show next hint ({hintsShown + 1}/{exercise.hints.length})
            </button>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`rounded-xl border p-5 ${
            result.isCorrect
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-rose-500/20 bg-rose-500/5'
          }`}
        >
          <div className="flex items-center gap-2">
            {result.isCorrect ? (
              <CheckCircle2 size={20} className="text-emerald-400" />
            ) : (
              <XCircle size={20} className="text-rose-400" />
            )}
            <span
              className={`font-semibold ${result.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {result.isCorrect ? 'Correct!' : 'Incorrect'}
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-300">{result.feedback}</p>

          {/* Expected vs Actual */}
          {result.expected && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <span className="text-xs font-semibold uppercase text-zinc-500">Expected</span>
                <div className="mt-1 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                  <table className="w-full text-xs">
                    <tbody>
                      {result.expected.map((row, i) => (
                        <tr key={i} className="border-b border-zinc-800 last:border-0">
                          {row.map((cell, j) => (
                            <td key={j} className="px-2 py-1 text-zinc-300">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {result.actual && (
                <div>
                  <span className="text-xs font-semibold uppercase text-zinc-500">Your Output</span>
                  <div className="mt-1 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                    <table className="w-full text-xs">
                      <tbody>
                        {result.actual.map((row, i) => (
                          <tr key={i} className="border-b border-zinc-800 last:border-0">
                            {row.map((cell, j) => (
                              <td key={j} className="px-2 py-1 text-zinc-300">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
