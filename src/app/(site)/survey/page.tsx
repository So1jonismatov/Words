import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { getQuestionnaire } from "@/lib/repo/participants";
import { currentParticipant } from "@/lib/session";
import { SurveyFlow } from "./survey-flow";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("survey"))("title") };
}

export default async function SurveyPage() {
  const participant = await currentParticipant();
  if (!participant) redirect("/start");
  if (participant.surveyCompletedAt) redirect(participant.completedAt ? "/results" : "/game");

  const q = await getQuestionnaire(participant.id);
  const initial = {
    q1Text: q?.q1Text ?? "",
    q2Choices: q?.q2Choices ?? [],
    q2Other: q?.q2Other ?? "",
    q3: q?.q3 ?? "",
    q4: q?.q4 ?? "",
  };
  const firstOpen = !initial.q1Text ? 1 : initial.q2Choices.length === 0 ? 2 : !initial.q3 ? 3 : 4;

  return (
    // Same height for every step (buttons pinned to the bottom), so the card doesn't jump between questions.
    <Card className="flex min-h-[min(31rem,calc(100dvh-8.5rem))] w-full max-w-2xl flex-col p-4 sm:p-6">
      <SurveyFlow initial={initial} startStep={firstOpen} />
    </Card>
  );
}
