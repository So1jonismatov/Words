import { describe, expect, it } from "vitest";
import { checkAnswer } from "@/lib/validation";

describe("checkAnswer", () => {
  it("accepts genuine short answers", () => {
    expect(checkAnswer("ruh")).toEqual({ ok: true, normalized: "ruh" });
    expect(checkAnswer("ona")).toMatchObject({ ok: true });
    expect(checkAnswer("uy")).toMatchObject({ ok: true });
    expect(checkAnswer("🙏")).toMatchObject({ ok: true });
    expect(checkAnswer("haha")).toMatchObject({ ok: true });
  });

  it("rejects empty and single letters", () => {
    expect(checkAnswer("   ")).toEqual({ ok: false, reason: "empty" });
    expect(checkAnswer("!!!")).toEqual({ ok: false, reason: "empty" });
    expect(checkAnswer("a")).toEqual({ ok: false, reason: "too_short" });
  });

  it("rejects spammy repeats", () => {
    expect(checkAnswer("aaaa")).toEqual({ ok: false, reason: "spam" });
    expect(checkAnswer("asdasdasdasd")).toEqual({ ok: false, reason: "spam" });
  });

  it("rejects overly long text", () => {
    expect(checkAnswer("x".repeat(61) + "y")).toEqual({ ok: false, reason: "too_long" });
  });

  it("rejects duplicates within the same cue after normalization", () => {
    expect(checkAnswer("O‘zbek", ["o'zbek"])).toEqual({ ok: false, reason: "duplicate" });
  });
});
