"use client";

import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "h-8 max-w-[120px]",
  md: "h-12 max-w-[180px]",
  lg: "h-16 max-w-[220px]",
  xl: "h-20 max-w-[280px]",
} as const;

interface CompanyLogoProps {
  src?: string | null;
  name?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

export function CompanyLogo({ src, name, size = "md", className }: CompanyLogoProps) {
  if (!src?.trim()) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ? `${name} logo` : "Company logo"}
      className={cn("object-contain object-right", SIZE_CLASS[size], className)}
    />
  );
}
