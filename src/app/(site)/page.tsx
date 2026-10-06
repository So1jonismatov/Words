import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Counter } from "@/components/counter";
import { buttonClass } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { currentLink } from "@/lib/link-cookie";
import { ESTIMATED_MINUTES, PUBLIC_COUNTS_MIN } from "@/lib/options";
import { getPublicCounts } from "@/lib/repo/results";
import { currentParticipant, stageOf } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

/** Demo shown on the landing page. Cue words are Uzbek in every UI language. */
const DEMO_CUE = "daryo";
const DEMO_ANSWER = "suv";

const STAGE_HREF = { start: "/start", survey: "/survey", game: "/game", results: "/results" } as const;

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const [t, settings, counts, participant, link, sp] = await Promise.all([
    getTranslations("landing"),
    getSettings(),
    getPublicCounts(),
    currentParticipant(),
    currentLink(),
    searchParams,
  ]);
  // Visitors who came through a survey link get that link's number of words.
  const cueCount = link ? Math.min(link.cuesPerParticipant, link.cueIds.length) : settings.cuesPerParticipant;
  const stage = stageOf(participant);
  const inProgress = stage === "survey" || stage === "game";

  const steps = [
    { title: t("step1Title"), text: t("step1Text") },
    { title: t("step2Title"), text: t("step2Text", { count: cueCount }) },
    { title: t("step3Title"), text: t("step3Text") },
  ];
  // Live counters only once they are credible; until then, describe the task instead.
  const stats =
    counts.participants >= PUBLIC_COUNTS_MIN
      ? [
          { value: cueCount, label: t("statWords") },
          { value: counts.participants, label: t("statParticipants") },
          { value: counts.responses, label: t("statResponses") },
        ]
      : [
          { value: cueCount, label: t("statWords") },
          { value: 4, label: t("statQuestions") },
          { value: ESTIMATED_MINUTES, label: t("statMinutes") },
        ];

  return (
    <div className="animate-enter grid w-full max-w-5xl items-center gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
      <section className="text-center lg:text-left">
        {sp.link === "inactive" && (
          <p role="status" className="mx-auto mb-3 w-fit rounded-full bg-accent-soft px-4 py-1.5 text-[13px] font-medium lg:mx-0">
            {t("linkInactive")}
          </p>
        )}
        <h1 className="text-[clamp(1.45rem,4.2vw,2.75rem)] leading-[1.12] font-extrabold tracking-tight text-balance">{t("hero")}</h1>
        <p className="mx-auto mt-2.5 max-w-lg text-[15px] leading-relaxed text-muted text-pretty sm:text-base lg:mx-0 lg:mt-4">
          {t("sub", { minutes: ESTIMATED_MINUTES })}
        </p>

        <Link
          href={inProgress ? STAGE_HREF[stage] : "/start"}
          className={cn(buttonClass("primary", "lg"), "mt-5 hidden min-w-44 lg:inline-flex")}
        >
          {inProgress ? t("resume") : t("play")}
        </Link>

        <dl className="mt-8 hidden gap-8 lg:flex">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse">
              <dt className="text-[13px] tracking-wide text-muted">{s.label}</dt>
              <dd className="text-2xl font-extrabold text-accent">
                <Counter value={s.value} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Card className="p-4 sm:p-6">
        <div className="text-center" aria-hidden>
          <Eyebrow>{t("demoLabel")}</Eyebrow>
          <p lang="uz" className="mt-1 text-[clamp(2.25rem,8vw,3.25rem)] leading-tight font-extrabold tracking-tight">
            {DEMO_CUE}
          </p>
          <div className="mx-auto mt-2 flex h-11 max-w-60 items-center rounded-t-xl rounded-b-md bg-card-2 px-4 text-left text-base shadow-[inset_0_-2px_0_var(--accent)]">
            <span lang="uz">{DEMO_ANSWER}</span>
            <span className="ml-0.5 h-4 w-px animate-pulse bg-accent" />
          </div>
        </div>

        <Eyebrow className="mt-5 sm:mt-6">{t("howTitle")}</Eyebrow>
        <ol className="mt-2.5 space-y-1.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl bg-card-3 px-3 py-2 sm:items-start sm:py-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold">{s.title}</h2>
                <p className="hidden text-[13px] leading-snug text-muted sm:block [@media(min-height:800px)]:block">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <Link href={inProgress ? STAGE_HREF[stage] : "/start"} className={cn(buttonClass("primary", "lg"), "mt-4 w-full lg:hidden")}>
          {inProgress ? t("resume") : t("play")}
        </Link>

        <dl className="mt-3 grid grid-cols-3 text-center lg:hidden">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse">
              <dt className="text-[13px] text-muted">{s.label}</dt>
              <dd className="text-lg font-extrabold text-accent">
                <Counter value={s.value} />
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
