import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { getConsentLines } from "@/lib/consent";
import { OTHER_COUNTRY, UZ_REGIONS } from "@/lib/options";
import { currentParticipant } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { StartForm, type Option } from "./start-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("start"))("title") };
}

export default async function StartPage() {
  const [t, tOpt, locale, settings, consent, participant] = await Promise.all([
    getTranslations("start"),
    getTranslations("options"),
    getLocale(),
    getSettings(),
    getConsentLines(),
    currentParticipant(),
  ]);

  const names = new Intl.DisplayNames([locale === "uz" ? "uz-Latn" : locale], { type: "region" });
  const countries: Option[] = [
    ...settings.countries.map((code) => ({ code, label: names.of(code) ?? code })),
    { code: OTHER_COUNTRY, label: tOpt("country.OTHER") },
  ];
  // Sorted here, not in the client component: Node's and the browser's collation data can differ.
  const collator = new Intl.Collator(locale === "uz" ? "uz-Latn" : locale);
  const regions: Option[] = UZ_REGIONS.map((code) => ({ code, label: tOpt(`region.${code}`) })).sort((a, b) =>
    collator.compare(a.label, b.label),
  );

  // An unfinished participant can revise their answers; a finished one starts a fresh, separate session.
  const initial =
    participant && !participant.completedAt
      ? {
          ageGroup: participant.ageGroup,
          gender: participant.gender ?? "",
          country: participant.country,
          countryOther: participant.countryOther ?? "",
          region: participant.region ?? "",
          education: participant.education ?? "",
          background: participant.background ?? "",
        }
      : null;

  return (
    <Card className="animate-enter w-full max-w-2xl p-4 sm:p-6">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{t("title")}</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">{t("why")}</p>
      <StartForm countries={countries} regions={regions} consent={consent} initial={initial} />
    </Card>
  );
}
