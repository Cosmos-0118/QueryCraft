'use client';

import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  const logout = () => {
    store.logout();
    router.push('/login');
  };

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    accounts: store.accounts,
    login: store.login,
    addAccount: store.addAccount,
    updateName: store.updateName,
    changePassword: store.changePassword,
    removeAccount: store.removeAccount,
    logout,
  };
}
