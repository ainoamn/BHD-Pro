import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'ar' | 'en';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'ar',
      setLocale: (locale) => {
        document.documentElement.lang = locale;
        document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
        set({ locale });
      },
    }),
    {
      name: 'bhd-locale',
      onRehydrateStorage: () => (state) => {
        if (state?.locale) {
          document.documentElement.lang = state.locale;
          document.documentElement.dir = state.locale === 'ar' ? 'rtl' : 'ltr';
        }
      },
    }
  )
);
