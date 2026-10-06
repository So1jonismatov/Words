import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Tonal surface container — no border, separated from the page by tone only. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[28px] bg-card p-5 sm:p-7", className)} {...props} />;
}

/** Tiny uppercase section label. */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs font-bold tracking-[0.14em] text-muted uppercase", className)} {...props} />;
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn("h-px border-0 bg-line/50", className)} />;
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-1 w-full overflow-hidden rounded-full bg-card-2"
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}
