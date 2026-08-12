import Link from "next/link";
import type { ReactNode } from "react";

export function TrustDocument({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-10">
        <Link href="/" className="text-sm font-semibold text-emerald-600 hover:underline">حسابي · Hisaby</Link>
        <h1 className="mt-5 text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">آخر تحديث · Last updated: {updated}</p>
        <div className="prose prose-slate mt-8 max-w-none space-y-6 dark:prose-invert">{children}</div>
      </article>
    </main>
  );
}
