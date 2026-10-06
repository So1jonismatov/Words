import { getLocale, getTranslations } from "next-intl/server";
import { typographyUz } from "./normalize";
import { ESTIMATED_MINUTES, type Locale } from "./options";
import { getSettings } from "./settings";

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** Admin text in Uzbek gets the site's apostrophe convention (oʻ, gʻ, ʼ). */
const typeset = (text: string, locale: string) => (locale === "uz" ? typographyUz(text) : text);

/** Consent statement lines: the admin-edited text for this language, else the default from messages. */
export async function getConsentLines(): Promise<string[]> {
  const [settings, locale, t] = await Promise.all([getSettings(), getLocale(), getTranslations("consent")]);
  const custom = settings.consentText[locale as Locale]?.trim();
  return lines(custom ? typeset(custom, locale) : t("default", { minutes: ESTIMATED_MINUTES }));
}

/** Data-retention statement: admin text for this language, else the default. */
export async function getRetentionText(): Promise<string> {
  const [settings, locale, t] = await Promise.all([getSettings(), getLocale(), getTranslations("about")]);
  const custom = settings.dataRetention[locale as Locale]?.trim();
  return custom ? typeset(custom, locale) : t("retentionDefault");
}
