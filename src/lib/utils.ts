import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Locale-aware thousands grouping that renders identically on server and client
 * (Node's and the browser's ICU data disagree for Uzbek, which breaks hydration).
 */
export function formatNumber(n: number, locale: string): string {
  const grouped = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u0001");
  return grouped.replace(/\u0001/g, locale === "en" ? "," : " ");
}
