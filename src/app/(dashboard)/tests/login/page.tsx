"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react';
import { useTestAuth } from '@/hooks/use-test-auth';

type Stage = 'email' | 'password' | 'create_password';

interface LookupResponse {
  exists: boolean;
  password_set: boolean;
  is_active: boolean;
  role: 'admin' | 'teacher' | 'student' | null;
  error?: string;
}

interface AuthSuccessResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: 'admin' | 'teacher' | 'student';
    display_name: string;
    password_set: boolean;
  };
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPostLoginPath(role: 'admin' | 'teacher' | 'student') {
  if (role === 'admin') {
    return '/admin';
  }

  if (role === 'teacher') {
    return '/tests?chooser=1';
  }

  return '/tests';
}

export default function TestModuleLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession, isAuthenticated, hydrated, user } = useTestAuth();

  const nextPath = searchParams.get('next');
  const safeNext = useMemo(
    () => (nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : null),
    [nextPath],
  );

  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolvedRole, setResolvedRole] = useState<'admin' | 'teacher' | 'student' | null>(null);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;
    if (safeNext) {
      router.replace(safeNext);
      return;
    }
    router.replace(getPostLoginPath(user.role));
  }, [hydrated, isAuthenticated, router, safeNext, user]);

  const resetPasswordFields = () => {
    setPassword('');
    setConfirmPassword('');
  };

  const handleBackToEmail = () => {
    setStage('email');
    setError(null);
    resetPasswordFields();
    setResolvedRole(null);
  };

  const finalizeSession = (data: AuthSuccessResponse) => {
    setSession({
      token: data.token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        displayName: data.user.display_name,
      },
    });

    if (safeNext) {
      router.replace(safeNext);
      return;
    }
    router.replace(getPostLoginPath(data.user.role));
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    setError(null);

    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/test-auth/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json()) as LookupResponse;

      if (!res.ok) {
        setError(data.error || 'Unable to look up this account.');
        return;
      }

      if (!data.exists) {
        setError('This email is not authorized to access the test module. Ask your administrator to add it.');
        return;
      }

      if (!data.is_active) {
        setError('This account has been disabled. Contact your administrator.');
        return;
      }

      setResolvedRole(data.role);
      setStage(data.password_set ? 'password' : 'create_password');
    } catch {
      setError('Network error while checking the email.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    setError(null);

    if (!password) {
      setError('Enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/test-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, password }),
      });
      const data = (await res.json()) as AuthSuccessResponse;

      if (!res.ok) {
        if (res.status === 409) {
          // Account exists but no password set yet — fall through to creation.
          setStage('create_password');
          setPassword('');
          setError('Set a password to finish activating your account.');
          return;
        }
        setError(data.error || 'Email or password is incorrect.');
        return;
      }

      finalizeSession(data);
    } catch {
      setError('Network error while signing in.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/test-auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          password,
          confirm_password: confirmPassword,
        }),
      });
      const data = (await res.json()) as AuthSuccessResponse;

      if (!res.ok) {
        setError(data.error || 'Unable to set password.');
        return;
      }

      finalizeSession(data);
    } catch {
      setError('Network error while setting password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.09),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.09),transparent_45%),radial-gradient(ellipse_at_bottom,rgba(34,197,94,0.06),transparent_55%)]" />

      <div className="w-full max-w-xl rounded-3xl border border-border/80 bg-card/90 p-6 shadow-2xl shadow-black/20 sm:p-8 lg:p-9">
        <div className="mb-7 flex items-start justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Dashboard
          </Link>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-500/10 px-3.5 py-1.5 text-xs font-semibold text-teal-200">
            <ShieldCheck size={12} />
            Test Module
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight sm:text-[2rem]">Sign in to the test module</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Access is limited to accounts your administrator has provisioned.
        </p>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {stage === 'email' && (
          <form onSubmit={handleEmailSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-email" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Email
              </label>
              <div className="relative mt-2">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              Continue
            </button>
          </form>
        )}

        {stage === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="mt-8 space-y-5">
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
                  <UserCircle2 size={15} className="shrink-0" />
                  <span className="truncate">{email}</span>
                </span>
                {resolvedRole && (
                  <span className="inline-flex h-7 items-center rounded-full border border-border/70 bg-card/70 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none">
                    {resolvedRole}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Password
              </label>
              <div className="relative mt-2">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-password"
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-4 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                Sign in
              </button>
            </div>
          </form>
        )}

        {stage === 'create_password' && (
          <form onSubmit={handleCreatePasswordSubmit} className="mt-8 space-y-5">
            <div className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-4 text-sm text-amber-200">
              First-time setup for <span className="font-semibold">{email}</span>. Create a password to activate this account.
            </div>

            <div>
              <label htmlFor="create-password" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                New password
              </label>
              <div className="relative mt-2">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="create-password"
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Confirm password
              </label>
              <div className="relative mt-2">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-4 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                Create password & sign in
              </button>
            </div>
          </form>
        )}

        <p className="mt-8 border-t border-border/60 pt-5 text-xs leading-relaxed text-muted-foreground">
          Don&apos;t have access? Ask your administrator to add your email under the test module admin tools.
        </p>
      </div>
    </div>
  );
}
