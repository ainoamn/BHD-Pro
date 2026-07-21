import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'dark' | 'light';
  commandPaletteOpen: boolean;
  aiChatOpen: boolean;
  notifications: Notification[];

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapse: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setAiChatOpen: (open: boolean) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  read: boolean;
  createdAt: Date;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  theme: 'dark',
  commandPaletteOpen: false,
  aiChatOpen: false,
  notifications: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapse: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setAiChatOpen: (open) => set({ aiChatOpen: open }),
  addNotification: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications] })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
