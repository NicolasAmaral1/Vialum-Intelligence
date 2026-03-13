import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginResult, TokenPair } from '@/types/api';

interface AuthState {
  user: User | null;
  currentAccount: { accountId: string; accountName: string; role: string } | null;
  accounts: Array<{ accountId: string; accountName: string; role: string }>;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  setLoginResult: (result: LoginResult) => void;
  setAccount: (account: { accountId: string; accountName: string; role: string }) => void;
  setTokens: (tokens: TokenPair) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      user: null,
      currentAccount: null,
      accounts: [],
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setLoginResult: (result) =>
        set({
          user: result.user,
          accounts: result.accounts,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          isAuthenticated: true,
          currentAccount: result.accounts.length === 1 ? result.accounts[0] : null,
        }),

      setAccount: (account) =>
        set({ currentAccount: account }),

      setTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }),

      logout: () =>
        set({
          user: null,
          currentAccount: null,
          accounts: [],
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'vialum-auth',
      partialize: (state) => ({
        user: state.user,
        currentAccount: state.currentAccount,
        accounts: state.accounts,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
