'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, UserCircle2 } from 'lucide-react';
import { useTestAuth } from '@/features/test-module/hooks/use-test-auth';

interface ProfileResponse {
  profile?: {
    id: string;
    email: string;
    role: 'admin' | 'teacher' | 'student';
    display_name: string;
    faculty_id: string | null;
    registration_number: string | null;
    section: string | null;
  };
  error?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, hydrated, isAuthenticated, setSession, token } = useTestAuth();

  const [displayName, setDisplayName] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [section, setSection] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'admin') {
      router.replace('/admin');
    }
  }, [hydrated, isAuthenticated, router, user]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user || user.role === 'admin') return;

    let cancelled = false;
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/test-auth/profile', { cache: 'no-store' });
        const data = (await res.json()) as ProfileResponse;
        if (!res.ok || !data.profile) {
          throw new Error(data.error || 'Unable to load profile.');
        }
        if (cancelled) return;

        setDisplayName(data.profile.display_name ?? '');
        setFacultyId(data.profile.faculty_id ?? '');
        setRegistrationNumber(data.profile.registration_number ?? '');
        setSection(data.profile.section ?? '');
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load profile.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isAuthenticated, user]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || user.role === 'admin') return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/test-auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
          faculty_id: facultyId.trim(),
          registration_number: registrationNumber.trim(),
          section: section.trim(),
        }),
      });
      const data = (await res.json()) as ProfileResponse;
      if (!res.ok || !data.profile) {
        throw new Error(data.error || 'Unable to save profile.');
      }

      setSession({
        token,
        user: {
          id: data.profile.id,
          email: data.profile.email,
          role: data.profile.role,
          displayName: data.profile.display_name,
          facultyId: data.profile.faculty_id,
          registrationNumber: data.profile.registration_number,
          section: data.profile.section,
        },
      });
      setNotice('Profile updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!hydrated || !isAuthenticated || !user || user.role === 'admin') {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 text-sm text-muted-foreground">
          <Loader2 size={14} className="mr-2 inline animate-spin" />
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
          <UserCircle2 size={12} />
          {user.role === 'teacher' ? 'Faculty Profile' : 'Student Profile'}
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Keep your QueryCraft account details up to date.
        </p>
      </div>

      <form onSubmit={handleSave} className="rounded-2xl border border-border/80 bg-card/85 p-5 shadow-xl shadow-black/10 sm:p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Loading profile...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <ReadonlyField label="Email" value={user.email} />
              <ReadonlyField label="Role" value={user.role === 'teacher' ? 'Faculty' : 'Student'} />
            </div>

            <TextField label="Display Name" value={displayName} onChange={setDisplayName} required />

            {user.role === 'teacher' ? (
              <TextField label="Faculty ID" value={facultyId} onChange={setFacultyId} required />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Registration Number" value={registrationNumber} onChange={setRegistrationNumber} required />
                <TextField label="Section" value={section} onChange={setSection} required />
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-ring"
        required={required}
      />
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 flex h-11 items-center rounded-xl border border-border/70 bg-background/60 px-3 text-sm text-foreground">
        {value}
      </p>
    </div>
  );
}
