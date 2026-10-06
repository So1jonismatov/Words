/** Answer options. Labels live in messages/*.json under the same keys. */

export const LOCALES = ["uz", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";
/** BCP-47 tags for the <html lang> attribute. */
export const HTML_LANG: Record<Locale, string> = { uz: "uz-Latn", en: "en", ru: "ru" };

export const AGE_GROUPS = ["under18", "18-24", "25-34", "35-49", "50+"] as const;
export const ADULT_AGE_GROUPS = ["18-24", "25-34", "35-49", "50+"] as const;
export const GENDERS = ["male", "female", "other", "na"] as const;
export const EDUCATION = ["secondary", "vocational", "bachelor", "master", "doctorate", "na"] as const;
export const BACKGROUNDS = ["religious", "spiritual", "agnostic", "na"] as const;

/** Default country list (ISO 3166-1 alpha-2). Admins can edit it in /admin/settings; "OTHER" is always appended. */
export const DEFAULT_COUNTRIES = ["UZ", "RU", "KZ", "US", "GB", "CA", "AU"];
export const OTHER_COUNTRY = "OTHER";

export const UZ_REGIONS = [
  "tashkent_city", "tashkent", "andijan", "bukhara", "fergana", "jizzakh", "khorezm", "namangan",
  "navoiy", "kashkadarya", "karakalpakstan", "samarkand", "syrdarya", "surkhandarya",
] as const;

export const Q2_OPTIONS = ["religion", "morality", "peace", "nature", "heritage", "soul"] as const;
export const Q2_MAX = 3;
export const Q3_OPTIONS = ["very", "occasionally", "rarely", "never"] as const;
export const Q4_OPTIONS = ["inner", "social", "both", "neither"] as const;

/** Minimum group size before any breakdown is shown (k-anonymity). */
export const K_ANON = 5;

/**
 * Public results show percentages only once at least this many people answered the
 * question or cue; below it they show "not enough data yet" (small samples mislead).
 */
export const RESULTS_MIN_N = 10;

/** The landing page shows participant/response counters only from this many participants. */
export const PUBLIC_COUNTS_MIN = 50;

/** Rough time to finish, shown on the landing page and in the consent text. */
export const ESTIMATED_MINUTES = 5;

export const DEMOGRAPHIC_DIMENSIONS = ["ageGroup", "gender", "country", "background", "education"] as const;
export type DemographicDimension = (typeof DEMOGRAPHIC_DIMENSIONS)[number];
