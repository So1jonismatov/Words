"use server";

import { z } from "zod";
import { hit } from "@/lib/rate-limit";
import { getAssignments, getSavedResponses, saveCueResponses, type ResponseInput } from "@/lib/repo/game";
import { markGameCompleted } from "@/lib/repo/participants";
import { currentParticipant } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { checkAnswer } from "@/lib/validation";
import type { ActionResult } from "./types";

const latency = z.number().int().min(0).max(24 * 60 * 60 * 1000).nullable();

const saveCueSchema = z.object({
  cueId: z.number().int().positive(),
  answers: z.array(z.object({ text: z.string().max(200), latencyMs: latency })).max(3),
  /** Typed event instead of an empty string: unfamiliar word, no more answers, or skip. */
  event: z.enum(["unknown", "no_more", "skipped"]).nullable(),
  eventLatencyMs: latency,
});

export type SaveCueInput = z.infer<typeof saveCueSchema>;

export async function saveCue(input: SaveCueInput): Promise<ActionResult> {
  const p = await currentParticipant();
  if (!p || !p.surveyCompletedAt) return { ok: false, error: "common.errorSession" };
  if (!hit(`cue:${p.id}`, 90, 60_000)) return { ok: false, error: "common.errorRateLimited" };
  const parsed = saveCueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "common.errorGeneric" };
  const { cueId, answers, event, eventLatencyMs } = parsed.data;
  const { responsesPerCue } = await getSettings();

  const rows: ResponseInput[] = [];
  if (event === "unknown" || event === "skipped") {
    rows.push({ slot: 1, rawText: null, normalizedText: null, status: event, latencyMs: eventLatencyMs });
  } else {
    if (answers.length === 0) return { ok: false, error: "game.errors.empty" };
    const seen: string[] = [];
    for (const [i, a] of answers.slice(0, responsesPerCue).entries()) {
      const check = checkAnswer(a.text, seen);
      if (!check.ok) return { ok: false, error: `game.errors.${check.reason}` };
      seen.push(check.normalized);
      rows.push({ slot: i + 1, rawText: a.text.trim(), normalizedText: check.normalized, status: "answered", latencyMs: a.latencyMs });
    }
    if (event === "no_more" && rows.length < responsesPerCue) {
      rows.push({ slot: rows.length + 1, rawText: null, normalizedText: null, status: "no_more", latencyMs: eventLatencyMs });
    }
  }

  const saved = await saveCueResponses(p.id, cueId, rows);
  return saved ? { ok: true } : { ok: false, error: "common.errorGeneric" };
}

export async function finishGame(): Promise<ActionResult> {
  const p = await currentParticipant();
  if (!p) return { ok: false, error: "common.errorSession" };
  const [assignments, saved] = await Promise.all([getAssignments(p.id), getSavedResponses(p.id)]);
  if (assignments.length === 0 || assignments.some((a) => !saved.has(a.cueId))) {
    return { ok: false, error: "common.errorGeneric" };
  }
  if (!p.completedAt) await markGameCompleted(p.id);
  return { ok: true };
}
