"use client";

import { useEffect, useRef, useState } from "react";
import { Nfc, Loader2 } from "lucide-react";
import { useLocaleStore } from "@/store/locale";

type Props = {
  active: boolean;
  onRead: (secret: string) => void;
  disabled?: boolean;
};

const copy = {
  ar: {
    tap: "قرّب شارة NFC من الجهاز",
    unsupported:
      "Web NFC متاح على Android Chrome عبر HTTPS فقط — الصق رمز الشارة للاختبار",
    paste: "رمز الشارة (للاختبار)",
    pasteHint: "الصق أو اكتب رمز الشارة ثم Enter",
    reading: "بانتظار الشارة…",
    error: "تعذر قراءة NFC",
  },
  en: {
    tap: "Hold an NFC badge near this device",
    unsupported:
      "Web NFC works on Android Chrome over HTTPS — paste a badge code for desktop testing",
    paste: "Badge code (testing)",
    pasteHint: "Paste or type the badge secret, then Enter",
    reading: "Waiting for badge…",
    error: "Could not read NFC",
  },
};

function isWebNfcSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

export function NfcBadgeReader({ active, onRead, disabled }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const t = copy[locale === "en" ? "en" : "ar"];
  const supported = isWebNfcSupported();
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  useEffect(() => {
    if (!active || !supported || disabled) {
      setScanning(false);
      return;
    }
    let cancelled = false;
    let reader: { scan: () => Promise<void>; addEventListener: Function; removeEventListener?: Function } | null =
      null;

    (async () => {
      try {
        setErr(null);
        setScanning(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const NDEFReaderCtor = (window as any).NDEFReader;
        reader = new NDEFReaderCtor();
        await reader!.scan();
        const onReading = (event: {
          message?: { records?: { recordType?: string; data?: DataView; encoding?: string }[] };
        }) => {
          if (cancelled) return;
          const records = event.message?.records || [];
          for (const record of records) {
            if (record.recordType === "text" && record.data) {
              const decoder = new TextDecoder(record.encoding || "utf-8");
              // NDEF text records often start with a language code length byte
              const bytes = new Uint8Array(record.data.buffer, record.data.byteOffset, record.data.byteLength);
              const langLen = bytes[0] ?? 0;
              const text =
                langLen < bytes.length
                  ? decoder.decode(bytes.slice(1 + langLen))
                  : decoder.decode(bytes);
              const secret = text.trim();
              if (secret) {
                onReadRef.current(secret);
                return;
              }
            }
            if (record.data && record.recordType !== "empty") {
              const hex = Array.from(
                new Uint8Array(record.data.buffer, record.data.byteOffset, record.data.byteLength),
              )
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
              if (hex.length >= 4) {
                onReadRef.current(hex);
                return;
              }
            }
          }
        };
        reader!.addEventListener("reading", onReading);
      } catch {
        if (!cancelled) {
          setErr(t.error);
          setScanning(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setScanning(false);
    };
  }, [active, supported, disabled, t.error]);

  const submitManual = () => {
    const secret = manual.trim();
    if (!secret || disabled) return;
    onRead(secret);
    setManual("");
  };

  return (
    <div className="space-y-3">
      {supported ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-200">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Nfc className="w-4 h-4 shrink-0" />}
          <span>{scanning ? t.reading : t.tap}</span>
        </div>
      ) : (
        <p className="text-xs text-slate-400">{t.unsupported}</p>
      )}
      {err ? <p className="text-xs text-rose-300">{err}</p> : null}
      <div>
        <label className="block text-xs text-slate-400 mb-1">{t.paste}</label>
        <input
          type="password"
          value={manual}
          disabled={disabled}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitManual();
            }
          }}
          placeholder={t.pasteHint}
          className="w-full h-10 px-3 rounded-lg bg-black/30 border border-white/10 text-sm text-white"
          autoComplete="off"
        />
      </div>
    </div>
  );
}
