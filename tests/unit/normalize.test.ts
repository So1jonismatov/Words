import { describe, expect, it } from "vitest";
import { canonicalizeApostrophes, cyrillicToLatin, displayUz, normalizeAnswer, normalizeCueText, typographyUz } from "@/lib/normalize";

describe("canonicalizeApostrophes", () => {
  it("unifies every apostrophe look-alike", () => {
    for (const a of ["'", "’", "‘", "ʻ", "ʼ", "`", "´"]) {
      expect(canonicalizeApostrophes(`o${a}zbek`)).toBe("o'zbek");
    }
  });
});

describe("normalizeAnswer", () => {
  it("trims, lowercases and collapses spaces", () => {
    expect(normalizeAnswer("   Ona    Vatan  ")).toBe("ona vatan");
  });

  it("keeps Uzbek o', g' and tutuq apostrophes", () => {
    expect(normalizeAnswer("O‘zbekiston")).toBe("o'zbekiston");
    expect(normalizeAnswer("Bag`rikenglik")).toBe("bag'rikenglik");
    expect(normalizeAnswer("MA’RIFAT")).toBe("ma'rifat");
  });

  it("keeps digraphs sh and ch untouched", () => {
    expect(normalizeAnswer("Shodlik, Chiroy!")).toBe("shodlik chiroy");
  });

  it("strips punctuation but keeps internal hyphens", () => {
    expect(normalizeAnswer("ota-ona!!!")).toBe("ota-ona");
    expect(normalizeAnswer("-sabr-")).toBe("sabr");
    expect(normalizeAnswer("«vijdon»...")).toBe("vijdon");
    expect(normalizeAnswer("'iymon'")).toBe("iymon");
  });

  it("transliterates Uzbek Cyrillic to Latin", () => {
    expect(normalizeAnswer("Ўзбекистон")).toBe("o'zbekiston");
    expect(normalizeAnswer("ғурур")).toBe("g'urur");
    expect(normalizeAnswer("Қалб")).toBe("qalb");
    expect(normalizeAnswer("маърифат")).toBe("ma'rifat");
    expect(normalizeAnswer("ҳаёт")).toBe("hayot");
    expect(normalizeAnswer("шахс чирой")).toBe("shaxs chiroy");
  });

  it("handles Cyrillic е as ye at word start and after vowels", () => {
    expect(cyrillicToLatin("ер")).toBe("yer");
    expect(cyrillicToLatin("оила ер")).toBe("oila yer");
    expect(cyrillicToLatin("келди")).toBe("keldi");
  });

  it("keeps emoji", () => {
    expect(normalizeAnswer(" 🙏 ")).toBe("🙏");
  });
});

describe("normalizeCueText", () => {
  it("canonicalizes cue words", () => {
    expect(normalizeCueText("  Milliy  G‘urur ")).toBe("milliy g'urur");
    expect(normalizeCueText("e’tiqod")).toBe("e'tiqod");
  });
});

describe("typographyUz", () => {
  it("applies the site's Uzbek apostrophe convention to free text", () => {
    expect(typographyUz("o'zbek g‘alaba ma'naviyat e’lon")).toBe("oʻzbek gʻalaba maʼnaviyat eʼlon");
    // Quotes around words are left alone.
    expect(typographyUz("“Ma'naviyat”ni")).toBe("“Maʼnaviyat”ni");
  });

  it("matches displayUz for canonical cue text", () => {
    for (const w of ["to'g'riso'zlik", "milliy g'urur", "e'tiqod"]) expect(typographyUz(w)).toBe(displayUz(w));
  });
});

describe("Cyrillic answers compare in Latin", () => {
  it("normalizes Cyrillic and Latin spellings to the same key", () => {
    expect(normalizeAnswer("олий")).toBe(normalizeAnswer("Oliy"));
    expect(normalizeAnswer("Ўзбекистон")).toBe("o'zbekiston");
  });
});
