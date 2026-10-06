"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { adminLogout } from "@/actions/admin";
import { cn } from "@/lib/utils";

export function AdminNav() {
  const t = useTranslations("admin.nav");
  const path = usePathname();
  const links = [
    { href: "/admin", label: t("stats") },
    { href: "/admin/links", label: t("links") },
    { href: "/admin/words", label: t("words") },
    { href: "/admin/settings", label: t("settings") },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-full bg-card p-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={path === l.href ? "page" : undefined}
            className={cn(
              "flex h-8 items-center rounded-full px-4 text-xs font-semibold transition-colors",
              path === l.href ? "bg-accent-soft text-fg" : "text-muted hover:text-fg",
            )}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <span className="flex-1" />
      <Link href="/" className="flex h-8 items-center rounded-full px-3 text-xs text-muted hover:bg-fg/8 hover:text-fg">
        {t("viewSite")} ↗
      </Link>
      <form action={adminLogout}>
        <button type="submit" className="h-8 rounded-full px-3 text-xs text-muted hover:bg-fg/8 hover:text-fg">
          {t("logout")}
        </button>
      </form>
    </nav>
  );
}
