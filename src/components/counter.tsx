"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { formatNumber } from "@/lib/utils";

/** Counts up to `value` once visible. Server-renders the final number; skips animation for reduced motion. */
export function Counter({ value, durationMs = 1400 }: { value: number; durationMs?: number }) {
  const locale = useLocale();
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / durationMs);
        setShown(Math.round(value * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      setShown(0);
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {formatNumber(shown, locale)}
    </span>
  );
}
