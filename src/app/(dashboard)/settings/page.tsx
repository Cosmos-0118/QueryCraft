'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useThemeStore, type ThemeMode } from '@/stores/theme-store';
import { Moon, Palette, Sun } from 'lucide-react';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={15} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={15} /> },
  { value: 'signature', label: 'Signature', icon: <Palette size={15} /> },
  { value: 'crimson', label: 'Crimson', icon: <Palette size={15} /> },
  { value: 'aurora', label: 'Aurora', icon: <Palette size={15} /> },
  { value: 'electric-night', label: 'Electric Night', icon: <Palette size={15} /> },
];

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
    <div className="mx-auto max-w-2xl space-y-8 p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your profile, change password, and app preferences.
        </p>
      </div>

      {/* Profile */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <form onSubmit={handleUpdateProfile} className="mt-4 space-y-4">
          <div>
            <label htmlFor="settingsName" className="block text-sm font-medium">Display Name</label>
            <input
              id="settingsName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-ring"
              pattern="^[a-zA-Z0-9 ]+$"
              maxLength={100}
            />
          </div>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.includes('updated') ? 'text-green-500' : 'text-red-500'}`}>
              {profileMsg}
            </p>
          )}
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Save Profile
          </button>
        </form>
      </section>

      {/* Password */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Change Password</h2>
        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div>
            <label htmlFor="curPwd" className="block text-sm font-medium">Current Password</label>
            <input
              id="curPwd"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-ring"
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
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-ring"
              minLength={8}
              required
            />
          </div>
          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.includes('changed') ? 'text-green-500' : 'text-red-500'}`}>
              {passwordMsg}
            </p>
          )}
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Change Password
          </button>
        </form>
      </section>

      {/* Theme */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Theme</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose a theme from the list.</p>
        <div className="mt-4 space-y-2">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                theme === option.value
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-border/90 hover:text-foreground'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
