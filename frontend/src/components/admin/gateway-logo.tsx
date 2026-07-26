import { cn } from "@/lib/utils";

const BRAND: Record<string, { bg: string; label: string; mark: string }> = {
  THAWANI: { bg: "bg-violet-600", label: "Thawani", mark: "ث" },
  STRIPE: { bg: "bg-indigo-600", label: "Stripe", mark: "stripe" },
  PAYPAL: { bg: "bg-blue-700", label: "PayPal", mark: "PayPal" },
  BANK_TRANSFER: { bg: "bg-emerald-700", label: "Bank", mark: "🏦" },
  MANUAL: { bg: "bg-slate-600", label: "Manual", mark: "M" },
};

type Props = {
  slug: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function GatewayLogo({ slug, className, size = "md" }: Props) {
  const brand = BRAND[slug] ?? {
    bg: "bg-teal-700",
    label: slug,
    mark: slug.charAt(0),
  };

  const dim =
    size === "lg"
      ? "h-20 w-20 text-2xl"
      : size === "sm"
        ? "h-10 w-10 text-sm"
        : "h-14 w-14 text-lg";

  return (
    <div
      className={cn(
        "rounded-2xl flex items-center justify-center text-white font-bold shadow-md",
        brand.bg,
        dim,
        className,
      )}
      title={brand.label}
    >
      {slug === "STRIPE" ? (
        <span className="italic text-sm tracking-tight">stripe</span>
      ) : slug === "PAYPAL" ? (
        <span className="italic text-base">PayPal</span>
      ) : (
        brand.mark
      )}
    </div>
  );
}
