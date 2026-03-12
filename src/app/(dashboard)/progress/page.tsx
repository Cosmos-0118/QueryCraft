'use client';

import { useProgress } from '@/hooks/use-progress';
import {
  TrendingUp, BookOpen, ClipboardCheck, Flame, Zap,
  Database, Sigma, Terminal, RefreshCw, Shield,
  Trophy, Target, CheckCircle2,
} from 'lucide-react';
import type { ReactNode } from 'react';

const UNIT_ICONS: Record<number, ReactNode> = {
  1: <Database size={18} />,
  2: <Sigma size={18} />,
  3: <Terminal size={18} />,
  4: <RefreshCw size={18} />,
  5: <Shield size={18} />,
};

const UNIT_COLORS: Record<number, { bar: string; bg: string; text: string; ring: string }> = {
  1: { bar: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'text-blue-500' },
  2: { bar: 'bg-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-400', ring: 'text-violet-500' },
  3: { bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'text-emerald-500' },
  4: { bar: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'text-amber-500' },
  5: { bar: 'bg-rose-500', bg: 'bg-rose-500/10', text: 'text-rose-400', ring: 'text-rose-500' },
};

const TYPE_COLORS: Record<string, string> = {
  sql: 'text-emerald-400',
  algebra: 'text-violet-400',
  normalization: 'text-amber-400',
  'er-diagram': 'text-rose-400',
};

function RingProgress({ percent, color, size = 80 }: { percent: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-zinc-800" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className={`${color} transition-all duration-700`} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="fill-zinc-200 text-sm font-bold rotate-[90deg]" style={{ transformOrigin: 'center' }}>
        {percent}%
      </text>
    </svg>
  );
}

function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-zinc-800 p-2 text-zinc-400">{icon}</div>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-zinc-100">{value}</p>
          {sub && <p className="text-xs text-zinc-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const {
    unitProgress,
    totalLessons,
    completedLessons,
    totalExercises,
    solvedExercises,
    exerciseStats,
    recentActivity,
    streak,
    totalXp,
  } = useProgress();

  const overallPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Badges
  const badges: { icon: ReactNode; title: string; desc: string; earned: boolean }[] = [
    { icon: <BookOpen size={20} />, title: 'First Lesson', desc: 'Complete your first lesson', earned: completedLessons >= 1 },
    { icon: <Terminal size={20} />, title: 'SQL Starter', desc: 'Solve 5 SQL exercises', earned: (exerciseStats.byType['sql']?.correct ?? 0) >= 5 },
    { icon: <Flame size={20} />, title: '3-Day Streak', desc: 'Learn 3 days in a row', earned: streak >= 3 },
    { icon: <Trophy size={20} />, title: 'Half Way', desc: 'Complete 50% of lessons', earned: overallPercent >= 50 },
    { icon: <CheckCircle2 size={20} />, title: 'Perfect Score', desc: 'Solve 10 exercises correctly', earned: (exerciseStats.correct ?? 0) >= 10 },
    { icon: <Target size={20} />, title: 'Completionist', desc: 'Finish all lessons', earned: overallPercent >= 100 },
    { icon: <Zap size={20} />, title: 'XP Master', desc: 'Earn 500 XP', earned: totalXp >= 500 },
    { icon: <Sigma size={20} />, title: 'Algebra Ace', desc: 'Solve 5 algebra exercises', earned: (exerciseStats.byType['algebra']?.correct ?? 0) >= 5 },
  ];

  // Activity heatmap (last 30 days)
  const maxActivity = Math.max(1, ...recentActivity.map((a) => a.lessonsCompleted + a.exercisesSolved));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-cyan-500/15 via-zinc-900 to-teal-500/10 p-8">
        <div className="flex items-center gap-3">
          <TrendingUp size={28} className="text-cyan-400" />
          <h1 className="text-3xl font-bold text-zinc-100">Your Progress</h1>
        </div>
        <p className="mt-2 text-zinc-400">
          Track your learning journey across all units, exercises, and achievements.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<BookOpen size={18} />} label="Lessons" value={`${completedLessons}/${totalLessons}`} sub={`${overallPercent}% complete`} />
        <StatCard icon={<ClipboardCheck size={18} />} label="Exercises" value={`${solvedExercises}/${totalExercises}`} sub={`${exerciseStats.total} attempted`} />
        <StatCard icon={<Flame size={18} />} label="Streak" value={`${streak} day${streak !== 1 ? 's' : ''}`} sub="Current streak" />
        <StatCard icon={<Zap size={18} />} label="Total XP" value={totalXp} sub="Experience points" />
      </div>

      {/* Unit progress */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-200">Unit Progress</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {unitProgress.map(({ unit, totalLessons: uTotal, completedLessons: uDone, percent }) => {
            const colors = UNIT_COLORS[unit.number] ?? UNIT_COLORS[1];
            return (
              <div key={unit.number} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${colors.bg} ${colors.text}`}>
                      {UNIT_ICONS[unit.number]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">Unit {unit.number}</p>
                      <p className="text-xs text-zinc-500">{unit.title}</p>
                    </div>
                  </div>
                  <RingProgress percent={percent} color={colors.ring} size={56} />
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-zinc-500 mb-1">
                    <span>{uDone} of {uTotal} lessons</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full ${colors.bar} transition-all duration-700`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exercise breakdown */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-200">Exercise Breakdown</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(['sql', 'algebra', 'normalization', 'er-diagram'] as const).map((type) => {
            const stats = exerciseStats.byType[type] ?? { total: 0, correct: 0 };
            const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
            return (
              <div key={type} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <p className={`text-sm font-medium capitalize ${TYPE_COLORS[type]}`}>{type.replace('-', ' ')}</p>
                <p className="mt-1 text-2xl font-bold text-zinc-100">{stats.correct}/{stats.total}</p>
                <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full rounded-full bg-zinc-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">{pct}% accuracy</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity heatmap (last 30 days) */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-200">Activity (Last 30 Days)</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-end gap-1 h-24">
            {recentActivity.map((day) => {
              const total = day.lessonsCompleted + day.exercisesSolved;
              const intensity = total / maxActivity;
              const heightPct = Math.max(4, intensity * 100);
              const dayLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'narrow' });
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute -top-8 hidden group-hover:block bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    {day.date}: {day.lessonsCompleted}L, {day.exercisesSolved}E
                  </div>
                  <div
                    className={`w-full rounded-sm transition-all duration-300 ${total > 0 ? 'bg-cyan-500' : 'bg-zinc-800'}`}
                    style={{ height: `${heightPct}%`, opacity: total > 0 ? 0.3 + intensity * 0.7 : 1 }}
                  />
                  <span className="text-[9px] text-zinc-600">{dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Badges / Achievements */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-200">Achievements</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((badge) => (
            <div
              key={badge.title}
              className={`rounded-xl border p-4 transition-all ${
                badge.earned
                  ? 'border-cyan-500/30 bg-cyan-500/5'
                  : 'border-zinc-800 bg-zinc-900/40 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${badge.earned ? 'bg-cyan-500/15 text-cyan-400' : 'bg-zinc-800 text-zinc-600'}`}>
                  {badge.icon}
                </div>
                <div>
                  <p className={`text-sm font-medium ${badge.earned ? 'text-zinc-200' : 'text-zinc-500'}`}>{badge.title}</p>
                  <p className="text-xs text-zinc-500">{badge.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
