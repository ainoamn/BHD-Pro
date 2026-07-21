"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, GlassCard } from "@/components/ui/page-shell";

export interface HubItem {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  soon?: boolean;
}

interface ModuleHubProps {
  title: string;
  subtitle: string;
  items: HubItem[];
}

export function ModuleHub({ title, subtitle, items }: ModuleHubProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <GlassCard
              className={cn(
                "p-5 h-full transition-all duration-200",
                item.soon
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:border-emerald-500/40 hover:bg-emerald-500/5 cursor-pointer group"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                    {item.soon && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                        قريباً
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.description}</p>
                </div>
              </div>
            </GlassCard>
          );

          if (item.soon) {
            return <div key={item.title}>{content}</div>;
          }

          return (
            <Link key={item.href} href={item.href} className="block h-full">
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
