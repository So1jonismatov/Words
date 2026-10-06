/**
 * Pure aggregation for the admin chart builder. Two kinds of observations:
 *   - people (one row per participant, with demographics and questionnaire answers)
 *   - cue observations (one row per participant × cue they finished)
 * A chart groups observations by an X dimension and an optional series dimension and
 * computes one metric per cell. Every cell carries n = distinct participants in it; cells
 * (and whole X groups) with n < K_ANON are suppressed so nobody can be singled out.
 */
import {
  ADULT_AGE_GROUPS,
  BACKGROUNDS,
  EDUCATION,
  GENDERS,
  K_ANON,
  LOCALES,
  Q2_OPTIONS,
  Q3_OPTIONS,
  Q4_OPTIONS,
  UZ_REGIONS,
} from "./options";

export const CHART_DIMENSIONS = [
  "ageGroup", "gender", "country", "region", "education", "background", "link", "uiLang",
  "q2", "q3", "q4", "cue", "day", "week",
] as const;
export type ChartDimension = (typeof CHART_DIMENSIONS)[number];

export const CHART_METRICS = [
  "participants", "share", "completionRate", "answersPerCue", "unknownRate", "skipRate", "latency",
  "answerShare", "distinctAnswers",
] as const;
export type ChartMetric = (typeof CHART_METRICS)[number];

export const CHART_TYPES = ["bar", "stacked", "stacked100", "line", "pie", "heatmap"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

/** Metrics computed from cue observations (the rest are computed from people). */
export const RESPONSE_METRICS: ReadonlySet<ChartMetric> = new Set([
  "answersPerCue", "unknownRate", "skipRate", "latency", "answerShare", "distinctAnswers",
]);

export type ChartUnit = "count" | "percent" | "number" | "seconds";

export const METRIC_UNIT: Record<ChartMetric, ChartUnit> = {
  participants: "count",
  share: "percent",
  completionRate: "percent",
  answersPerCue: "number",
  unknownRate: "percent",
  skipRate: "percent",
  latency: "seconds",
  answerShare: "percent",
  distinctAnswers: "count",
};

export interface ChartPerson {
  id: string;
  ageGroup: string;
  gender: string | null;
  country: string;
  region: string | null;
  education: string | null;
  background: string | null;
  link: string | null;
  uiLang: string;
  consentAt: number;
  completed: boolean;
  q2: string[];
  q3: string | null;
  q4: string | null;
}

export interface ChartCueObs {
  participantId: string;
  cueId: number;
  /** "answered" if any answer was given, else the slot-1 status (unknown / skipped / no_more). */
  status: string;
  answered: number;
  /** Time to first keystroke of the first answer, ms. */
  latencyMs: number | null;
  answers: string[];
}

export interface ChartSpec {
  x: ChartDimension;
  series: ChartDimension | "none";
  metric: ChartMetric;
  /** Normalized word for "answerShare". */
  word?: string;
}

export interface ChartCell {
  x: string;
  s: string;
  /** null = suppressed (n < K_ANON) or no data. */
  value: number | null;
  n: number;
}

export interface ChartResult {
  x: string[];
  series: string[];
  cells: ChartCell[];
  unit: ChartUnit;
  /** Participants in the filtered data set. */
  totalN: number;
  /** Categories dropped because there were too many (long-tail countries, cues, days). */
  truncated: number;
  error?: "cueNeedsResponses" | "needWord" | "tooFew";
}

/** Category for "no answer" (optional questions left empty). */
export const NA = "na";
const ALL = "all";
const MAX_CATEGORIES = 30;
const MAX_TIME_POINTS = 120;

const ENUM_ORDER: Partial<Record<ChartDimension, readonly string[]>> = {
  ageGroup: ADULT_AGE_GROUPS,
  gender: GENDERS,
  education: EDUCATION,
  background: BACKGROUNDS,
  region: UZ_REGIONS,
  uiLang: LOCALES,
  q2: [...Q2_OPTIONS, "other"],
  q3: Q3_OPTIONS,
  q4: Q4_OPTIONS,
};

const DAY = 86_400_000;

export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Monday of the (UTC) week containing `ms`. */
export function weekKey(ms: number): string {
  const d = new Date(ms);
  const offset = (d.getUTCDay() + 6) % 7;
  return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - offset * DAY);
}

