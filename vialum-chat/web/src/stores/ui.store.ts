import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  activeSection: string;
  toggleSidebar: () => void;
  setActiveSection: (section: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  activeSection: 'inbox',

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActiveSection: (section) => set({ activeSection: section }),
}));
