import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearTokens, getAccessToken, getRefreshToken } from '@/lib/auth/tokens';
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

// Helper to clear all app stores when switching account or logging out
function clearAppStores() {
  // Dynamic imports to avoid circular dependencies — stores reset themselves
  import('@/stores/conversations.store').then((m) => {
    const store = m.useConversationsStore.getState();
    store.setConversations([]);
    store.resetFilters();
  }).catch(() => {});
  import('@/stores/messages.store').then((m) => {
    m.useMessagesStore.setState({ byConversation: {} });
  }).catch(() => {});
  import('@/stores/suggestions.store').then((m) => {
    m.useSuggestionsStore.setState({ byConversation: {}, pendingTotal: 0 });
  }).catch(() => {});
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

      setAccount: (account) => {
        clearAppStores();
        set({ currentAccount: account });
      },

      setTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }),

      logout: () => {
        // Call logout API to invalidate refresh token
        const token = getAccessToken();
        const refreshToken = getRefreshToken();
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/chat';
        if (refreshToken) {
          fetch(`${API_BASE}/api/v1/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ refreshToken }),
          }).catch(() => {}); // Fire and forget
        }

        clearTokens();
        clearAppStores();
        set({
          user: null,
          currentAccount: null,
          accounts: [],
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
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
