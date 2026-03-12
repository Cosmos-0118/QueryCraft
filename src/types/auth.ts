export interface User {
  id: string;
  displayName: string;
  createdAt: string;
}

/** Stored locally — password is a simple hash, not meant for high-security. */
export interface LocalAccount {
  id: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}