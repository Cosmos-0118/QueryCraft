"use client";

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTestAuth as useAuth } from '@/hooks/use-test-auth';
import { ArrowLeft, Clock3, Loader2, RefreshCw, Trophy, Users } from 'lucide-react';

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

function LeaderboardMetricCard({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: 'default' | 'success' | 'warning' | 'primary';
}) {
  const toneClass = {
    default: 'border-border/70 bg-background/50 text-foreground',
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    primary: 'border-primary/30 bg-primary/10 text-primary',
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
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
  const [testTitle, setTestTitle] = useState<string | null>(null);

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

        const leaderboardRes = await fetch(`/api/tests/${testId}/leaderboard?${query.toString()}`);
        const data = await leaderboardRes.json() as LeaderboardResponse & { error?: string };

        if (!leaderboardRes.ok) {
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

  useEffect(() => {
    if (!testId) return;

    let cancelled = false;

    const loadTitle = async () => {
      try {
        const testRes = await fetch(`/api/tests/${testId}`);
        if (!testRes.ok || cancelled) return;
        const testPayload = await testRes.json() as { test?: { title?: string } };
        if (!cancelled) {
          setTestTitle(testPayload.test?.title ?? null);
        }
      } catch {
        /* ignore */
      }
    };

    void loadTitle();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const stats = useMemo(() => {
    const n = entries.length;
    const sum = entries.reduce((s, e) => s + e.points, 0);
    const avgPoints = n ? Math.round(sum / n) : 0;
    const topPoints = n > 0 ? entries[0].points : null;
    return { n, avgPoints, topPoints };
  }, [entries]);

  const backPath = user?.role === 'teacher' ? '/interactive-quiz' : '/tests';

  if (loading) {
    return (
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_45%),radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_45%)]" />
        <div className="rounded-3xl border border-border/70 bg-card/85 p-6 shadow-xl shadow-black/10 sm:p-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Loading leaderboard...
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/35" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_45%),radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_45%)]" />
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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_45%),radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_45%)]" />

      <div className="mb-6 rounded-3xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-black/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href={backPath}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              <ArrowLeft size={13} />
              {user?.role === 'teacher' ? 'Back to Interactive Quizzes' : 'Back to Tests'}
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              {testTitle ?? 'Leaderboard'}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Final standings by total points. Rankings refresh automatically every few seconds while this page is open.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <RefreshCw size={13} className="text-primary" />
            Live refresh · 5s
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LeaderboardMetricCard
            label="Participants"
            value={stats.n}
            helper="On the leaderboard"
            tone="primary"
          />
          <LeaderboardMetricCard
            label="Top score"
            value={stats.topPoints ?? '—'}
            helper={stats.n ? 'Highest points' : 'No attempts yet'}
            tone="success"
          />
          <LeaderboardMetricCard
            label="Average points"
            value={stats.n ? stats.avgPoints : '—'}
            helper={stats.n ? 'Across all entries' : 'Waiting for data'}
            tone="warning"
          />
          <LeaderboardMetricCard
            label="Your rank"
            value={currentEntry ? `#${currentEntry.rank}` : '—'}
            helper={
              currentEntry
                ? `${currentEntry.points} points · ${user?.role === 'teacher' ? 'Highlighted attempt' : 'Your attempt'}`
                : user?.role === 'teacher'
                  ? 'Students see placement after submitting'
                  : 'Finish your attempt to appear here'
            }
            tone="default"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-border/75 bg-card/85 p-5 shadow-xl shadow-black/10 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Standings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Everyone who submitted, sorted from highest score to lowest.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Users size={12} />
            {stats.n} {stats.n === 1 ? 'participant' : 'participants'}
          </div>
        </div>

        <div className="grid gap-3">
          {entries.length === 0 && (
            <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
              No submissions yet. The leaderboard will fill in as students finish.
            </div>
          )}

          {entries.map((entry) => {
            const isCurrent = !!attemptId && entry.attempt_id === attemptId;
            const rankTone =
              entry.rank === 1
                ? 'border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-200'
                : entry.rank <= 3
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border/70 bg-background/60 text-muted-foreground';

            return (
              <div
                key={entry.attempt_id}
                className={`rounded-2xl border p-4 transition sm:p-5 ${
                  isCurrent
                    ? 'border-primary/40 bg-primary/[0.06] hover:border-primary/50'
                    : 'border-border/70 bg-background/50 hover:border-primary/25 hover:bg-background/70'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-sm font-bold text-primary">
                      {entry.student_name.trim().slice(0, 1).toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">{entry.student_name}</p>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${rankTone}`}
                        >
                          <Trophy size={11} />
                          Rank #{entry.rank}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex rounded-full border border-primary/35 bg-primary/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                            You
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.submitted_at
                          ? `Submitted ${new Date(entry.submitted_at).toLocaleString()}`
                          : 'Submission time pending'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/70 bg-card/65 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rank</p>
                      <p className="mt-1 text-sm font-bold text-foreground">#{entry.rank}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card/65 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Points</p>
                      <p className="mt-1 text-sm font-bold text-foreground">{entry.points}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card/65 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Submitted</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-foreground">
                        <Clock3 size={12} className="text-muted-foreground" />
                        {entry.submitted_at
                          ? new Date(entry.submitted_at).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {moduleType !== 'interactive_quiz' && (
        <p className="mt-4 text-xs text-muted-foreground">
          This test is not marked as an interactive quiz; leaderboard data is shown when available.
        </p>
      )}
    </div>
  );
}
