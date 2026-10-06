/**
 * Balanced cue selection.
 *
 * Each participant gets N cues sampled without replacement, weighted so that cues
 * with the fewest responses so far are strongly preferred:
 *   weight = 1 / (1 + count - minCount)^2
 * Sampling uses the Efraimidis–Spirakis method (key = u^(1/weight), take top N).
 * When every cue has the same count this is a uniform random sample. The chosen
 * cues are then shuffled so presentation order carries no information.
 */
export interface CueExposure {
  id: number;
  count: number;
}

export type Rng = () => number;

export function selectCues(cues: CueExposure[], n: number, rng: Rng = Math.random): number[] {
  if (cues.length === 0 || n <= 0) return [];
  if (cues.length <= n) return shuffle(cues.map((c) => c.id), rng);
  const min = Math.min(...cues.map((c) => c.count));
  const keyed = cues.map((c) => {
    const weight = 1 / (1 + (c.count - min)) ** 2;
    const u = Math.max(rng(), Number.MIN_VALUE);
    return { id: c.id, key: Math.log(u) / weight }; // log of u^(1/w); larger is better
  });
  keyed.sort((a, b) => b.key - a.key);
  return shuffle(keyed.slice(0, n).map((k) => k.id), rng);
}

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Small deterministic PRNG for tests and reproducible sampling. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
