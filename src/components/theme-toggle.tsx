"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Runs before paint (see layout): stored choice, else system preference, else dark. */
export const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':!window.matchMedia('(prefers-color-scheme: light)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){document.documentElement.classList.add('dark')}})()`;

export function ThemeToggle() {
  const t = useTranslations("common");
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("theme");
      } catch {}
      if (stored) return;
      document.documentElement.classList.toggle("dark", !media.matches);
      setDark(!media.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };

  const label = dark ? t("themeToLight") : t("themeToDark");
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-fg/8 hover:text-fg"
    >
      {dark === false ? (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
