import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, Company } from '@/types';

interface AuthState {
  user: User | null;
  company: Company | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, company: Company, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  switchCompany: (company: Company) => void;
}

function migrateLegacyAuth() {
  if (typeof window === 'undefined') return null;
  try {
    const legacy = localStorage.getItem('qootk-auth');
    if (legacy) {
      localStorage.setItem('bhd-auth', legacy);
      localStorage.removeItem('qootk-auth');
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      company: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setCompany: (company) => set({ company }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      login: (user, company, accessToken, refreshToken) =>
        set({
          user,
          company,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          user: null,
          company: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      switchCompany: (company) => set({ company }),
    }),
    {
      name: 'bhd-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        company: state.company,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        migrateLegacyAuth();
        return (state, error) => {
          if (error) {
            state?.setLoading(false);
            return;
          }
          // Fix stale SAR left from older defaults — Oman companies use OMR
          if (state?.company?.currency === 'SAR' && state.company.country === 'OM') {
            state.setCompany({ ...state.company, currency: 'OMR' });
          }
          state?.setLoading(false);
        };
      },
    }
  )
);

// Safety: never leave isLoading stuck forever
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useAuthStore.getState().setLoading(false);
  }, 2000);
}
