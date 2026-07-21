"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { NextIntlClientProvider } from "next-intl";
import arMessages from "@/i18n/messages/ar.json";
import enMessages from "@/i18n/messages/en.json";
import { useLocaleStore, type Locale } from "@/store/locale";

const messagesMap: Record<Locale, typeof arMessages> = {
  ar: arMessages,
  en: enMessages,
};

export function Providers({ children }: { children: React.ReactNode }) {
  const locale = useLocaleStore((s) => s.locale);
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const safeLocale = locale === "en" ? "en" : "ar";
    document.documentElement.lang = safeLocale;
    document.documentElement.dir = safeLocale === "ar" ? "rtl" : "ltr";
  }, [locale, mounted]);

  const safeLocale: Locale = locale === "en" ? "en" : "ar";

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <NextIntlClientProvider
      locale={safeLocale}
      messages={messagesMap[safeLocale]}
      timeZone="Asia/Muscat"
    >
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
