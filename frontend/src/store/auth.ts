import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, Company } from '@/types';

interface AuthState {
  user: User | null;
  company: Company | null;
  /** In-memory only — never persisted (cookies hold the real session) */
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  setAccessToken: (accessToken: string | null) => void;
  login: (user: User, company: Company, accessToken?: string | null) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  switchCompany: (company: Company) => void;
}

function migrateLegacyAuth() {
  if (typeof window === 'undefined') return;
  try {
    const legacy = localStorage.getItem('qootk-auth');
    if (legacy) {
      localStorage.setItem('bhd-auth', legacy);
      localStorage.removeItem('qootk-auth');
    }
    // Strip any previously persisted tokens from storage
    const raw = localStorage.getItem('bhd-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state) {
        delete parsed.state.accessToken;
        delete parsed.state.refreshToken;
        localStorage.setItem('bhd-auth', JSON.stringify(parsed));
      }
    }
  } catch {
    // ignore storage errors
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      company: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setCompany: (company) => set({ company }),
      setAccessToken: (accessToken) => set({ accessToken }),

      login: (user, company, accessToken = null) =>
        set({
          user,
          company,
          accessToken,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          user: null,
          company: null,
          accessToken: null,
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
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        migrateLegacyAuth();
        return (state, error) => {
          if (error) {
            state?.setLoading(false);
            return;
          }
          if (state?.company?.currency === 'SAR' && state.company.country === 'OM') {
            state.setCompany({ ...state.company, currency: 'OMR' });
          }
          state?.setLoading(false);
        };
      },
    }
  )
);

if (typeof window !== 'undefined') {
  setTimeout(() => {
    useAuthStore.getState().setLoading(false);
  }, 2000);
}
