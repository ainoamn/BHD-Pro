"use client";

import { LucideIcon } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-indigo-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
      <p className="text-slate-400 max-w-md">{description}</p>
      <div className="mt-6 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-500">
        قيد التطوير — سيتم إضافة هذه الوحدة قريباً
      </div>
    </div>
  );
}
