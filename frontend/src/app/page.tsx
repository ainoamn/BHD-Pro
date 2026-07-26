import { LandingPage } from "@/components/landing/landing-page";

export type PublicPlanDto = {
  id: string;
  nameAr: string;
  nameEn: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscountPct: number;
  currency: string;
  invoicesLimit?: number;
  usersLimit?: number;
};

async function fetchPublicPlans(): Promise<PublicPlanDto[]> {
  const base =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_PUBLIC_URL ||
    "https://hisaby-api.onrender.com";
  const url = `${base.replace(/\/$/, "")}/api/public/plans`;
  try {
    const res = await fetch(url, {
      // Revalidate often so admin price edits appear on the homepage quickly
      next: { revalidate: 15 },
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
