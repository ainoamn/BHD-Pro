import { LandingPage } from "@/components/landing/landing-page";

export type PublicPlanHighlightGroup = {
  groupId: string;
  labelAr: string;
  labelEn: string;
  items: { code: string; labelAr: string; labelEn: string }[];
};

export type PublicPlanDto = {
  id: string;
  code?: string;
  nameAr: string;
  nameEn: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscountPct: number;
  currency: string;
  invoicesLimit?: number;
  usersLimit?: number;
  support?: string;
  sortOrder?: number;
  highlights?: PublicPlanHighlightGroup[];
};

async function fetchPublicPlans(): Promise<PublicPlanDto[]> {
  const base =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_PUBLIC_URL ||
    "https://hisaby-api.onrender.com";
  const url = `${base.replace(/\/$/, "")}/api/public/plans`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as PublicPlanDto[]) : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const initialPlans = await fetchPublicPlans();
  return <LandingPage initialPlans={initialPlans} />;
}
