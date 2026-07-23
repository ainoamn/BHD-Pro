"use client";

import { useCallback } from "react";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import api from "@/lib/api";

type Props = {
  onSuccess: () => void;
  onRequires2fa?: (tempToken: string) => void;
  companyName?: string;
};

export function GoogleSignInButton({ onSuccess, onRequires2fa, companyName }: Props) {
  const t = useTranslations("auth");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleSuccess = useCallback(
    async (credentialResponse: CredentialResponse) => {
      if (!credentialResponse.credential) {
        toast.error(t("googleError"));
        return;
      }
      try {
        toast.loading(t("googleLoading"), { id: "google-signin" });
        const data = await api.googleLogin(credentialResponse.credential, companyName);
        toast.dismiss("google-signin");
        if (data?.requires2fa && data.tempToken) {
          if (onRequires2fa) {
            onRequires2fa(data.tempToken);
            toast.success(t("totpPrompt"));
            return;
          }
          toast.error(t("googleNeeds2fa"));
          return;
        }
        onSuccess();
      } catch (err: unknown) {
        toast.dismiss("google-signin");
        const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
        const msg = axiosErr?.response?.data?.message;
        toast.error(Array.isArray(msg) ? msg.join(" — ") : msg || t("googleError"));
      }
    },
    [companyName, onRequires2fa, onSuccess, t],
  );

  if (!clientId) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="relative w-full flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-700" />
        <span className="text-xs text-slate-500">{t("orContinueWith")}</span>
        <div className="flex-1 h-px bg-slate-700" />
      </div>
      <div className="flex justify-center w-full">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => toast.error(t("googleError"))}
          useOneTap={false}
          theme="outline"
          size="large"
          text="continue_with"
          shape="rectangular"
          width="320"
        />
      </div>
    </div>
  );
}
