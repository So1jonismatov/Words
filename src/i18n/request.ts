import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/options";
import { getSettings } from "@/lib/settings";

export const LOCALE_COOKIE = "NEXT_LOCALE";

function isLocale(v: string | undefined): v is Locale {
  return Boolean(v) && (LOCALES as readonly string[]).includes(v!);
}

/** Locale = cookie (set by the switcher) → Accept-Language → Uzbek; restricted to enabled languages. */
export async function resolveLocale(enabled: readonly Locale[]): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie) && enabled.includes(fromCookie)) return fromCookie;
  if (!fromCookie) {
    const accept = (await headers()).get("accept-language") ?? "";
    for (const part of accept.split(",")) {
      const code = part.trim().slice(0, 2).toLowerCase();
      if (isLocale(code) && enabled.includes(code)) return code;
    }
  }
  return enabled.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : enabled[0];
}

export default getRequestConfig(async () => {
  let enabled: readonly Locale[] = LOCALES;
  try {
    enabled = (await getSettings()).enabledLanguages;
  } catch {
    // Database not reachable yet: fall back to all languages.
  }
  const locale = await resolveLocale(enabled);
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
