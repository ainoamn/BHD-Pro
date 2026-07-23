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
  title: "حسابي Hisaby — محاسبة سحابية لأعمال الخليج والمنطقة",
  description:
    "حسابي (Hisaby) منصة محاسبة سحابية للشركات في الخليج والمنطقة: فواتير، مخزون، ضريبة، وتقارير. مطوّر ومشغّل بواسطة شركة بن حمود للتطوير.",
  keywords: [
    "محاسبة",
    "فواتير",
    "الخليج",
    "حسابي",
    "Hisaby",
    "ضريبة القيمة المضافة",
    "بن حمود للتطوير",
  ],
  authors: [{ name: "Bin Hamood Development" }],
  openGraph: {
    title: "حسابي Hisaby",
    description: "محاسبة سحابية لأعمال الخليج والمنطقة — شركة بن حمود للتطوير",
    type: "website",
    images: [{ url: "/brand/hisaby-mark.png" }],
  },
  icons: {
    icon: "/brand/hisaby-mark.png",
    apple: "/brand/hisaby-mark.png",
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