function personValues(p: ChartPerson, dim: ChartDimension): string[] {
  switch (dim) {
    case "q2":
      return p.q2.length ? p.q2 : [NA];
    case "day":
      return [dayKey(p.consentAt)];
    case "week":
      return [weekKey(p.consentAt)];
    case "link":
      return [p.link ?? NA];
    case "cue":
      return [];
    default:
      return [(p[dim] as string | null) ?? NA];
  }
}

/** Fills gaps in a sorted list of day/week keys so a line chart has an even time axis. */
function continuousTime(keys: string[], dim: "day" | "week"): string[] {
  if (keys.length < 2) return keys;
  const step = dim === "day" ? DAY : 7 * DAY;
  const start = Date.parse(`${keys[0]}T00:00:00Z`);
  const end = Date.parse(`${keys[keys.length - 1]}T00:00:00Z`);
  const out: string[] = [];
  for (let t = start; t <= end && out.length < MAX_TIME_POINTS * 4; t += step) out.push(dayKey(t));
  return out;
}

function orderKeys(dim: ChartDimension, sizes: Map<string, number>, cueOrder: number[]): { keys: string[]; truncated: number } {
  const present = [...sizes.keys()];
  const naLast = (keys: string[]) => [...keys.filter((k) => k !== NA), ...(keys.includes(NA) ? [NA] : [])];
  if (dim === "day" || dim === "week") {
    const sorted = continuousTime(present.filter((k) => k !== NA).sort(), dim);
    const keys = sorted.slice(-MAX_TIME_POINTS);
    return { keys, truncated: sorted.length - keys.length };
  }
  const order = ENUM_ORDER[dim];
  if (order) return { keys: naLast([...order.filter((k) => sizes.has(k)), ...present.filter((k) => !order.includes(k)).sort()]), truncated: 0 };
  let keys: string[];
  if (dim === "cue") {
    const rank = new Map(cueOrder.map((id, i) => [String(id), i]));
    keys = present.sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
  } else {
    keys = naLast(present.sort((a, b) => (sizes.get(b) ?? 0) - (sizes.get(a) ?? 0) || a.localeCompare(b)));
  }
  if (keys.length <= MAX_CATEGORIES) return { keys, truncated: 0 };
  // Keep the largest groups.
  const keep = new Set([...keys].sort((a, b) => (sizes.get(b) ?? 0) - (sizes.get(a) ?? 0)).slice(0, MAX_CATEGORIES));
  return { keys: keys.filter((k) => keep.has(k)), truncated: keys.length - keep.size };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function buildChart(
  people: ChartPerson[],
  obs: ChartCueObs[],
  spec: ChartSpec,
  opts: { cueOrder?: number[]; k?: number } = {},
): ChartResult {
  const k = opts.k ?? K_ANON;
  const unit = METRIC_UNIT[spec.metric];
  const empty: ChartResult = { x: [], series: [], cells: [], unit, totalN: people.length, truncated: 0 };
  const responseMetric = RESPONSE_METRICS.has(spec.metric);
  const usesCue = spec.x === "cue" || spec.series === "cue";
  if (usesCue && !responseMetric) return { ...empty, error: "cueNeedsResponses" };
  if (spec.metric === "answerShare" && !spec.word?.trim()) return { ...empty, error: "needWord" };
  if (people.length < k) return { ...empty, error: "tooFew" };

  const byId = new Map(people.map((p) => [p.id, p]));
  const valuesOf = (dim: ChartDimension | "none", p: ChartPerson, o?: ChartCueObs): string[] =>
    dim === "none" ? [ALL] : dim === "cue" ? (o ? [String(o.cueId)] : []) : personValues(p, dim);

  // Group observation units into cells: (x, s) -> units.
  type Unit = { person: ChartPerson; obs?: ChartCueObs };
  const units: Unit[] = responseMetric
    ? obs.flatMap((o) => {
        const person = byId.get(o.participantId);
        return person ? [{ person, obs: o }] : [];
      })
    : people.map((person) => ({ person }));

  const cells = new Map<string, Unit[]>();
  const xPeople = new Map<string, Set<string>>();
  const sPeople = new Map<string, Set<string>>();
  for (const u of units) {
    for (const x of valuesOf(spec.x, u.person, u.obs)) {
      if (!xPeople.has(x)) xPeople.set(x, new Set());
      xPeople.get(x)!.add(u.person.id);
      for (const s of valuesOf(spec.series, u.person, u.obs)) {
        if (!sPeople.has(s)) sPeople.set(s, new Set());
        sPeople.get(s)!.add(u.person.id);
        const key = `${x}\u0000${s}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key)!.push(u);
      }
    }
  }

  const sizes = (m: Map<string, Set<string>>) => new Map([...m].map(([key, set]) => [key, set.size]));
  const xs = orderKeys(spec.x, sizes(xPeople), opts.cueOrder ?? []);
  const ss = spec.series === "none" ? { keys: [ALL], truncated: 0 } : orderKeys(spec.series, sizes(sPeople), opts.cueOrder ?? []);
  const word = spec.word?.trim().toLowerCase();

  const value = (list: Unit[], xKey: string): number | null => {
    const o = list.map((u) => u.obs!).filter(Boolean);
    switch (spec.metric) {
      case "participants":
        return new Set(list.map((u) => u.person.id)).size;
      case "share": {
        const denom = spec.series === "none" ? people.length : (xPeople.get(xKey)?.size ?? 0);
        return denom ? round1((100 * new Set(list.map((u) => u.person.id)).size) / denom) : null;
      }
      case "completionRate": {
        const ids = new Set(list.map((u) => u.person.id));
        const done = [...ids].filter((id) => byId.get(id)!.completed).length;
        return ids.size ? round1((100 * done) / ids.size) : null;
      }
      case "answersPerCue":
        return o.length ? Math.round((100 * o.reduce((a, b) => a + b.answered, 0)) / o.length) / 100 : null;
      case "unknownRate":
        return o.length ? round1((100 * o.filter((x) => x.status === "unknown").length) / o.length) : null;
      case "skipRate":
        return o.length ? round1((100 * o.filter((x) => x.status === "skipped").length) / o.length) : null;
      case "latency": {
        const m = median(o.map((x) => x.latencyMs).filter((v): v is number => v != null));
        return m == null ? null : round1(m / 1000);
      }
      case "answerShare":
        return o.length ? round1((100 * o.filter((x) => x.answers.includes(word!)).length) / o.length) : null;
      case "distinctAnswers":
        return new Set(o.flatMap((x) => x.answers)).size;
    }
  };

  const out: ChartCell[] = [];
  for (const x of xs.keys) {
    const xHidden = (xPeople.get(x)?.size ?? 0) < k;
    for (const s of ss.keys) {
      const list = cells.get(`${x}\u0000${s}`) ?? [];
      const n = new Set(list.map((u) => u.person.id)).size;
      // Empty cells are real zeros for counts; anything with 1..k-1 people is hidden.
      const hidden = xHidden || (n > 0 && n < k);
      const v = hidden ? null : n === 0 ? (unit === "count" || spec.metric === "share" ? 0 : null) : value(list, x);
      out.push({ x, s, value: v, n: hidden ? 0 : n });
    }
  }

  return { x: xs.keys, series: ss.keys, cells: out, unit, totalN: people.length, truncated: xs.truncated + ss.truncated };
}
