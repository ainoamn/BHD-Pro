"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * End-user registration is on BHD Identity only.
 * Hisaby companies/users are created via invite or existing admin — not from this page.
 */
export default function RegisterPage() {
  useEffect(() => {
    window.location.replace("https://id.bhd-om.com/login");
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fbfaf7] text-[#092d24]">
      <Loader2 className="h-8 w-8 animate-spin text-[#075c45]" />
      <p className="text-sm">إنشاء الحساب يتم عبر بوابة BHD…</p>
      <a className="text-sm text-[#075c45] underline" href="https://id.bhd-om.com/login">
        id.bhd-om.com
      </a>
    </div>
  );
}
