'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useThemeStore } from '@/stores/theme-store';
import { THEME_OPTIONS } from '@/lib/theme';

export default function SettingsPage() {
  const { user, updateName, changePassword } = useAuth();
  const { theme, setTheme } = useThemeStore();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    const name = displayName.trim();
    if (!name) { setProfileMsg('Name cannot be empty'); return; }
    updateName(name);
    setProfileMsg('Profile updated!');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    if (newPassword.length < 4) { setPasswordMsg('New password must be at least 4 characters'); return; }
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMsg('Password changed!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordMsg(err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your profile, change password, and app preferences.
        </p>
      </div>

      {/* Profile */}
      <section className="qc-card rounded-xl p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <form onSubmit={handleUpdateProfile} className="mt-4 space-y-4">
          <div>
            <label htmlFor="settingsName" className="block text-sm font-medium">Display Name</label>
            <input
              id="settingsName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="qc-field mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
              pattern="^[a-zA-Z0-9 ]+$"
              maxLength={100}
            />
          </div>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.includes('updated') ? 'text-success' : 'text-danger'}`}>
              {profileMsg}
            </p>
          )}
          <button
            type="submit"
            className="qc-primary-action rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Save Profile
          </button>
        </form>
      </section>

      {/* Password */}
      <section className="qc-card rounded-xl p-6">
        <h2 className="text-lg font-semibold">Change Password</h2>
        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div>
            <label htmlFor="curPwd" className="block text-sm font-medium">Current Password</label>
            <input
              id="curPwd"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="qc-field mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="newPwd" className="block text-sm font-medium">New Password</label>
            <input
              id="newPwd"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="qc-field mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
              minLength={8}
              required
            />
          </div>
          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.includes('changed') ? 'text-success' : 'text-danger'}`}>
              {passwordMsg}
            </p>
          )}
          <button
            type="submit"
            className="qc-primary-action rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Change Password
          </button>
        </form>
      </section>

      {/* Theme */}
      <section className="qc-card rounded-xl p-6">
        <h2 className="text-lg font-semibold">Theme</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose a palette that matches the workspace mood.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                theme === option.value
                  ? 'border-primary/45 bg-primary/12 text-foreground shadow-[0_18px_46px_-34px_var(--shadow-color)]'
                  : 'border-border bg-surface-soft/70 text-muted-foreground hover:border-primary/28 hover:bg-surface-hover/70 hover:text-foreground'
              }`}
            >
              <span className="qc-theme-swatch h-12 w-12 shrink-0 rounded-xl" data-theme={option.value} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{option.description}</span>
              </span>
              <span
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  theme === option.value ? 'bg-primary' : 'bg-border group-hover:bg-primary/50'
                }`}
              />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
