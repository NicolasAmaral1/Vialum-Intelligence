import { apiClient } from './client';
import type { LoginResult, TokenPair, User } from '@/types/api';

export const authApi = {
  login: (email: string, password: string) =>
    apiClient<LoginResult>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refreshToken: string) =>
    apiClient<TokenPair>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    apiClient<void>('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  me: () => apiClient<User>('/api/v1/auth/me'),
};
