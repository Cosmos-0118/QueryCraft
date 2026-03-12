'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { useProgressStore } from '@/stores/progress-store';
import { lessonRegistry } from '@/lib/lessons/content';
import { getExerciseById } from '@/lib/exercises/exercise-bank';
import {
  BookOpen, Terminal, Sigma, PenTool, RefreshCw, ClipboardList,
  ArrowRight, Flame, Zap, PlayCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';

const QUICK_ACTIONS: { title: string; desc: string; icon: ReactNode; href: string }[] = [
  { title: 'Continue Learning', desc: 'Resume where you left off in the lesson track.', icon: <BookOpen size={24} />, href: '/learn' },
  { title: 'SQL Sandbox', desc: 'Write and execute SQL queries in your browser.', icon: <Terminal size={24} />, href: '/sandbox' },
  { title: 'Relational Algebra', desc: 'Parse and evaluate algebra expressions visually.', icon: <Sigma size={24} />, href: '/algebra' },
  { title: 'ER Diagram Builder', desc: 'Design entity-relationship diagrams interactively.', icon: <PenTool size={24} />, href: '/er-builder' },
  { title: 'Normalization Wizard', desc: 'Decompose tables from 1NF through BCNF.', icon: <RefreshCw size={24} />, href: '/normalizer' },
  { title: 'Practice Exercises', desc: 'Test your knowledge with auto-graded problems.', icon: <ClipboardList size={24} />, href: '/practice' },
];

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function ResumeCard() {
  const store = useProgressStore();
  const mounted = useMounted();

  if (!mounted) return null;

  // Find the most recently accessed lesson that isn't fully complete
  const inProgressLessons = Object.entries(store.lessons)
    .filter(([, lp]) => lp.completedSteps.length < lp.totalSteps)
    .sort((a, b) => new Date(b[1].lastAccessedAt).getTime() - new Date(a[1].lastAccessedAt).getTime());

  const lastLesson = inProgressLessons[0];

  // Find last attempted exercise that was incorrect
  const lastExercise = Object.values(store.exercises)
    .filter((ep) => !ep.isCorrect)
    .sort((a, b) => new Date(b.lastAttemptAt).getTime() - new Date(a.lastAttemptAt).getTime())[0];

  if (!lastLesson && !lastExercise) return null;

  const lessonMeta = lastLesson
    ? lessonRegistry.find(
        (l) => l.topicSlug === lastLesson[1].topicSlug && l.slug === lastLesson[1].lessonSlug,
      )
    : null;

  const lessonPct = lastLesson
    ? Math.round((lastLesson[1].completedSteps.length / lastLesson[1].totalSteps) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-blue-500/10 via-zinc-900 to-violet-500/10 p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-200">
        <PlayCircle size={20} className="text-blue-400" />
        Continue Where You Left Off
      </h2>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {lastLesson && lessonMeta && (
          <Link
            href={`/learn/${lastLesson[1].topicSlug}/${lastLesson[1].lessonSlug}`}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-blue-500/30 hover:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-400 uppercase tracking-wider">Lesson</p>
                <p className="mt-1 text-sm font-semibold text-zinc-200">{lessonMeta.title}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${lessonPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500">{lessonPct}%</span>
                </div>
              </div>
              <ArrowRight size={16} className="text-zinc-600" />
            </div>
          </Link>
        )}
        {lastExercise && (
          <Link
            href={`/practice/${lastExercise.exerciseId}`}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-violet-500/30 hover:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-violet-400 uppercase tracking-wider">Retry Exercise</p>
                <p className="mt-1 text-sm font-semibold text-zinc-200">
                  {getExerciseById(lastExercise.exerciseId)?.title ?? lastExercise.exerciseId}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {lastExercise.attempts} attempt{lastExercise.attempts !== 1 ? 's' : ''}
                </p>
              </div>
              <ArrowRight size={16} className="text-zinc-600" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

function StatsRow() {
  const store = useProgressStore();
  const mounted = useMounted();

  if (!mounted) return null;

  const streak = store.getStreak();
  const completedLessons = Object.values(store.lessons).filter(
    (lp) => lp.completedSteps.length >= lp.totalSteps,
  ).length;
  const solvedExercises = Object.values(store.exercises).filter((ep) => ep.isCorrect).length;

  if (streak === 0 && completedLessons === 0 && solvedExercises === 0 && store.totalXp === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
        <Flame size={16} className="mx-auto text-orange-400" />
        <p className="mt-1 text-lg font-bold text-zinc-100">{streak}</p>
        <p className="text-[10px] text-zinc-500 uppercase">Day Streak</p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
        <BookOpen size={16} className="mx-auto text-blue-400" />
        <p className="mt-1 text-lg font-bold text-zinc-100">{completedLessons}</p>
        <p className="text-[10px] text-zinc-500 uppercase">Lessons Done</p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
        <ClipboardList size={16} className="mx-auto text-emerald-400" />
        <p className="mt-1 text-lg font-bold text-zinc-100">{solvedExercises}</p>
        <p className="text-[10px] text-zinc-500 uppercase">Exercises Solved</p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
        <Zap size={16} className="mx-auto text-amber-400" />
        <p className="mt-1 text-lg font-bold text-zinc-100">{store.totalXp}</p>
        <p className="text-[10px] text-zinc-500 uppercase">Total XP</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome to QueryCraft. Your learning progress and quick actions appear here.
        </p>
      </div>

      <StatsRow />
      <ResumeCard />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
          >
            <div className="text-2xl text-primary">{card.icon}</div>
            <h3 className="mt-3 font-semibold group-hover:text-primary">{card.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
