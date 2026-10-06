import { cache } from "react";
import { z } from "zod";
import { getDb } from "@/db";
import { DEFAULT_COUNTRIES, LOCALES } from "./options";

const localizedText = z.object({ uz: z.string().max(5000), en: z.string().max(5000), ru: z.string().max(5000) });

export const settingsSchema = z.object({
  siteTitle: z.string().trim().min(1).max(80),
  cuesPerParticipant: z.number().int().min(1).max(100),
  responsesPerCue: z.number().int().min(1).max(3),
  enabledLanguages: z.array(z.enum(LOCALES)).min(1),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(250),
  /** Empty string for a language = use the default consent text from messages/*.json. */
  consentText: localizedText,
  /** Who runs the study, shown on the About page. Empty = shown as "not provided yet". */
  studyInstitution: z.string().trim().max(200),
  /** Contact address for participants (email or phone), shown as text. */
  studyContact: z.string().trim().max(200),
  /** Ethics committee / IRB approval reference. */
  ethicsApproval: z.string().trim().max(300),
  /** How long data is kept. Empty for a language = default text from messages/*.json. */
  dataRetention: localizedText,
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  siteTitle: "Ma'naviyat Xaritasi",
  cuesPerParticipant: 18,
  responsesPerCue: 3,
  enabledLanguages: [...LOCALES],
  countries: DEFAULT_COUNTRIES,
  consentText: { uz: "", en: "", ru: "" },
  studyInstitution: "",
  studyContact: "",
  ethicsApproval: "",
  dataRetention: { uz: "", en: "", ru: "" },
};

export async function loadSettings(): Promise<Settings> {
  const { db, t } = getDb();
  const rows = await db.select().from(t.settings);
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    try {
      const key = row.key as keyof Settings;
      const parsed = settingsSchema.shape[key].safeParse(JSON.parse(row.value));
      if (parsed.success) merged[key] = parsed.data;
    } catch {
      // Malformed row: the default stays in place.
    }
  }
  return merged as Settings;
}

/** Per-request cached settings for server components. */
export const getSettings = cache(loadSettings);

export async function saveSettings(values: Partial<Settings>) {
  const { db, t } = getDb();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const json = JSON.stringify(value);
    await db
      .insert(t.settings)
      .values({ key, value: json })
      .onConflictDoUpdate({ target: t.settings.key, set: { value: json } });
  }
}
