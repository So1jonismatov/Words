import { describe, expect, it } from "vitest";
import { buildChart, dayKey, weekKey, type ChartCueObs, type ChartPerson } from "@/lib/charts";

const person = (i: number, over: Partial<ChartPerson> = {}): ChartPerson => ({
  id: `p${i}`,
  ageGroup: i % 2 ? "18-24" : "25-34",
  gender: i % 3 === 0 ? "female" : "male",
  country: "UZ",
  region: null,
  education: null,
  background: null,
  link: null,
  uiLang: "uz",
  consentAt: Date.UTC(2026, 9, 1 + (i % 3)),
  completed: i % 4 !== 0,
  q2: i % 2 ? ["religion", "morality"] : ["morality"],
  q3: "very",
  q4: i % 2 ? "inner" : "social",
  ...over,
});

const people = Array.from({ length: 20 }, (_, i) => person(i));

describe("buildChart", () => {
  it("counts participants per category in option order", () => {
    const r = buildChart(people, [], { x: "ageGroup", series: "none", metric: "participants" });
    expect(r.x).toEqual(["18-24", "25-34"]);
    expect(r.cells.map((c) => c.value)).toEqual([10, 10]);
    expect(r.unit).toBe("count");
  });

  it("computes shares within each X group and multi-valued Q2", () => {
    const r = buildChart(people, [], { x: "ageGroup", series: "q4", metric: "share" });
    const cell = (x: string, s: string) => r.cells.find((c) => c.x === x && c.s === s)!;
    expect(cell("18-24", "inner").value).toBe(100);
    expect(cell("25-34", "social").value).toBe(100);
    expect(cell("18-24", "social").value).toBe(0);

    const q2 = buildChart(people, [], { x: "q2", series: "none", metric: "participants" });
    expect(q2.cells.find((c) => c.x === "morality")?.value).toBe(20);
    expect(q2.cells.find((c) => c.x === "religion")?.value).toBe(10);
  });

  it("hides cells and groups with fewer than k people", () => {
    const few = [...people, person(100, { ageGroup: "50+" }), person(101, { ageGroup: "50+" })];
    const r = buildChart(few, [], { x: "ageGroup", series: "none", metric: "participants" });
    const old = r.cells.find((c) => c.x === "50+")!;
    expect(old.value).toBeNull();
    expect(old.n).toBe(0);
    // Below k overall: nothing at all.
    expect(buildChart(people.slice(0, 3), [], { x: "ageGroup", series: "none", metric: "participants" }).error).toBe("tooFew");
  });

  it("aggregates cue observations for answer measures", () => {
    const obs: ChartCueObs[] = people.flatMap((p, i) => [
      { participantId: p.id, cueId: 1, status: "answered", answered: 2, latencyMs: 1000 + i * 100, answers: ["vijdon", "axloq"] },
      { participantId: p.id, cueId: 2, status: i % 2 ? "unknown" : "answered", answered: i % 2 ? 0 : 1, latencyMs: null, answers: i % 2 ? [] : ["mehr"] },
    ]);
    const unknown = buildChart(people, obs, { x: "cue", series: "none", metric: "unknownRate" }, { cueOrder: [2, 1] });
    expect(unknown.x).toEqual(["2", "1"]);
    expect(unknown.cells.map((c) => c.value)).toEqual([50, 0]);

    const share = buildChart(people, obs, { x: "ageGroup", series: "none", metric: "answerShare", word: "mehr" });
    expect(share.cells.find((c) => c.x === "25-34")?.value).toBe(50); // 10 of 20 observations
    expect(share.cells.find((c) => c.x === "18-24")?.value).toBe(0);

    const per = buildChart(people, obs, { x: "ageGroup", series: "none", metric: "answersPerCue" });
    expect(per.cells.find((c) => c.x === "25-34")?.value).toBe(1.5);

    const latency = buildChart(people, obs, { x: "cue", series: "none", metric: "latency" });
    expect(latency.cells.find((c) => c.x === "1")?.value).toBe(2); // median 1.95 s, one decimal
  });

  it("rejects combinations that make no sense", () => {
    expect(buildChart(people, [], { x: "cue", series: "none", metric: "participants" }).error).toBe("cueNeedsResponses");
    expect(buildChart(people, [], { x: "ageGroup", series: "none", metric: "answerShare" }).error).toBe("needWord");
  });

  it("builds a continuous time axis", () => {
    const r = buildChart(people, [], { x: "day", series: "none", metric: "participants" });
    expect(r.x).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(weekKey(Date.UTC(2026, 9, 7))).toBe("2026-10-05"); // Wednesday → Monday
    expect(dayKey(Date.UTC(2026, 0, 2, 23, 59))).toBe("2026-01-02");
  });
});
