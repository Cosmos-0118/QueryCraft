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
    if (user.role === 'admin') {
      router.replace('/admin');
    } else {
      router.replace('/tests');
    }
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
    if (data.user.role === 'admin') {
      router.replace('/admin');
    } else {
      router.replace('/tests');
    }
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
    <div className="relative mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center px-5 py-10 sm:px-6 lg:px-8 lg:py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.08),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_45%)]" />

      <div className="w-full max-w-md rounded-2xl border border-border/90 bg-card/85 p-7 shadow-xl shadow-black/10">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Dashboard
          </Link>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-200">
            <ShieldCheck size={12} />
            Test Module
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight">Sign in to the test module</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Access is limited to accounts your administrator has provisioned.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {stage === 'email' && (
          <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Email
              </label>
              <div className="relative mt-1.5">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              Continue
            </button>
          </form>
        )}

        {stage === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
            <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 font-medium text-foreground">
                <UserCircle2 size={15} />
                {email}
              </span>
              {resolvedRole && (
                <span className="ml-2 rounded-full border border-border/70 bg-card/70 px-2 py-0.5 text-xs uppercase tracking-[0.12em]">
                  {resolvedRole}
                </span>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Password
              </label>
              <div className="relative mt-1.5">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-password"
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                Sign in
              </button>
            </div>
          </form>
        )}

        {stage === 'create_password' && (
          <form onSubmit={handleCreatePasswordSubmit} className="mt-6 space-y-4">
            <div className="rounded-xl border border-amber-400/35 bg-amber-400/10 p-3 text-sm text-amber-200">
              First-time setup for <span className="font-semibold">{email}</span>. Create a password to activate this account.
            </div>

            <div>
              <label htmlFor="create-password" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                New password
              </label>
              <div className="relative mt-1.5">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="create-password"
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Confirm password
              </label>
              <div className="relative mt-1.5">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                Create password & sign in
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Don&apos;t have access? Ask your administrator to add your email under the test module admin tools.
        </p>
      </div>
    </div>
  );
}
