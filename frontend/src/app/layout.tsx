import type { Metadata } from "next";
import { Cairo, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "react-hot-toast";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BHD Pro - نظام المحاسبة الذكي العماني",
  description: "نظام محاسبة سحابي عماني متكامل مع ذكاء اصطناعي، فوترة إلكترونية OTA، وتحليلات مالية متقدمة",
  keywords: ["محاسبة", "فواتير", "عُمان", "OTA", "ضريبة القيمة المضافة", "ERP", "BHD Pro"],
  authors: [{ name: "BHD Team" }],
  openGraph: {
    title: "BHD Pro",
    description: "نظام المحاسبة الذكي العماني",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster
            position="top-left"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#1e293b",
                color: "#f8fafc",
                border: "1px solid rgba(148,163,184,0.1)",
                borderRadius: "12px",
                fontFamily: "var(--font-cairo)",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
