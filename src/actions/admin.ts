"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { checkAdminPassword, clearAdminSession, requireAdmin, setAdminSession, adminPasswordConfigured } from "@/lib/admin-auth";
import { parseCsv } from "@/lib/csv";
import { rateLimit } from "@/lib/rate-limit";
import { addWords, deleteWord, markWordReviewed, moveWord, setWordActive, updateWordMeaning, updateWordText } from "@/lib/repo/words";
import { saveSettings, settingsSchema } from "@/lib/settings";
import { createLink, deleteLink, setLinkActive, updateLink } from "@/lib/repo/links";
import { getLocale, getTranslations } from "next-intl/server";
import { CHART_DIMENSIONS, CHART_METRICS, NA, type ChartResult } from "@/lib/charts";
import { displayUz } from "@/lib/normalize";
import { AGE_GROUPS, BACKGROUNDS, GENDERS, OTHER_COUNTRY } from "@/lib/options";
import { getChart } from "@/lib/repo/charts";
import { listLinks as listAllLinks } from "@/lib/repo/links";
import { listWords } from "@/lib/repo/words";
import type { ActionResult } from "./types";

export async function adminLogin(password: string): Promise<ActionResult> {
  if (!adminPasswordConfigured()) return { ok: false, error: "admin.login.notConfigured" };
  if (!(await rateLimit("admin-login", 10, 15 * 60 * 1000))) return { ok: false, error: "admin.login.rateLimited" };
  const parsed = z.string().min(1).max(200).safeParse(password);
  if (!parsed.success || !checkAdminPassword(parsed.data)) return { ok: false, error: "admin.login.wrong" };
  await setAdminSession();
  return { ok: true };
}

export async function adminLogout() {
  await clearAdminSession();
  refresh();
}

const id = z.number().int().positive();

export async function addWordsAction(text: string): Promise<ActionResult<{ added: string[]; skipped: string[] }>> {
  await requireAdmin();
  const parsed = z.string().max(20_000).safeParse(text);
  if (!parsed.success) return { ok: false, error: "admin.settings.invalid" };
  const lines = parsed.data.split(/\r?\n/).map((l) => ({ text: l }));
  const res = await addWords(lines);
  refresh();
  return { ok: true, data: res };
}

export async function importWordsCsvAction(csv: string): Promise<ActionResult<{ added: number; skipped: number }>> {
  await requireAdmin();
  const parsed = z.string().max(500_000).safeParse(csv);
  if (!parsed.success) return { ok: false, error: "admin.settings.invalid" };
  const rows = parseCsv(parsed.data);
  const body = rows[0]?.[0]?.trim().toLowerCase() === "text" ? rows.slice(1) : rows;
  const res = await addWords(
    body.map((r) => ({
      text: r[0] ?? "",
      active: r[1] === undefined || r[1].trim() === "" ? true : !["0", "false", "no"].includes(r[1].trim().toLowerCase()),
      needsReview: ["1", "true", "yes"].includes((r[3] ?? "").trim().toLowerCase()),
    })),
  );
  refresh();
  return { ok: true, data: { added: res.added.length, skipped: res.skipped.length } };
}

export async function updateWordAction(wordId: number, text: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ wordId: id, text: z.string().max(80) }).safeParse({ wordId, text });
  if (!parsed.success) return { ok: false, error: "admin.words.empty" };
  const res = await updateWordText(parsed.data.wordId, parsed.data.text);
  if (res !== "ok") return { ok: false, error: `admin.words.${res}` };
  refresh();
  return { ok: true };
}

const meaningSchema = z.object({
  wordId: id,
  uz: z.string().trim().max(400),
  en: z.string().trim().max(400),
  ru: z.string().trim().max(400),
  related: z.array(z.string().max(80)).max(12),
});

export async function updateWordMeaningAction(input: z.input<typeof meaningSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = meaningSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "admin.settings.invalid" };
  const { wordId, uz, en, ru, related } = parsed.data;
  await updateWordMeaning(wordId, uz || en || ru ? { uz, en, ru } : null, related);
  refresh();
  return { ok: true };
}

export async function setWordActiveAction(wordId: number, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ wordId: id, active: z.boolean() }).safeParse({ wordId, active });
  if (!parsed.success) return { ok: false, error: "common.errorGeneric" };
  await setWordActive(parsed.data.wordId, parsed.data.active);
  refresh();
  return { ok: true };
}

export async function markWordReviewedAction(wordId: number): Promise<ActionResult> {
  await requireAdmin();
  const parsed = id.safeParse(wordId);
  if (!parsed.success) return { ok: false, error: "common.errorGeneric" };
  await markWordReviewed(parsed.data);
  refresh();
  return { ok: true };
}

export async function moveWordAction(wordId: number, direction: -1 | 1): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ wordId: id, direction: z.union([z.literal(-1), z.literal(1)]) }).safeParse({ wordId, direction });
  if (!parsed.success) return { ok: false, error: "common.errorGeneric" };
  await moveWord(parsed.data.wordId, parsed.data.direction);
  refresh();
  return { ok: true };
}

