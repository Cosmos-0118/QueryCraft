"use client";

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ArrowLeft, Loader2, Medal, Sparkles, Trophy, Users } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  attempt_id: string;
  student_id: string;
  student_name: string;
  points: number;
  submitted_at: string | null;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  total_participants: number;
  current_entry: LeaderboardEntry | null;
  module_type: 'classic' | 'interactive_quiz';
}

export default function InteractiveQuizLeaderboardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const testId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const attemptId = searchParams.get('attemptId') ?? undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<LeaderboardEntry | null>(null);
  const [moduleType, setModuleType] = useState<'classic' | 'interactive_quiz'>('interactive_quiz');

  useEffect(() => {
    if (!testId) {
      setLoading(false);
      setError('Missing test ID.');
      return;
    }

    let cancelled = false;

    const loadLeaderboard = async () => {
      try {
        const query = new URLSearchParams();
        if (attemptId) {
          query.set('attemptId', attemptId);
        }

        const response = await fetch(`/api/tests/${testId}/leaderboard?${query.toString()}`);
        const data = await response.json() as LeaderboardResponse & { error?: string };

        if (!response.ok) {
          if (!cancelled) {
            setError(data.error || 'Unable to load leaderboard.');
          }
          return;
        }

        if (!cancelled) {
          setEntries(Array.isArray(data.leaderboard) ? data.leaderboard : []);
          setCurrentEntry(data.current_entry ?? null);
          setModuleType(data.module_type ?? 'interactive_quiz');
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load leaderboard.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadLeaderboard();
    const intervalId = window.setInterval(() => {
      void loadLeaderboard();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [attemptId, testId]);

  const topThree = useMemo(() => entries.slice(0, 3), [entries]);

  const backPath = user?.role === 'teacher' ? '/interactive-quiz' : '/tests';

  if (loading) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Loading leaderboard...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          <p className="font-semibold">Unable to load leaderboard</p>
          <p className="mt-1 text-sm text-red-300/90">{error}</p>
          <Link
            href={backPath}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={15} />
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_45%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_45%)]" />

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={backPath}
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Back
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/20 bg-orange-400/[0.07] px-3 py-1 text-xs font-semibold text-orange-200">
            <Sparkles size={11} />
            Interactive Quiz Leaderboard
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Final Standings</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Live ranks refresh every 5 seconds as submissions are completed.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Users size={13} className="text-amber-200" />
          {entries.length} participants
        </div>
      </div>

      {currentEntry && (
        <div className="mb-4 rounded-2xl border border-amber-400/35 bg-amber-400/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-200">Your Position</p>
          <p className="mt-1 text-lg font-bold tracking-tight text-foreground">
            Rank #{currentEntry.rank} with {currentEntry.points} points
          </p>
        </div>
      )}

      {topThree.length > 0 && (
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {topThree.map((entry) => (
            <div
              key={`top_${entry.attempt_id}`}
              className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm"
            >
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-amber-200">
                <Medal size={12} />
                Rank {entry.rank}
              </p>
              <p className="mt-2 text-base font-semibold tracking-tight">{entry.student_name}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Trophy size={14} className="text-amber-200" />
                {entry.points} pts
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/85 shadow-xl shadow-black/10">
        <div className="grid grid-cols-[80px_minmax(160px,1fr)_120px_180px] gap-3 border-b border-border/70 bg-background/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span>Rank</span>
          <span>Student</span>
          <span>Points</span>
          <span>Submitted</span>
        </div>

        {entries.map((entry) => {
          const isCurrent = !!attemptId && entry.attempt_id === attemptId;
          return (
            <div
              key={entry.attempt_id}
              className={`grid grid-cols-[80px_minmax(160px,1fr)_120px_180px] gap-3 border-t border-border/60 px-4 py-3 text-sm first:border-t-0 ${
                isCurrent ? 'bg-amber-400/8' : 'hover:bg-muted/20'
              }`}
            >
              <span className="font-semibold">#{entry.rank}</span>
              <span className="truncate">{entry.student_name}</span>
              <span className="font-semibold text-foreground">{entry.points}</span>
              <span className="text-xs text-muted-foreground">
                {entry.submitted_at ? new Date(entry.submitted_at).toLocaleString() : 'Pending'}
              </span>
            </div>
          );
        })}

        {entries.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No submissions yet. Leaderboard will appear as students finish.
          </div>
        )}
      </div>

      {moduleType !== 'interactive_quiz' && (
        <p className="mt-3 text-xs text-muted-foreground">
          This test is not marked as an interactive quiz, but leaderboard data is still shown.
        </p>
      )}
    </div>
  );
}
