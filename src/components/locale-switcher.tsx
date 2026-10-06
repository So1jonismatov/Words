"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/actions/participant";
import type { Locale } from "@/lib/options";
import { cn } from "@/lib/utils";

const NATIVE_NAMES: Record<Locale, string> = { uz: "Oʻzbekcha", en: "English", ru: "Русский" };

/** UZ / EN / RU segmented switch. The choice is stored in a cookie; URLs stay the same. */
export function LocaleSwitcher({ enabled }: { enabled: Locale[] }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (enabled.length < 2) return null;

  return (
    <div role="group" aria-label={t("language")} className={cn("flex rounded-full bg-card p-0.5", pending && "opacity-60")}>
      {enabled.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={active}
            aria-label={NATIVE_NAMES[l]}
            title={NATIVE_NAMES[l]}
            disabled={pending}
            onClick={() => {
              if (active) return;
              startTransition(async () => {
                await setLocale(l);
                router.refresh();
              });
            }}
            className={cn(
              "tap h-9 min-w-11 rounded-full px-2.5 text-[13px] font-bold tracking-wider transition-colors",
              active ? "bg-accent-soft text-fg" : "text-muted hover:text-fg",
            )}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
