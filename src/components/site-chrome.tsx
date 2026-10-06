import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoMark } from "./logo";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import type { Locale } from "@/lib/options";
import { displayUz } from "@/lib/normalize";

export async function SiteHeader({ title, languages }: { title: string; languages: Locale[] }) {
  return (
    <header className="mx-auto flex h-14 w-full max-w-6xl shrink-0 items-center justify-between gap-3 px-3 sm:px-6">
      <Link href="/" className="flex min-w-0 items-center gap-2 rounded-full py-1 pr-2 text-fg">
        <LogoMark className="size-6 shrink-0 text-accent" />
        <span className="truncate text-[15px] font-bold tracking-tight">{displayUz(title)}</span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <LocaleSwitcher enabled={languages} />
        <ThemeToggle />
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 px-3 py-2 text-[13px] text-muted sm:justify-between sm:px-6">
      <p className="hidden sm:block">{t("nonprofit")}</p>
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <Link className="tap py-1 hover:text-fg" href="/about">
          {t("about")}
        </Link>
        <Link className="tap py-1 hover:text-fg" href="/about#privacy">
          {t("privacy")}
        </Link>
        <Link className="tap py-1 hover:text-fg" href="/about#delete">
          {t("deleteData")}
        </Link>
      </nav>
    </footer>
  );
}
