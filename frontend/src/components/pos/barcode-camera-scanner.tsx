"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, X } from "lucide-react";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

const FORMATS = ["ean_13", "ean_8", "code_128", "qr_code", "upc_a", "upc_e"] as const;
const DEBOUNCE_MS = 1500;

export function BarcodeCameraScanner({ open, onClose, onDetected }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const emitCode = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const now = Date.now();
      const last = lastCodeRef.current;
      if (last && last.code === code && now - last.at < DEBOUNCE_MS) return;
      lastCodeRef.current = { code, at: now };
      onDetected(code);
    },
    [onDetected],
  );

  const stopTracks = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      zxingControlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    zxingControlsRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((tr) => tr.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopTracks();
      setError(null);
      setHint(null);
      return;
    }

    let cancelled = false;

    const start = async () => {
      setError(null);
      setHint(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t.cameraUnsupported);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);

        if (typeof window.BarcodeDetector === "function") {
          const detector = new window.BarcodeDetector({ formats: [...FORMATS] });
          const loop = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              if (videoRef.current.readyState >= 2) {
                const codes = await detector.detect(videoRef.current);
                const value = codes.find((c) => c.rawValue)?.rawValue;
                if (value) emitCode(value);
              }
            } catch {
              /* keep looping */
            }
            rafRef.current = requestAnimationFrame(() => {
              void loop();
            });
          };
          void loop();
          return;
        }

        // Fallback: @zxing/browser continuous decode
        try {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromStream(
            stream,
            video,
            (result) => {
              if (result) emitCode(result.getText());
            },
          );
          zxingControlsRef.current = controls;
        } catch {
          setHint(t.scanCameraHint);
        }
      } catch {
        if (!cancelled) setError(t.cameraPermissionDenied);
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopTracks();
    };
  }, [open, emitCode, stopTracks, t.cameraPermissionDenied, t.cameraUnsupported, t.scanCameraHint]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/90">
      <div className="relative flex-1 min-h-0 flex items-center justify-center p-3">
        <video
          ref={videoRef}
          playsInline
          muted
          className="max-h-full max-w-full w-full object-contain rounded-2xl bg-black"
        />
        {(error || hint) && (
          <div className="absolute inset-x-4 bottom-24 sm:bottom-28 rounded-2xl bg-black/75 border border-white/10 px-4 py-3 text-center space-y-1">
            {error ? (
              <p className="text-sm text-rose-200 inline-flex items-center justify-center gap-2">
                <CameraOff className="w-4 h-4 shrink-0" />
                {error}
              </p>
            ) : null}
            {hint ? <p className="text-sm text-slate-200">{hint}</p> : null}
            {!error ? (
              <p className="text-xs text-slate-400">{t.scanCameraHint}</p>
            ) : null}
          </div>
        )}
      </div>
      <div className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-[#0b1220]">
        <p className="text-center text-sm text-slate-300 mb-3">{t.scanCamera}</p>
        <button
          type="button"
          onClick={() => {
            stopTracks();
            onClose();
          }}
          className="w-full min-h-14 rounded-2xl bg-white/10 text-white text-base font-bold hover:bg-white/15 inline-flex items-center justify-center gap-2"
        >
          <X className="w-5 h-5" />
          {locale === "en" ? "Close" : "إغلاق"}
        </button>
      </div>
    </div>
  );
}
