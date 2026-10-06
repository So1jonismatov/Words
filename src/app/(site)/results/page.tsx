import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SEED_MEANINGS } from "@/db/meanings-data";
import { displayUz, hasCyrillic, normalizeAnswer } from "@/lib/normalize";
import { K_ANON, RESULTS_MIN_N, type Locale } from "@/lib/options";
import { poolFor } from "@/lib/participant-pool";
import { getAssignments, getSavedResponses, unseenCues } from "@/lib/repo/game";
import { ensureDeleteCode } from "@/lib/repo/participants";
import { getParticipantResults } from "@/lib/repo/results";
import { getWordMap } from "@/lib/repo/word-map";
import { currentParticipant, sessionToken } from "@/lib/session";
import { percent } from "@/lib/utils";
import { ResultsView, type MapProps, type MoreState, type QuestionBlock, type ResultsCue } from "./results-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("results"))("yourAnswers") };
}

export default async function ResultsPage() {
  const [participant, token] = await Promise.all([currentParticipant(), sessionToken()]);
  if (!participant || !token) redirect("/start");
  const t = await getTranslations("results");

  if (!participant.completedAt) {
    return (
      <Card className="w-full max-w-md text-center">
        <p>{t("incomplete")}</p>
        <Link href={participant.surveyCompletedAt ? "/game" : "/survey"} className={buttonClass("primary", "md") + " mt-4"}>
          {t("continueGame")}
        </Link>
      </Card>
    );
  }

  const [data, map, to, locale, deleteCode, assignments, saved, { n, pool }] = await Promise.all([
    getParticipantResults(participant.id),
    getWordMap(participant.id),
    getTranslations("options"),
    getLocale(),
    ensureDeleteCode(participant, token),
    getAssignments(participant.id),
    getSavedResponses(participant.id),
    poolFor(participant),
  ]);
  const q = data.questionnaire;
  const lang = (locale as Locale) ?? "uz";

  // "Play more words": continue an open round, or offer a new one while unseen words remain.
  const open = assignments.filter((a) => !saved.has(a.cueId)).length;
  const unseen = open > 0 ? 0 : (await unseenCues(participant.id, pool)).length;
  const more: MoreState = open > 0 ? { kind: "continue", count: open } : unseen > 0 ? { kind: "more", count: Math.min(n, unseen) } : { kind: "none", count: 0 };

  // Shape everything the client view needs into plain serializable props.
  const cues: ResultsCue[] = data.cues.map((c) => {
    const mineNorm = new Set(c.answers.map((a) => normalizeAnswer(a.raw)));
    const enough = c.total >= RESULTS_MIN_N;
    return {
      cueId: c.cueId,
      display: displayUz(c.text),
      status: c.status,
      othersTotal: c.othersTotal,
      total: c.total,
      enough,
      answers: c.answers.map((a) => ({
        slot: a.slot,
        raw: a.raw,
        // Cyrillic answers are compared in Latin; show that form too.
        latin: hasCyrillic(a.raw) ? displayUz(normalizeAnswer(a.raw)) : null,
        unique: enough && a.othersSame === 0,
        share: enough && a.othersSame > 0 ? Math.max(1, percent(a.othersSame, c.othersTotal)) : null,
      })),
      top: enough ? c.top.map((x) => ({ key: x.key, label: displayUz(x.key), count: x.count, highlight: mineNorm.has(x.key), lang: "uz" })) : [],
    };
  });

  const blocks: QuestionBlock[] = [
    { key: "q2", title: t("q2Short"), dist: q.q2, mine: data.mine?.q2Choices ?? [] },
    { key: "q3", title: t("q3Short"), dist: q.q3, mine: data.mine?.q3 ? [data.mine.q3] : [] },
    { key: "q4", title: t("q4Short"), dist: q.q4, mine: data.mine?.q4 ? [data.mine.q4] : [] },
  ].map((b) => ({
    key: b.key,
    title: b.title,
    total: b.dist.total,
    enough: b.dist.total >= RESULTS_MIN_N,
    mine: b.mine.map((k) => to(`${b.key}.${k}`)),
    items: b.dist.items.map((it) => ({
      key: it.key,
      label: to(`${b.key}.${it.key}`),
      count: it.count,
      highlight: b.mine.includes(it.key),
    })),
  }));

  const myQ1 = data.mine?.q1Text ? normalizeAnswer(data.mine.q1Text) : null;

  // Word map: labels in display form, meanings in the page language.
  const hubMeaning = SEED_MEANINGS["ma'naviyat"];
  const mapProps: MapProps = {
    minN: map.minN,
    hub: {
      key: "ma'naviyat",
      label: displayUz("ma'naviyat"),
      meaning: hubMeaning[lang],
      related: hubMeaning.related,
      q1: map.q1.map((w) => ({ key: w.key, label: displayUz(w.key), count: w.count, mine: w.key === myQ1 })),
    },
    cues: map.cues.map((c) => ({
      key: c.text,
      label: displayUz(c.text),
      played: c.played,
      total: c.total,
      meaning: c.meaning?.[lang] ?? null,
      related: c.related,
    })),
    links: map.links.map((l) => ({
      cueKey: map.cues.find((c) => c.id === l.cueId)!.text,
      key: l.key,
      label: displayUz(l.key),
      count: l.count,
      mine: l.mine,
    })),
  };

  return (
    <ResultsView
      cues={cues}
      blocks={blocks}
      q1Top={
        q.respondents >= RESULTS_MIN_N
          ? q.q1Top.map((w) => ({ key: w.key, label: displayUz(w.key), pct: percent(w.count, q.respondents), mine: w.key === myQ1 }))
          : []
      }
      myQ1={data.mine?.q1Text ?? null}
      respondents={q.respondents}
      minN={RESULTS_MIN_N}
      fewPeople={data.totalParticipants < K_ANON}
      map={mapProps}
      more={more}
      deleteCode={deleteCode}
    />
  );
}
