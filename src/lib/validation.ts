import { normalizeAnswer } from "./normalize";

export const MAX_ANSWER_LENGTH = 60;

export type AnswerProblem = "empty" | "too_short" | "too_long" | "spam" | "duplicate";

export type AnswerCheck = { ok: true; normalized: string } | { ok: false; reason: AnswerProblem };

/**
 * Mild validation for game answers. Rejects only things that cannot be a genuine
 * association: empty, a single letter, very long text, one character mashed
 * repeatedly ("aaaa"), a short chunk repeated 4+ times ("asdasdasdasd"), or a
 * repeat of an answer already given for the same cue. Two-letter words, numbers,
 * and emoji are accepted.
 */
export function checkAnswer(raw: string, previousNormalized: string[] = []): AnswerCheck {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_ANSWER_LENGTH) return { ok: false, reason: "too_long" };
  const normalized = normalizeAnswer(trimmed);
  if (!normalized) return { ok: false, reason: "empty" };
  const graphemes = [...normalized];
  if (graphemes.length === 1 && /\p{L}/u.test(normalized)) return { ok: false, reason: "too_short" };
  const compact = normalized.replace(/\s/g, "");
  if (/^(.)\1{2,}$/u.test(compact) || /^(.{2,4})\1{3,}$/u.test(compact)) return { ok: false, reason: "spam" };
  if (previousNormalized.includes(normalized)) return { ok: false, reason: "duplicate" };
  return { ok: true, normalized };
}
