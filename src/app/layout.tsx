import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "@fontsource-variable/manrope";
import "./globals.css";
import { InlineScript } from "@/components/inline-script";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { THEME_SCRIPT } from "@/components/theme-toggle";
import { HTML_LANG, type Locale } from "@/lib/options";
import { getSettings } from "@/lib/settings";
import { displayUz } from "@/lib/normalize";

/** Absolute base for link-preview URLs. Set SITE_URL in production. */
function siteUrl(): URL | undefined {
  try {
    return process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined;
  } catch {
    return undefined;
  }
}

const OG_LOCALE: Record<Locale, string> = { uz: "uz_UZ", en: "en_US", ru: "ru_RU" };

export async function generateMetadata(): Promise<Metadata> {
  const [settings, t, locale] = await Promise.all([getSettings(), getTranslations("meta"), getLocale()]);
  const title = displayUz(settings.siteTitle);
  const description = t("description");
  return {
    metadataBase: siteUrl(),
    title: { default: title, template: `%s · ${title}` },
    description,
    robots: { index: true, follow: true },
    // The image itself comes from app/opengraph-image.tsx.
    openGraph: { type: "website", siteName: title, title, description, locale: OG_LOCALE[locale as Locale] ?? "uz_UZ", url: "/" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let the on-screen keyboard shrink the layout so the game inputs stay visible.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#111315" },
    { media: "(prefers-color-scheme: light)", color: "#f8f6f1" },
  ],
};

/**
 * App shell: fixed-height viewport. Header stays put; only <main> scrolls, and
 * pages are designed to fit without scrolling at common screen sizes.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, settings, t] = await Promise.all([getLocale(), getSettings(), getTranslations("common")]);
  return (
    <html lang={HTML_LANG[locale as Locale] ?? locale} className="dark" suppressHydrationWarning>
      <head>
        {/* Sets the theme class before first paint, so there is no flash and the toggle works immediately. */}
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body className="flex h-dvh flex-col overflow-hidden">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-accent px-4 py-2 text-accent-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <SiteHeader title={settings.siteTitle} languages={settings.enabledLanguages} />
          <main id="main" className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-h-full flex-col">
              <div className="flex flex-1 flex-col">{children}</div>
              <SiteFooter />
            </div>
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
