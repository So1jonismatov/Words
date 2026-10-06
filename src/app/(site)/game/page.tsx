import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { displayUz } from "@/lib/normalize";
import { poolFor } from "@/lib/participant-pool";
import { getOrCreateAssignments, getSavedResponses } from "@/lib/repo/game";
import { currentParticipant } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { Game, type GameCue } from "./game";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("game"))("introTitle") };
}

export default async function GamePage() {
  const participant = await currentParticipant();
  if (!participant) redirect("/start");
  if (!participant.surveyCompletedAt) redirect("/survey");

  const [settings, t, { n, pool }] = await Promise.all([getSettings(), getTranslations("game"), poolFor(participant)]);
  // A participant who came through a survey link gets cues from that link's word set only.
  const assignments = await getOrCreateAssignments(participant.id, n, pool);
  if (assignments.length === 0) {
    return (
      <Card className="w-full max-w-md text-center">
        <p className="text-muted">{t("noCues")}</p>
      </Card>
    );
  }

  // Only the latest round is played; earlier rounds are already on the results page.
  const round = Math.max(...assignments.map((a) => a.round));
  const saved = await getSavedResponses(participant.id);
  const cues: GameCue[] = assignments
    .filter((a) => a.round === round)
    .map((a) => {
      const rows = saved.get(a.cueId) ?? [];
      return {
        cueId: a.cueId,
        display: displayUz(a.text),
        done: rows.length > 0,
        answers: rows.filter((r) => r.status === "answered").map((r) => r.rawText ?? ""),
      };
    });
  const firstOpen = cues.findIndex((c) => !c.done);
  if (participant.completedAt && firstOpen === -1) redirect("/results");

  return (
    <Game
      cues={cues}
      responsesPerCue={settings.responsesPerCue}
      startIndex={firstOpen === -1 ? cues.length : firstOpen}
      showIntro={round === 1 && cues.every((c) => !c.done)}
    />
  );
}
