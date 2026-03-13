'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useThemeStore, type ColorTheme } from '@/stores/theme-store';
import { Moon } from 'lucide-react';

const COLOR_THEMES: { value: ColorTheme; label: string; swatch: string; desc: string }[] = [
  { value: 'purple', label: 'Purple', swatch: '#6d28d9', desc: 'Royal purple and violet' },
  { value: 'ocean', label: 'Ocean', swatch: '#0369a1', desc: 'Deep blue and sky tones' },
  { value: 'emerald', label: 'Emerald', swatch: '#059669', desc: 'Green and emerald hues' },
];

export default function SettingsPage() {
  const { user, updateName, changePassword } = useAuth();
  const { colorTheme, setColorTheme } = useThemeStore();

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

      {/* Appearance */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">This app now uses dark mode only.</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
          <Moon size={15} />
          Dark mode enabled
        </div>
      </section>

      {/* Color Theme */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Color Theme</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pick an accent color palette.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {COLOR_THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => setColorTheme(t.value)}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                colorTheme === t.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <span
                className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: t.swatch }}
              />
              <div>
                <p className="text-sm font-semibold">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
