"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCircle2,
  Users,
} from 'lucide-react';
import { useAuthorizedFetch, useTestAuth } from '@/hooks/use-test-auth';

type AccountRole = 'teacher' | 'student';

interface AdminAccount {
  id: string;
  email: string;
  role: AccountRole;
  display_name: string;
  password_set: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ email: string; reason: string }>;
}

interface ImportResponse {
  summary?: ImportSummary;
  rejected?: Array<{ rawEmail: string; rawRole: string; reason: string }>;
  default_role?: AccountRole;
  error?: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, hydrated, isAuthenticated, logout } = useTestAuth();
  const authorizedFetch = useAuthorizedFetch();

  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AccountRole>('all');

  // Add user form
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AccountRole>('student');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<AdminAccount | null>(null);
  const [editRole, setEditRole] = useState<AccountRole>('student');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AdminAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Import
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importDefaultRole, setImportDefaultRole] = useState<AccountRole>('student');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/tests/login');
      return;
    }
    if (user?.role !== 'admin') {
      router.replace('/tests');
    }
  }, [hydrated, isAuthenticated, router, user?.role]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authorizedFetch('/api/test-auth/admin/users');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to load accounts.');
        return;
      }
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    } catch {
      setError('Network error while loading accounts.');
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch]);

  useEffect(() => {
    if (hydrated && isAuthenticated && user?.role === 'admin') {
      void loadAccounts();
    }
  }, [hydrated, isAuthenticated, loadAccounts, user?.role]);

  const filteredAccounts = useMemo(() => {
    const trimmedSearch = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (roleFilter !== 'all' && account.role !== roleFilter) return false;
      if (!trimmedSearch) return true;
      return (
        account.email.toLowerCase().includes(trimmedSearch) ||
        (account.display_name ?? '').toLowerCase().includes(trimmedSearch)
      );
    });
  }, [accounts, roleFilter, search]);

  const stats = useMemo(() => {
    const total = accounts.length;
    const teachers = accounts.filter((a) => a.role === 'teacher').length;
    const students = accounts.filter((a) => a.role === 'student').length;
    const pending = accounts.filter((a) => !a.password_set).length;
    return { total, teachers, students, pending };
  }, [accounts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateMessage(null);

    const email = newEmail.trim();
    if (!email || !email.includes('@')) {
      setCreateError('Enter a valid email.');
      return;
    }

    setCreating(true);
    try {
      const res = await authorizedFetch('/api/test-auth/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Unable to add account.');
        return;
      }

      setCreateMessage(
        data.created
          ? `Added ${email} as ${newRole}.`
          : `${email} already exists; left unchanged.`,
      );
      setNewEmail('');
      void loadAccounts();
    } catch {
      setCreateError('Network error while adding account.');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (account: AdminAccount) => {
    setEditTarget(account);
    setEditRole(account.role);
    setEditDisplayName(account.display_name ?? '');
    setEditIsActive(account.is_active);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    setEditLoading(true);
    setEditError(null);
    try {
      const res = await authorizedFetch(`/api/test-auth/admin/users/${encodeURIComponent(editTarget.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editRole,
          display_name: editDisplayName.trim(),
          is_active: editIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Unable to update account.');
        return;
      }
      setEditTarget(null);
      void loadAccounts();
    } catch {
      setEditError('Network error while updating account.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await authorizedFetch(`/api/test-auth/admin/users/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Unable to delete account.');
        return;
      }
      setDeleteTarget(null);
      void loadAccounts();
    } catch {
      setError('Network error while deleting account.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('default_role', importDefaultRole);

      const res = await authorizedFetch('/api/test-auth/admin/users/import', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json()) as ImportResponse;
      setImportResult(data);

      if (res.ok) {
        void loadAccounts();
      }
    } catch {
      setImportResult({ error: 'Network error while importing file.' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            Checking your session...
          </div>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(167,139,250,0.10),transparent_45%),radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.10),transparent_45%)]" />

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            onClick={logout}
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Sign out
          </button>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
            <ShieldCheck size={12} />
            Test Module Admin
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">User Management</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Add the emails that are allowed to access the test module and assign their role.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-xl border border-border/80 bg-card/80 px-3 py-2 text-right shadow-sm">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Signed in as</span>
            <span className="block text-sm font-semibold text-foreground">{user.email}</span>
          </span>
          <button
            onClick={() => void loadAccounts()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={String(stats.total)} icon={<Users size={16} />} />
        <StatCard title="Teachers" value={String(stats.teachers)} icon={<Sparkles size={16} />} />
        <StatCard title="Students" value={String(stats.students)} icon={<UserCircle2 size={16} />} />
        <StatCard
          title="Pending Activation"
          value={String(stats.pending)}
          icon={<AlertTriangle size={16} />}
          description="Users that have not set a password yet"
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-border/85 bg-card/85 p-5 shadow-xl shadow-black/10"
        >
          <h2 className="text-sm font-semibold tracking-tight">Add a single user</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The user will set their own password the first time they sign in.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              className="h-11 rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              required
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AccountRole)}
              className="h-11 rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </div>

          {createError && (
            <p className="mt-3 text-xs text-red-300">{createError}</p>
          )}
          {createMessage && (
            <p className="mt-3 text-xs text-emerald-300">{createMessage}</p>
          )}
        </form>

        <div className="rounded-2xl border border-border/85 bg-card/85 p-5 shadow-xl shadow-black/10">
          <h2 className="text-sm font-semibold tracking-tight">Bulk import from CSV / XLSX</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a file with one email per row. Optional second column overrides the role per row
            (<code>teacher</code> / <code>student</code>). Otherwise the default role below is used.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr]">
            <select
              value={importDefaultRole}
              onChange={(e) => setImportDefaultRole(e.target.value as AccountRole)}
              className="h-11 rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            >
              <option value="student">Default: Student</option>
              <option value="teacher">Default: Teacher</option>
            </select>

            <label
              className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/70 px-4 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground ${
                importing ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? 'Importing...' : 'Choose CSV / XLSX file'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>

          {importResult?.error && (
            <p className="mt-3 text-xs text-red-300">{importResult.error}</p>
          )}
          {importResult?.summary && (
            <div className="mt-3 rounded-xl border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Import summary</p>
              <p className="mt-1">
                {importResult.summary.created} created · {importResult.summary.updated} updated ·{' '}
                {importResult.summary.skipped} unchanged · {importResult.summary.errors.length} errors
              </p>
              {(importResult.summary.errors.length > 0 || (importResult.rejected ?? []).length > 0) && (
                <ul className="mt-2 max-h-32 list-disc overflow-auto pl-5 text-red-300">
                  {importResult.summary.errors.map((err) => (
                    <li key={`err_${err.email}`}>{err.email}: {err.reason}</li>
                  ))}
                  {importResult.rejected?.map((row, idx) => (
                    <li key={`rej_${idx}`}>{row.rawEmail || '(empty)'}: {row.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/85 bg-card/85 p-5 shadow-xl shadow-black/10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">All users</h2>
            <p className="text-xs text-muted-foreground">{filteredAccounts.length} of {accounts.length} shown</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email or name"
                className="h-10 w-56 rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | AccountRole)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All roles</option>
              <option value="teacher">Teachers</option>
              <option value="student">Students</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border/70">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_140px] gap-3 border-b border-border/70 bg-background/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>

          {loading && (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              <Loader2 size={14} className="mr-2 inline animate-spin" />
              Loading accounts...
            </div>
          )}

          {!loading && filteredAccounts.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No users match the current filters.
            </div>
          )}

          {!loading &&
            filteredAccounts.map((account) => (
              <div
                key={account.id}
                className="grid gap-3 border-t border-border/60 px-4 py-3 text-sm first:border-t-0 md:grid-cols-[2fr_1fr_1fr_1fr_140px] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{account.email}</p>
                  {account.display_name && (
                    <p className="truncate text-xs text-muted-foreground">{account.display_name}</p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {account.role}
                </span>
                <div className="flex flex-col gap-1 text-xs">
                  <span
                    className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${
                      account.is_active
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
                    }`}
                  >
                    {account.is_active ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                    {account.is_active ? 'Active' : 'Disabled'}
                  </span>
                  {!account.password_set && (
                    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-300">
                      Pending password
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(account.created_at).toLocaleDateString()}
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => openEdit(account)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(account)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-300 transition hover:border-red-500/60"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Need to update the platform admin? Edit <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code> in
        your environment configuration.
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        Looking for the test workspace?{' '}
        <Link href="/dashboard" className="font-medium text-primary hover:underline">
          Back to dashboard
        </Link>
      </p>

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-2xl border border-border/70 bg-card/95 p-6 shadow-2xl shadow-black/40"
          >
            <h2 className="text-lg font-bold tracking-tight">Edit user</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{editTarget.email}</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Display name
                </label>
                <input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  placeholder="Optional display name"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as AccountRole)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-background"
                />
                Account active (can sign in)
              </label>
            </div>

            {editError && (
              <p className="mt-3 text-xs text-red-300">{editError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-xl border border-border/80 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                disabled={editLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {editLoading && <Loader2 size={14} className="animate-spin" />}
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/95 p-6 shadow-2xl shadow-black/40">
            <h2 className="text-lg font-bold tracking-tight">Delete user</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{deleteTarget.email}</span> will lose access
              to the test module immediately. Their existing test attempts and submissions remain in the
              database.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-border/80 bg-background/70 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:border-red-500/70 hover:bg-red-500/20 disabled:opacity-60"
              >
                {deleteLoading && <Loader2 size={14} className="animate-spin" />}
                Delete user
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/85 bg-card/80 p-4 shadow-sm">
      <div className="mb-3 inline-flex rounded-lg border border-border/85 bg-background/60 p-2 text-muted-foreground">
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
