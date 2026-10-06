import { describe, expect, it } from "vitest";
import uz from "../../messages/uz.json";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import { AGE_GROUPS, BACKGROUNDS, EDUCATION, GENDERS, Q2_OPTIONS, Q3_OPTIONS, Q4_OPTIONS, UZ_REGIONS } from "@/lib/options";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("messages", () => {
  const uzKeys = keys(uz).sort();

  it.each([
    ["en", en],
    ["ru", ru],
  ])("%s has exactly the same keys as uz", (_, messages) => {
    expect(keys(messages).sort()).toEqual(uzKeys);
  });

  it("has a label for every configured option", () => {
    const required = [
      ...AGE_GROUPS.map((k) => `options.ageGroup.${k}`),
      ...GENDERS.map((k) => `options.gender.${k}`),
      ...EDUCATION.map((k) => `options.education.${k}`),
      ...BACKGROUNDS.map((k) => `options.background.${k}`),
      ...UZ_REGIONS.map((k) => `options.region.${k}`),
      ...[...Q2_OPTIONS, "other"].map((k) => `options.q2.${k}`),
      ...Q3_OPTIONS.map((k) => `options.q3.${k}`),
      ...Q4_OPTIONS.map((k) => `options.q4.${k}`),
    ];
    for (const k of required) expect(uzKeys).toContain(k);
  });

  it("has no empty strings", () => {
    for (const messages of [uz, en, ru]) {
      const flat = JSON.stringify(messages);
      expect(flat).not.toMatch(/:""/);
    }
  });
});
