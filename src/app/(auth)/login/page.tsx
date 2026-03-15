'use client';

import { Suspense, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Download, Upload, Copy, Check, AlertTriangle } from 'lucide-react';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');
  const { accounts, login, removeAccount, exportAccount, importAccount } = useAuthStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importMsg, setImportMsg] = useState('');

  // Export state
  const [exportedCode, setExportedCode] = useState<string | null>(null);
  const [exportCopied, setExportCopied] = useState(false);

  const selected = accounts.find((a) => a.id === selectedId);

  const redirectTo =
    nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')
      ? nextPath
      : '/dashboard';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setError('');
    setLoading(true);
    try {
      await login(selectedId, password);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await removeAccount(id, deletePassword);
      setConfirmDeleteId(null);
      setDeletePassword('');
      if (selectedId === id) {
        setSelectedId(null);
        setPassword('');
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unable to remove account');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExport = (id: string) => {
    try {
      const code = exportAccount(id);
      setExportedCode(code);
      setExportCopied(false);
    } catch {
      /* ignore */
    }
  };

  const handleCopyExport = () => {
    if (!exportedCode) return;
    navigator.clipboard.writeText(exportedCode);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
  };

  const handleImport = () => {
    setImportMsg('');
    try {
      const name = importAccount(importCode);
      setImportMsg(`Imported "${name}" successfully!`);
      setImportCode('');
      setTimeout(() => { setShowImport(false); setImportMsg(''); }, 1500);
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Import failed');
    }
  };

  // Export code overlay
  if (exportedCode !== null) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <button
          onClick={() => setExportedCode(null)}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back
        </button>
        <h2 className="text-lg font-bold">Account Transfer Code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Copy this code and paste it in the other browser to transfer your account.
        </p>
        <div className="relative mt-4">
          <textarea
            readOnly
            value={exportedCode}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground"
          />
          <button
            onClick={handleCopyExport}
            className="absolute right-2 top-2 rounded-md bg-background p-1.5 text-muted-foreground hover:text-foreground"
            title="Copy code"
          >
            {exportCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
        {exportCopied && (
          <p className="mt-2 text-sm text-green-500">Copied to clipboard!</p>
        )}
      </div>
    );
  }

  // Import screen
  if (showImport) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <button
          onClick={() => { setShowImport(false); setImportCode(''); setImportMsg(''); }}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to accounts
        </button>
        <h2 className="text-lg font-bold">Import Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste the transfer code from another browser to add the account here.
        </p>
        <div className="mt-4 space-y-3">
          <textarea
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            rows={3}
            placeholder="Paste transfer code here..."
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:ring-1 focus:ring-ring"
            autoFocus
          />
          {importMsg && (
            <p className={`text-sm ${importMsg.includes('successfully') ? 'text-green-500' : 'text-red-500'}`}>
              {importMsg}
            </p>
          )}
          <button
            onClick={handleImport}
            disabled={!importCode.trim()}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </div>
    );
  }

  // Password entry screen
  if (selected) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <button
          onClick={() => { setSelectedId(null); setPassword(''); setError(''); }}
          className="mb-4 text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to accounts
        </button>

        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {selected.displayName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-xl font-bold">{selected.displayName}</h1>
        </div>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</div>
          )}
          <div>
            <label htmlFor="password" className="block text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
              placeholder="Enter your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }

  // Account picker screen
  return (
    <div className="rounded-xl border border-border bg-card p-8">
      <h1 className="text-2xl font-bold">Welcome to QueryCraft</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {accounts.length > 0 ? 'Choose your account to continue.' : 'No accounts on this device yet.'}
      </p>

      {accounts.length > 0 && (
        <div className="mt-6 space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`group rounded-2xl border p-1.5 transition-all ${
                confirmDeleteId === account.id
                  ? 'border-red-500/30 bg-red-500/5 shadow-[0_0_0_1px_rgba(239,68,68,0.08)]'
                  : 'border-border/80 bg-card shadow-sm hover:border-primary/20 hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedId(account.id);
                    setError('');
                    setConfirmDeleteId(null);
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                  className="flex flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/70"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                    {account.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{account.displayName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Created {new Date(account.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1 pr-1">
                  <button
                    onClick={() => handleExport(account.id)}
                    className="rounded-lg border border-transparent p-2 text-muted-foreground transition-all hover:border-primary/15 hover:bg-primary/10 hover:text-primary"
                    title="Export account"
                  >
                    <Download size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDeleteId(account.id);
                      setDeletePassword('');
                      setDeleteError('');
                    }}
                    className="rounded-lg border border-transparent p-2 text-muted-foreground transition-all hover:border-red-500/15 hover:bg-red-500/10 hover:text-red-400"
                    title="Remove account"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {confirmDeleteId === account.id && (
                <div className="mx-1 mb-1 mt-2 rounded-xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(239,68,68,0.12),rgba(239,68,68,0.04))] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/12 text-red-400">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        Remove {account.displayName}?
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Enter your password to permanently remove this local account from this device.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <label className="block text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        if (deleteError) setDeleteError('');
                      }}
                      className="h-11 w-full rounded-xl border border-red-500/15 bg-background/90 px-3.5 text-sm outline-none transition focus:border-red-400/60 focus:ring-2 focus:ring-red-500/20"
                      placeholder="Enter your account password"
                      autoFocus
                    />
                    {deleteError && (
                      <p className="text-sm text-red-400">{deleteError}</p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setConfirmDeleteId(null);
                        setDeletePassword('');
                        setDeleteError('');
                      }}
                      className="rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      disabled={deleteLoading || !deletePassword}
                      className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deleteLoading ? 'Removing...' : 'Remove Account'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Link
          href="/register"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
        >
          <Plus size={16} />
          Add Account
        </Link>
        <button
          onClick={() => setShowImport(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
        >
          <Upload size={16} />
          Import Account
        </button>
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
