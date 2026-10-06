"use server";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/i18n/request";
import { AGE_GROUPS, BACKGROUNDS, EDUCATION, GENDERS, LOCALES, OTHER_COUNTRY, UZ_REGIONS } from "@/lib/options";
import { rateLimit } from "@/lib/rate-limit";
import { createParticipant, deleteParticipant, findParticipantIdByDeleteCode, updateDemographics } from "@/lib/repo/participants";
import { addRound, getAssignments, getSavedResponses } from "@/lib/repo/game";
import { normalizeDeleteCode } from "@/lib/delete-code";
import { poolFor } from "@/lib/participant-pool";
import { currentLink } from "@/lib/link-cookie";
import { clearSessionCookie, currentParticipant, setSessionCookie } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import type { ActionResult } from "./types";

const demographicsSchema = z.object({
  ageGroup: z.enum(AGE_GROUPS),
  gender: z.enum(GENDERS).nullable(),
  country: z.string().regex(/^([A-Z]{2}|OTHER)$/),
  countryOther: z.string().trim().max(80).nullable(),
  region: z.enum(UZ_REGIONS).nullable(),
  education: z.enum(EDUCATION).nullable(),
  background: z.enum(BACKGROUNDS).nullable(),
  consent: z.literal(true),
});

export type DemographicsInput = z.infer<typeof demographicsSchema>;

export async function startParticipation(input: DemographicsInput): Promise<ActionResult> {
  const parsed = demographicsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "start.missing" };
  const d = parsed.data;
  if (d.ageGroup === "under18") return { ok: false, error: "under18" };

  const settings = await getSettings();
  if (d.country !== OTHER_COUNTRY && !settings.countries.includes(d.country)) return { ok: false, error: "start.missing" };
  if (!(await rateLimit("start", 30, 60 * 60 * 1000))) return { ok: false, error: "common.errorRateLimited" };

  const demographics = {
    ageGroup: d.ageGroup,
    gender: d.gender,
    country: d.country,
    countryOther: d.country === OTHER_COUNTRY ? d.countryOther || null : null,
    region: d.country === "UZ" ? d.region : null,
    education: d.education,
    background: d.background,
    uiLang: await getLocale(),
  };
  const linkId = (await currentLink())?.id ?? null;

  const existing = await currentParticipant();
  if (existing && !existing.completedAt) {
    // Keep the original link once cue words have been drawn from its pool.
    const started = (await getAssignments(existing.id)).length > 0;
    await updateDemographics(existing.id, { ...demographics, linkId: started ? existing.linkId : linkId });
  } else {
    const { token } = await createParticipant({ ...demographics, linkId });
    await setSessionCookie(token);
  }
  return { ok: true };
}

export async function deleteMyData(): Promise<ActionResult<{ deleted: boolean }>> {
  const p = await currentParticipant();
  if (p) await deleteParticipant(p.id);
  await clearSessionCookie();
  return { ok: true, data: { deleted: Boolean(p) } };
}

/**
 * Deletes a participant's data by the delete code shown on their results page, for when
 * the session cookie is gone. Rate-limited per IP; an unknown code reveals nothing else.
 */
export async function deleteByCode(code: string): Promise<ActionResult> {
  if (!(await rateLimit("delete-code", 10, 60 * 60 * 1000))) return { ok: false, error: "common.errorRateLimited" };
  const parsed = z.string().max(40).safeParse(code);
  const normalized = parsed.success ? normalizeDeleteCode(parsed.data) : null;
  if (!normalized) return { ok: false, error: "about.deleteCodeInvalid" };
  const id = await findParticipantIdByDeleteCode(normalized);
  if (!id) return { ok: false, error: "about.deleteCodeUnknown" };
  const current = await currentParticipant();
  await deleteParticipant(id);
  if (current?.id === id) await clearSessionCookie();
  return { ok: true };
}

/** "Play more words": adds another round of unseen cues for a participant who finished. */
export async function playMoreWords(): Promise<ActionResult> {
  const p = await currentParticipant();
  if (!p || !p.completedAt) return { ok: false, error: "common.errorSession" };
  if (!(await rateLimit("play-more", 20, 60 * 60 * 1000))) return { ok: false, error: "common.errorRateLimited" };
  const [assignments, saved] = await Promise.all([getAssignments(p.id), getSavedResponses(p.id)]);
  // A round that is still open is simply continued.
  if (assignments.some((a) => !saved.has(a.cueId))) return { ok: true };
  const { n, pool } = await poolFor(p);
  const added = await addRound(p.id, n, pool);
  return added > 0 ? { ok: true } : { ok: false, error: "results.noMoreWords" };
}

export async function setLocale(locale: string): Promise<ActionResult> {
  const parsed = z.enum(LOCALES).safeParse(locale);
  if (!parsed.success) return { ok: false, error: "common.errorGeneric" };
  (await cookies()).set(LOCALE_COOKIE, parsed.data, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return { ok: true };
}
