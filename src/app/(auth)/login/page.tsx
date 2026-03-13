'use client';

import { Suspense, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Download, Upload, Copy, Check } from 'lucide-react';

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

  const handleDelete = (id: string) => {
    removeAccount(id);
    setConfirmDeleteId(null);
    if (selectedId === id) {
      setSelectedId(null);
      setPassword('');
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
        <div className="mt-6 space-y-2">
          {accounts.map((account) => (
            <div key={account.id} className="group relative">
              <button
                onClick={() => { setSelectedId(account.id); setError(''); }}
                className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {account.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{account.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(account.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </button>

              {/* Action buttons */}
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-0.5">
                {confirmDeleteId === account.id ? (
                  <>
                    <button
                      onClick={() => handleDelete(account.id)}
                      className="rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/20"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleExport(account.id)}
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                      title="Export account"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(account.id)}
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      title="Remove account"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
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
