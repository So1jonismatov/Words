import { cn, percent } from "@/lib/utils";

export interface BarItem {
  key: string;
  label: string;
  count: number;
  highlight?: boolean;
  lang?: string;
}

/**
 * Horizontal bar list. Bars are scaled to `total` (share of people); labels sit
 * above each bar so long Uzbek/Russian labels never truncate on phones.
 */
export function BarList({
  items,
  total,
  highlightLabel,
  className,
}: {
  items: BarItem[];
  total: number;
  highlightLabel?: string;
  className?: string;
}) {
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item) => {
        const pct = percent(item.count, total);
        return (
          <li key={item.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs leading-snug">
              <span lang={item.lang} className={cn("min-w-0", item.highlight ? "font-bold text-fg" : "text-fg/85")}>
                {item.label}
                {item.highlight && highlightLabel && (
                  <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-bold tracking-wide text-accent uppercase">
                    {highlightLabel}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold text-muted tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-card-2" aria-hidden>
              <div
                className={cn("h-full rounded-full", item.highlight ? "bg-accent" : "bg-teal/75")}
                style={{ width: `${Math.max(pct, item.count > 0 ? 2 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
