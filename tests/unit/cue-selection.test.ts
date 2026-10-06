import { describe, expect, it } from "vitest";
import { mulberry32, selectCues } from "@/lib/cue-selection";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("selectCues", () => {
  it("returns all cues (shuffled) when the list is shorter than N", () => {
    const picked = selectCues([{ id: 1, count: 0 }, { id: 2, count: 5 }], 15, mulberry32(1));
    expect(picked.sort()).toEqual([1, 2]);
  });

  it("returns exactly N distinct cues", () => {
    const cues = range(40).map((id) => ({ id, count: 0 }));
    const picked = selectCues(cues, 15, mulberry32(7));
    expect(picked).toHaveLength(15);
    expect(new Set(picked).size).toBe(15);
  });

  it("strongly prefers the least-answered cues", () => {
    const cues = range(40).map((id) => ({ id, count: id <= 15 ? 0 : 50 }));
    const rng = mulberry32(42);
    let lowPicked = 0;
    const runs = 200;
    for (let r = 0; r < runs; r++) lowPicked += selectCues(cues, 15, rng).filter((id) => id <= 15).length;
    expect(lowPicked / (runs * 15)).toBeGreaterThan(0.97);
  });

  it("balances exposure over many simulated participants", () => {
    const counts = new Map(range(40).map((id) => [id, 0]));
    const rng = mulberry32(3);
    for (let p = 0; p < 400; p++) {
      const picked = selectCues([...counts].map(([id, count]) => ({ id, count })), 15, rng);
      for (const id of picked) counts.set(id, counts.get(id)! + 1);
    }
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(3);
  });

  it("is uniform when counts are equal", () => {
    const cues = range(10).map((id) => ({ id, count: 0 }));
    const hits = new Map<number, number>();
    const rng = mulberry32(11);
    for (let r = 0; r < 5000; r++) for (const id of selectCues(cues, 3, rng)) hits.set(id, (hits.get(id) ?? 0) + 1);
    for (const v of hits.values()) expect(Math.abs(v - 1500)).toBeLessThan(150);
  });
});
