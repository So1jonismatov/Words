/**
 * Text normalization for Uzbek answers and cue words.
 *
 * - All apostrophe look-alikes (' ’ ‘ ʻ ʼ ` ´ …) become one canonical ASCII apostrophe,
 *   so o‘zbek, oʻzbek and o'zbek compare equal.
 * - Cyrillic input is transliterated to Uzbek Latin (normalized column only).
 * - Lowercased, punctuation stripped (apostrophes/hyphens inside words are kept,
 *   so o', g', ma'rifat and ota-ona survive), whitespace collapsed.
 */

export const CANONICAL_APOSTROPHE = "'";

const APOSTROPHE_VARIANTS = /['‘’‛ʻʼʹʿ`´′]/g;

export function canonicalizeApostrophes(s: string): string {
  return s.replace(APOSTROPHE_VARIANTS, CANONICAL_APOSTROPHE);
}

const CYRILLIC = /[Ѐ-ӿ]/;

export function hasCyrillic(s: string): boolean {
  return CYRILLIC.test(s);
}

const CYR_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g'", д: "d", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
  к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ў: "o'", ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "'", ь: "", ы: "i",
  э: "e", ю: "yu", я: "ya", і: "i", ї: "yi", є: "ye", ң: "ng", ү: "u", ұ: "u", ө: "o", ә: "a", һ: "h",
};

const CYR_VOWELS = new Set([..."аеёиоуўэюяыі"]);

/** Uzbek Cyrillic → Uzbek Latin. Expects lowercase input. */
export function cyrillicToLatin(input: string): string {
  const chars = [...input];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === "е") {
      const prev = chars[i - 1];
      const wordStart = prev === undefined || !/\p{L}/u.test(prev);
      out += wordStart || CYR_VOWELS.has(prev) || prev === "ъ" || prev === "ь" ? "ye" : "e";
      continue;
    }
    out += CYR_MAP[ch] ?? ch;
  }
  return out;
}

/**
 * Display form of canonical Uzbek text: o' and g' get the turned comma (oʻ, gʻ),
 * any other apostrophe becomes the tutuq belgisi (ʼ), as in official orthography.
 */
export function displayUz(text: string): string {
  return text.replace(/([oOgG])'/g, "$1ʻ").replace(/'/g, "ʼ");
}

/**
 * Display typography for free Uzbek prose (e.g. admin-entered consent text): any
 * apostrophe after o/g becomes ʻ, any other apostrophe inside a word becomes ʼ.
 * Quote marks around words are left alone.
 */
export function typographyUz(text: string): string {
  return text.replace(/([oOgG])['‘’ʼ`]/g, "$1ʻ").replace(/(\p{L})['’ʼ`](?=\p{L})/gu, "$1ʼ");
}

/** Canonical form for cue words: apostrophes unified, trimmed, single spaces, lowercase. */
export function normalizeCueText(raw: string): string {
  return canonicalizeApostrophes(raw.normalize("NFC")).toLowerCase().replace(/\s+/g, " ").trim();
}

/** Normalized form of a participant's answer (used for counting/comparison). */
export function normalizeAnswer(raw: string): string {
  let s = canonicalizeApostrophes(raw.normalize("NFC")).toLowerCase();
  if (hasCyrillic(s)) s = cyrillicToLatin(s);
  // Strip punctuation except apostrophes and hyphens (handled below). Emoji are symbols, not punctuation, so they survive.
  s = s.replace(/[\p{P}\p{Sk}]/gu, (ch) => (ch === "'" || ch === "-" ? ch : " "));
  // Apostrophe is kept inside a word (ma'rifat, o'zbek) or word-finally after o/g (the letters o', g');
  // quote marks around a word are dropped. Hyphen is kept only between letters/digits.
  s = s.replace(/'+/g, "'").replace(/(?<!\p{L})'|(?<![og])'(?!\p{L})/gu, "");
  s = s.replace(/-+/g, "-").replace(/(^|[^\p{L}\p{N}])-|-(?=[^\p{L}\p{N}]|$)/gu, "$1");
  return s.replace(/\s+/g, " ").trim();
}
