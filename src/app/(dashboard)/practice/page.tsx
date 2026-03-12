'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { exercises } from '@/lib/exercises/exercise-bank';
import type { Difficulty, ExerciseType } from '@/types/exercise';
import {
  ClipboardList, Code2, Sigma, RefreshCw, PenTool, Filter,
  ChevronRight, Star, Zap, Trophy,
} from 'lucide-react';
import type { ReactNode } from 'react';

const TYPE_META: Record<ExerciseType, { label: string; icon: ReactNode; color: string }> = {
  sql: { label: 'SQL', icon: <Code2 size={14} />, color: 'text-emerald-400 bg-emerald-500/10' },
  algebra: { label: 'Algebra', icon: <Sigma size={14} />, color: 'text-violet-400 bg-violet-500/10' },
  normalization: { label: 'Normalization', icon: <RefreshCw size={14} />, color: 'text-amber-400 bg-amber-500/10' },
  'er-diagram': { label: 'ER Diagram', icon: <PenTool size={14} />, color: 'text-rose-400 bg-rose-500/10' },
};

const DIFF_META: Record<Difficulty, { label: string; icon: ReactNode; color: string }> = {
  easy: { label: 'Easy', icon: <Star size={12} />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  medium: { label: 'Medium', icon: <Zap size={12} />, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  hard: { label: 'Hard', icon: <Trophy size={12} />, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
};

export default function PracticePage() {
  const [typeFilter, setTypeFilter] = useState<ExerciseType | 'all'>('all');
  const [diffFilter, setDiffFilter] = useState<Difficulty | 'all'>('all');

  const filtered = useMemo(
    () =>
      exercises.filter(
        (e) =>
          (typeFilter === 'all' || e.type === typeFilter) &&
          (diffFilter === 'all' || e.difficulty === diffFilter),
      ),
    [typeFilter, diffFilter],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-violet-500/10 via-emerald-500/5 to-transparent p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
            <ClipboardList size={24} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Practice Exercises</h1>
            <p className="text-sm text-zinc-400">
              {exercises.length} exercises &middot; Auto-graded &middot; 3 hints per exercise
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <Filter size={14} className="text-zinc-500" />

        {/* Type filters */}
        <div className="flex gap-1">
          <button
            onClick={() => setTypeFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              typeFilter === 'all' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            All Types
          </button>
          {(Object.keys(TYPE_META) as ExerciseType[]).map((type) => {
            const meta = TYPE_META[type];
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === type ? meta.color : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-zinc-700" />

        {/* Difficulty filters */}
        <div className="flex gap-1">
          <button
            onClick={() => setDiffFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              diffFilter === 'all' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            All Levels
          </button>
          {(Object.keys(DIFF_META) as Difficulty[]).map((diff) => {
            const meta = DIFF_META[diff];
            return (
              <button
                key={diff}
                onClick={() => setDiffFilter(diff)}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  diffFilter === diff ? meta.color : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>

        <span className="ml-auto text-xs text-zinc-600">{filtered.length} exercises</span>
      </div>

      {/* Exercise List */}
      <div className="space-y-2">
        {filtered.map((exercise) => {
          const typeMeta = TYPE_META[exercise.type];
          const diffMeta = DIFF_META[exercise.difficulty];
          return (
            <Link
              key={exercise.id}
              href={`/practice/${exercise.id}`}
              className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
            >
              <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${typeMeta.color}`}>
                {typeMeta.icon} {typeMeta.label}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-zinc-200 group-hover:text-white">
                  {exercise.title}
                </h3>
                <p className="mt-0.5 truncate text-sm text-zinc-500">{exercise.description}</p>
              </div>
              <div className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${diffMeta.color}`}>
                {diffMeta.icon} {diffMeta.label}
              </div>
              <ChevronRight size={16} className="text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-500">
            No exercises match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
