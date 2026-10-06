import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, Eyebrow } from "@/components/ui/card";
import { getConsentLines, getRetentionText } from "@/lib/consent";
import { currentParticipant } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { DeleteData } from "./delete-data";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("about"))("title") };
}

function Bullets({ lines, muted }: { lines: string[]; muted?: boolean }) {
  return (
    <ul className={muted ? "space-y-1.5 text-[13px] leading-relaxed text-muted" : "space-y-1.5 text-sm leading-relaxed"}>
      {lines.map((line, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-[0.55em] size-1 shrink-0 rounded-full bg-accent" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AboutPage() {
  const [t, consent, retention, settings, participant] = await Promise.all([
    getTranslations("about"),
    getConsentLines(),
    getRetentionText(),
    getSettings(),
    currentParticipant(),
  ]);
  const notProvided = <span className="text-muted italic">{t("notProvided")}</span>;
  const study = [
    { label: t("institution"), value: settings.studyInstitution || notProvided },
    { label: t("contact"), value: settings.studyContact ? <span className="select-all">{settings.studyContact}</span> : notProvided },
    { label: t("ethics"), value: settings.ethicsApproval || notProvided },
    { label: t("retention"), value: retention },
  ];

  return (
    <div className="animate-enter grid w-full max-w-5xl gap-3 lg:grid-cols-2 lg:gap-4">
      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-fg/90">
            <p>{t("p1")}</p>
            <p>{t("p2")}</p>
            <p>{t("p3")}</p>
          </div>
        </div>
        <section aria-labelledby="study-title">
          <Eyebrow id="study-title" className="mb-2">
            {t("studyTitle")}
          </Eyebrow>
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            {study.map((s) => (
              <div key={s.label} className="contents">
                <dt className="font-semibold text-muted">{s.label}</dt>
                <dd className="mb-1 leading-relaxed sm:mb-0">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section id="privacy" className="scroll-mt-4">
          <Eyebrow className="mb-2">{t("privacyTitle")}</Eyebrow>
          <Bullets lines={[t("privacy1"), t("privacy2"), t("privacy3")]} />
        </section>
      </Card>

      <div className="grid gap-3 lg:gap-4">
        <Card className="p-5 sm:p-6">
          <Eyebrow className="mb-2">{t("consentTitle")}</Eyebrow>
          <div tabIndex={0} className="scroll-thin max-h-28 overflow-y-auto pr-1 lg:max-h-none">
            <Bullets lines={consent} muted />
          </div>
        </Card>
        <Card id="delete" className="scroll-mt-4 p-5 sm:p-6">
          <Eyebrow>{t("deleteTitle")}</Eyebrow>
          <DeleteData hasData={Boolean(participant)} />
        </Card>
      </div>
    </div>
  );
}
