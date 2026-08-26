'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Loader2,
  Mail,
  UserCircle2,
} from 'lucide-react';
import { useTestAuth } from '@/features/test-module/hooks/use-test-auth';

type Role = 'admin' | 'teacher' | 'student';
type Stage = 'email' | 'password' | 'otp_setup';

interface LookupResponse {
  exists: boolean;
  password_set: boolean;
  is_active: boolean;
  role: Role | null;
  error?: string;
}

interface OtpResponse {
  ok?: boolean;
  role?: Role;
  email_sent?: boolean;
  expires_in_minutes?: number;
  dev_otp?: string | null;
  error?: string;
}

interface AuthSuccessResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: Role;
    display_name: string;
    faculty_id?: string | null;
    registration_number?: string | null;
    section?: string | null;
    password_set: boolean;
  };
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPostLoginPath(role: Role) {
  return role === 'admin' ? '/admin' : '/dashboard';
}

function LoginPageContent() {
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
  const [otp, setOtp] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [section, setSection] = useState('');
  const [resolvedRole, setResolvedRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;
    router.replace(safeNext ?? getPostLoginPath(user.role));
  }, [hydrated, isAuthenticated, router, safeNext, user]);

  const resetSecrets = () => {
    setPassword('');
    setConfirmPassword('');
    setOtp('');
  };

  const handleBackToEmail = () => {
    setStage('email');
    setResolvedRole(null);
    setError(null);
    setNotice(null);
    resetSecrets();
  };

  const finalizeSession = (data: AuthSuccessResponse) => {
    setSession({
      token: data.token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        displayName: data.user.display_name,
        facultyId: data.user.faculty_id ?? null,
        registrationNumber: data.user.registration_number ?? null,
        section: data.user.section ?? null,
      },
    });

    router.replace(safeNext ?? getPostLoginPath(data.user.role));
  };

  const sendOtp = async (targetEmail: string) => {
    const res = await fetch('/api/test-auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail }),
    });
    const data = (await res.json()) as OtpResponse;

    if (!res.ok) {
      throw new Error(data.error || 'Unable to send OTP.');
    }

    setResolvedRole(data.role ?? 'student');
    const devHint = data.dev_otp ? ` Dev OTP: ${data.dev_otp}` : '';
    const deliveryText = data.email_sent
      ? `Brevo accepted the OTP email for ${targetEmail}.`
      : `OTP generated for ${targetEmail}; email sending is not configured.`;
    setNotice(`${deliveryText} It expires in ${data.expires_in_minutes ?? 10} minutes.${devHint}`);
  };

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    setError(null);
    setNotice(null);
    resetSecrets();

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

      if (data.exists && !data.is_active) {
        setError('This account has been disabled. Contact your administrator.');
        return;
      }

      if (data.exists && data.password_set) {
        setResolvedRole(data.role);
        setStage('password');
        return;
      }

      if (!data.exists) {
        setError('This email is not registered. Ask the admin to add your account.');
        return;
      }

      if (data.exists && data.role === 'admin') {
        setResolvedRole('admin');
        setNotice('Admin email recognized. Create a password to finish setup.');
        setStage('otp_setup');
        return;
      }

      if (data.role === 'teacher') {
        await sendOtp(trimmed);
        setStage('otp_setup');
        return;
      }

      if (data.role === 'student') {
        setResolvedRole('student');
        setNotice('Student email recognized. Create a password to finish setup.');
        setStage('otp_setup');
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error while checking the email.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    setError(null);
    setNotice(null);

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
          if (resolvedRole === 'admin') {
            setNotice('Admin email recognized. Create a password to finish setup.');
          } else if (resolvedRole === 'teacher') {
            await sendOtp(trimmed);
          } else if (resolvedRole === 'student') {
            setNotice('Student email recognized. Create a password to finish setup.');
          } else {
            setError('This account needs password setup. Go back and enter your email again.');
            return;
          }
          setStage('otp_setup');
          setPassword('');
          setError(
            resolvedRole === 'admin'
              ? 'Create a password to finish activating this admin account.'
              : 'Verify the OTP and create a password to finish activating this account.',
          );
          return;
        }
        setError(data.error || 'Email or password is incorrect.');
        return;
      }

      finalizeSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error while signing in.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    setError(null);

    if (resolvedRole === 'teacher' && !/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit OTP from your email.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (resolvedRole === 'teacher' && !facultyId.trim()) {
      setError('Faculty ID is required.');
      return;
    }

    if (resolvedRole === 'student' && (!registrationNumber.trim() || !section.trim())) {
      setError('Registration number and section are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/test-auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          otp: otp.trim(),
          password,
          confirm_password: confirmPassword,
          faculty_id: facultyId.trim(),
          registration_number: registrationNumber.trim(),
          section: section.trim(),
        }),
      });
      const data = (await res.json()) as AuthSuccessResponse;

      if (!res.ok) {
        setError(data.error || 'Unable to finish account setup.');
        return;
      }

      finalizeSession(data);
    } catch {
      setError('Network error while setting up your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-xl rounded-3xl border border-border/80 bg-card/90 p-6 shadow-2xl shadow-black/20 sm:p-8">
      {stage !== 'email' && (
        <div className="mb-7">
          <button
            type="button"
            onClick={handleBackToEmail}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Change email
          </button>
        </div>
      )}

      <h1 className="text-2xl font-bold tracking-tight sm:text-[2rem]">Sign in to QueryCraft</h1>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {notice}
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
                onChange={(event) => setEmail(event.target.value)}
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
          <AccountSummary email={email} role={resolvedRole} />
          <PasswordInput
            id="login-password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            Sign in
          </button>
        </form>
      )}

      {stage === 'otp_setup' && (
        <form onSubmit={handleSetupSubmit} className="mt-8 space-y-5">
          <AccountSummary email={email} role={resolvedRole} />

          {resolvedRole === 'teacher' && (
            <div>
              <label htmlFor="otp" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Email OTP
              </label>
              <input
                id="otp"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold tracking-[0.2em] outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </div>
          )}

          {resolvedRole === 'teacher' && (
            <div>
              <label htmlFor="faculty-id" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Faculty ID
              </label>
              <input
                id="faculty-id"
                value={facultyId}
                onChange={(event) => setFacultyId(event.target.value)}
                placeholder="FAC-001"
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                required
              />
            </div>
          )}

          {resolvedRole === 'student' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="registration-number" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Registration No.
                </label>
                <input
                  id="registration-number"
                  value={registrationNumber}
                  onChange={(event) => setRegistrationNumber(event.target.value)}
                  placeholder="REG123"
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label htmlFor="section" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Section
                </label>
                <input
                  id="section"
                  value={section}
                  onChange={(event) => setSection(event.target.value)}
                  placeholder="A"
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
                  required
                />
              </div>
            </div>
          )}

          <PasswordInput
            id="create-password"
            label="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <PasswordInput
            id="confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            {resolvedRole === 'teacher'
              ? 'Verify OTP & Create Password'
              : resolvedRole === 'admin'
                ? 'Create Admin Password'
                : 'Create Student Password'}
          </button>
        </form>
      )}
    </div>
  );
}

function AccountSummary({ email, role }: { email: string; role: Role | null }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
          <UserCircle2 size={15} className="shrink-0" />
          <span className="truncate">{email}</span>
        </span>
        {role && (
          <span className="inline-flex h-7 items-center rounded-full border border-border/70 bg-card/70 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] leading-none">
            {role === 'teacher' ? 'faculty' : role}
          </span>
        )}
      </div>
    </div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      <div className="relative mt-2">
        <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          type="password"
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="At least 6 characters"
          className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
          autoComplete={autoComplete}
          required
          minLength={6}
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">Loading login...</div>}
    >
      <LoginPageContent />
    </Suspense>
  );
}
