"use client";

import { Toaster } from "react-hot-toast";
import { useTheme } from "next-themes";

export function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";

  return (
    <Toaster
      position="top-left"
      toastOptions={{
        duration: 4000,
        style: {
          background: isLight ? "#ffffff" : "#1e293b",
          color: isLight ? "#0f172a" : "#f8fafc",
          border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(148,163,184,0.1)",
          borderRadius: "12px",
          fontFamily: "var(--font-cairo)",
          boxShadow: isLight ? "0 4px 12px rgb(15 23 42 / 0.08)" : undefined,
        },
      }}
    />
  );
}
