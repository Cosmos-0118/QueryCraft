'use client';

import Link from 'next/link';
import { units } from '@/lib/lessons/content';
import {
  BookOpen, Database, Sigma, Terminal, RefreshCw, Shield,
  ChevronRight, Clock, GraduationCap,
} from 'lucide-react';
import type { ReactNode } from 'react';

const ICON_MAP: Record<string, ReactNode> = {
  Database: <Database size={20} />,
  Sigma: <Sigma size={20} />,
  Terminal: <Terminal size={20} />,
  RefreshCw: <RefreshCw size={20} />,
  Shield: <Shield size={20} />,
};

const COLOR_MAP: Record<string, { gradient: string; badge: string; border: string }> = {
  blue: {
    gradient: 'from-blue-500/20 to-blue-600/5',
    badge: 'bg-blue-500/10 text-blue-400',
    border: 'border-blue-500/20 hover:border-blue-500/40',
  },
  violet: {
    gradient: 'from-violet-500/20 to-violet-600/5',
    badge: 'bg-violet-500/10 text-violet-400',
    border: 'border-violet-500/20 hover:border-violet-500/40',
  },
  emerald: {
    gradient: 'from-emerald-500/20 to-emerald-600/5',
    badge: 'bg-emerald-500/10 text-emerald-400',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
  amber: {
    gradient: 'from-amber-500/20 to-amber-600/5',
    badge: 'bg-amber-500/10 text-amber-400',
    border: 'border-amber-500/20 hover:border-amber-500/40',
  },
  rose: {
    gradient: 'from-rose-500/20 to-rose-600/5',
    badge: 'bg-rose-500/10 text-rose-400',
    border: 'border-rose-500/20 hover:border-rose-500/40',
  },
};

export default function LearnPage() {
  const totalLessons = units.reduce(
    (sum, u) => sum + u.topics.reduce((s, t) => s + t.lessons.length, 0),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-blue-500/10 via-violet-500/5 to-transparent p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
            <GraduationCap size={24} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Guided Learning</h1>
            <p className="text-sm text-zinc-400">
              {units.length} units &middot; {totalLessons} lessons &middot; Step-by-step visual explanations
            </p>
          </div>
        </div>
      </div>

      {/* Units */}
      <div className="space-y-6">
        {units.map((unit) => {
          const colors = COLOR_MAP[unit.color] ?? COLOR_MAP.blue;
          const lessonCount = unit.topics.reduce((s, t) => s + t.lessons.length, 0);
          const totalMinutes = unit.topics.reduce(
            (s, t) => s + t.lessons.reduce((m, l) => m + l.estimatedMinutes, 0),
            0,
          );

          return (
            <div key={unit.number} className="space-y-3">
              {/* Unit Header */}
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${colors.badge}`}
                >
                  {unit.number}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">{unit.title}</h2>
                  <p className="text-xs text-zinc-500">
                    {lessonCount} lessons &middot; ~{totalMinutes} min
                  </p>
                </div>
              </div>

              {/* Topic Cards */}
              {unit.topics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/learn/${topic.slug}`}
                  className={`group block rounded-xl border bg-zinc-900/50 p-5 transition-all ${colors.border}`}
                >
                  <div className={`rounded-lg bg-gradient-to-br ${colors.gradient} p-4`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${colors.badge}`}>
                          {ICON_MAP[topic.icon] ?? <BookOpen size={20} />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-100 group-hover:text-white">
                            {topic.title}
                          </h3>
                          <p className="mt-1 text-sm text-zinc-400">{topic.description}</p>
                        </div>
                      </div>
                      <ChevronRight
                        size={18}
                        className="mt-1 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400"
                      />
                    </div>

                    {/* Lesson Pills */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {topic.lessons.map((lesson) => (
                        <span
                          key={lesson.slug}
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-700/50 bg-zinc-800/50 px-3 py-1 text-xs text-zinc-400"
                        >
                          <BookOpen size={10} />
                          {lesson.title}
                          <span className="mx-0.5 text-zinc-600">&middot;</span>
                          <Clock size={10} />
                          {lesson.estimatedMinutes}m
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
