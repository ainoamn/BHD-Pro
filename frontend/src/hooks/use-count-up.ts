"use client";

import { useEffect, useRef, useState } from "react";

/** Animates from 0 → value when the element enters the viewport. */
export function useCountUp(value: number, enabled: boolean, durationMs = 1100) {
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!started || !enabled) {
      setDisplay(0);
      return;
    }
    const start = performance.now();
    const from = 0;
    const to = value;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, enabled, value, durationMs]);

  return { ref, display: started ? display : 0 };
}
