"use server";

import { z } from "zod";
import { Q2_MAX, Q2_OPTIONS, Q3_OPTIONS, Q4_OPTIONS } from "@/lib/options";
import { markSurveyCompleted, saveQuestionnaire } from "@/lib/repo/participants";
import { currentParticipant } from "@/lib/session";
import type { ActionResult } from "./types";

const stepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal(1), q1Text: z.string().trim().min(1).max(80) }),
  z
    .object({
      step: z.literal(2),
      q2Choices: z.array(z.enum([...Q2_OPTIONS, "other"])).min(1).max(Q2_MAX),
      q2Other: z.string().trim().max(80).nullable(),
    })
    .refine((v) => !v.q2Choices.includes("other") || Boolean(v.q2Other), { message: "survey.otherRequired" })
    .refine((v) => new Set(v.q2Choices).size === v.q2Choices.length),
  z.object({ step: z.literal(3), q3: z.enum(Q3_OPTIONS) }),
  z.object({ step: z.literal(4), q4: z.enum(Q4_OPTIONS) }),
]);

export type SurveyStepInput = z.infer<typeof stepSchema>;

export async function saveSurveyStep(input: SurveyStepInput): Promise<ActionResult> {
  const p = await currentParticipant();
  if (!p) return { ok: false, error: "common.errorSession" };
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return { ok: false, error: msg?.startsWith("survey.") ? msg : "survey.answerRequired" };
  }
  const v = parsed.data;
  switch (v.step) {
    case 1:
      await saveQuestionnaire(p.id, { q1Text: v.q1Text });
      break;
    case 2:
      await saveQuestionnaire(p.id, {
        q2Choices: v.q2Choices,
        q2Other: v.q2Choices.includes("other") ? v.q2Other : null,
      });
      break;
    case 3:
      await saveQuestionnaire(p.id, { q3: v.q3 });
      break;
    case 4:
      await saveQuestionnaire(p.id, { q4: v.q4 });
      await markSurveyCompleted(p.id);
      break;
  }
  return { ok: true };
}