export async function deleteWordAction(wordId: number): Promise<ActionResult> {
  await requireAdmin();
  const parsed = id.safeParse(wordId);
  if (!parsed.success) return { ok: false, error: "common.errorGeneric" };
  await deleteWord(parsed.data);
  refresh();
  return { ok: true };
}

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "admin.settings.invalid" };
  await saveSettings({ ...parsed.data, countries: [...new Set(parsed.data.countries)] });
  refresh();
  return { ok: true };
}

const linkInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  cueIds: z.array(z.number().int().positive()).min(1).max(1000),
  cuesPerParticipant: z.number().int().min(1).max(100),
});
const linkId = z.string().regex(/^[A-Za-z0-9]{4,32}$/);

export async function createLinkAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = linkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "admin.settings.invalid" };
  const link = await createLink(parsed.data);
  refresh();
  return { ok: true, data: { id: link.id } };
}

export async function updateLinkAction(id: string, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsedId = linkId.safeParse(id);
  const parsed = linkInputSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return { ok: false, error: "admin.settings.invalid" };
  await updateLink(parsedId.data, parsed.data);
  refresh();
  return { ok: true };
}

export async function setLinkActiveAction(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: linkId, active: z.boolean() }).safeParse({ id, active });
  if (!parsed.success) return { ok: false, error: "common.errorGeneric" };
  await setLinkActive(parsed.data.id, parsed.data.active);
  refresh();
  return { ok: true };
}

export async function deleteLinkAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = linkId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "common.errorGeneric" };
  const res = await deleteLink(parsed.data);
  if (res === "in_use") return { ok: false, error: "admin.links.deleteBlocked" };
  refresh();
  return { ok: true };
}

const dateParam = z
  .string()
  .regex(/^d{4}-d{2}-d{2}$/)
  .optional();

const chartInputSchema = z.object({
  x: z.enum(CHART_DIMENSIONS),
  series: z.union([z.enum(CHART_DIMENSIONS), z.literal("none")]),
  metric: z.enum(CHART_METRICS),
  word: z.string().max(60).optional(),
  cueIds: z.array(z.number().int().positive()).max(500).default([]),
  filter: z
    .object({
      ageGroup: z.enum(AGE_GROUPS).optional(),
      gender: z.enum(GENDERS).optional(),
      country: z.string().regex(/^([A-Z]{2}|OTHER)$/).optional(),
      background: z.enum(BACKGROUNDS).optional(),
      link: z.string().regex(/^(none|[A-Za-z0-9]{4,32})$/).optional(),
      from: dateParam,
      to: dateParam,
    })
    .default({}),
});

export type ChartInput = z.input<typeof chartInputSchema>;

export interface LabelledChart extends ChartResult {
  xLabels: Record<string, string>;
  seriesLabels: Record<string, string>;
}

/** Chart builder data: aggregated with k-anonymity on the server, labels in the admin's language. */
export async function chartAction(input: ChartInput): Promise<ActionResult<LabelledChart>> {
  await requireAdmin();
  const parsed = chartInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "admin.settings.invalid" };
  const { x, series, metric, word, cueIds, filter } = parsed.data;
  const day = (v: string | undefined, end: boolean) => (v ? Date.parse(`${v}T00:00:00Z`) + (end ? 86_399_999 : 0) : undefined);
  const result = await getChart(
    { ...filter, from: day(filter.from, false), to: day(filter.to, true) },
    { x, series, metric, word },
    cueIds,
  );

  const [to, ta, locale, links, words] = await Promise.all([
    getTranslations("options"),
    getTranslations("admin.charts"),
    getLocale(),
    x === "link" || series === "link" ? listAllLinks() : Promise.resolve([]),
    x === "cue" || series === "cue" ? listWords() : Promise.resolve([]),
  ]);
  const countries = new Intl.DisplayNames([locale === "uz" ? "uz-Latn" : locale], { type: "region" });
  const LANGS: Record<string, string> = { uz: "Oʻzbekcha", en: "English", ru: "Русский" };
  const label = (dim: string, key: string): string => {
    if (key === "all") return ta("all");
    if (key === NA) return ta("na");
    switch (dim) {
      case "country":
        return key === OTHER_COUNTRY ? to("country.OTHER") : (countries.of(key) ?? key);
      case "link":
        return links.find((l) => l.id === key)?.name ?? key;
      case "cue":
        return displayUz(words.find((w) => String(w.id) === key)?.text ?? key);
      case "uiLang":
        return LANGS[key] ?? key;
      case "day":
      case "week":
        return key;
      default:
        return to(`${dim}.${key}`);
    }
  };
  return {
    ok: true,
    data: {
      ...result,
      xLabels: Object.fromEntries(result.x.map((k) => [k, label(x, k)])),
      seriesLabels: Object.fromEntries(result.series.map((k) => [k, label(series, k)])),
    },
  };
}
