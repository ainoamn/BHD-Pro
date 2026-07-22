import type { Metadata } from "next";
import { Cairo, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./light-theme.css";
import { Providers } from "@/components/providers";

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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
