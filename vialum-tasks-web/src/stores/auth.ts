'use client';
import { create } from 'zustand';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  isAuthenticated: false,

  login: (token) => {
    localStorage.setItem('vialum_token', token);
    set({ token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('vialum_token');
    set({ token: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('vialum_token');
    set({ token, isAuthenticated: !!token });
  },
}));
