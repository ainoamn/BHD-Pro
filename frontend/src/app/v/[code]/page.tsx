"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/** Prefer direct API host so phone scans do not depend on flaky custom domain. */
const API_PUBLIC_ORIGIN = (
  process.env.NEXT_PUBLIC_API_PUBLIC_URL ||
  "https://hisaby-api.onrender.com"
).replace(/\/$/, "");

/**
 * Legacy short URL: /v/CODE
 * Redirects to the Render-hosted HTML invoice that auto-opens print/save.
 */
export default function VerifyDocumentPage({ params }: { params: { code: string } }) {
  useEffect(() => {
    const code = encodeURIComponent(params.code);
    window.location.replace(
      `${API_PUBLIC_ORIGIN}/api/public/documents/c/${code}/view`
    );
  }, [params.code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
    </div>
  );
}
