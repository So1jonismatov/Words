import { describe, expect, it } from "vitest";
import { deleteCodeFor, hashDeleteCode, normalizeDeleteCode } from "@/lib/delete-code";

describe("delete codes", () => {
  it("are stable per token, formatted XXXX-XXXX-XXXX, without look-alike characters", () => {
    const code = deleteCodeFor("token-a");
    expect(code).toBe(deleteCodeFor("token-a"));
    expect(code).not.toBe(deleteCodeFor("token-b"));
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
  });

  it("accept any casing and separators, and reject everything else", () => {
    const code = deleteCodeFor("token-a");
    const typed = ` ${code.toLowerCase().replace(/-/g, " ")} `;
    expect(normalizeDeleteCode(typed)).toBe(code.replace(/-/g, ""));
    expect(hashDeleteCode(normalizeDeleteCode(typed)!)).toBe(hashDeleteCode(code));
    expect(normalizeDeleteCode("ABCD-EFGH")).toBeNull();
    expect(normalizeDeleteCode("ABCD-EFGH-IJK0")).toBeNull(); // I and 0 never appear
  });
});
