/** Pure aggregation helpers shared by the results page and the admin dashboard. */
import { Q2_OPTIONS, Q3_OPTIONS, Q4_OPTIONS } from "./options";

export interface CountItem {
  key: string;
  count: number;
}

export interface Distribution {
  total: number;
  items: CountItem[];
}

export interface QuestionnaireRow {
  q1Normalized: string | null;
  q2Choices: string[];
  q3: string | null;
  q4: string | null;
}

export interface QuestionnaireStats {
  respondents: number;
  q1Top: CountItem[];
  q2: Distribution;
  q3: Distribution;
  q4: Distribution;
}

function distribution(keys: readonly string[], values: (string | null)[]): Distribution {
  const counts = new Map(keys.map((k) => [k, 0]));
  let total = 0;
  for (const v of values) {
    if (v && counts.has(v)) {
      counts.set(v, counts.get(v)! + 1);
      total++;
    }
  }
  return { total, items: keys.map((k) => ({ key: k, count: counts.get(k)! })) };
}

export function topCounts(values: Iterable<string>, limit: number, minCount = 1): CountItem[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

/**
 * Questionnaire distributions. Q2 counts each choice (multi-select; "other" counted
 * as its own bucket) with total = number of people who answered Q2.
 * `q1MinCount` hides rare free-text answers so nobody can be singled out.
 */
export function aggregateQuestionnaire(rows: QuestionnaireRow[], q1MinCount = 3): QuestionnaireStats {
  const q2Keys = [...Q2_OPTIONS, "other"];
  const q2Counts = new Map(q2Keys.map((k) => [k, 0]));
  let q2Total = 0;
  for (const r of rows) {
    const valid = r.q2Choices.filter((c) => q2Counts.has(c));
    if (valid.length === 0) continue;
    q2Total++;
    for (const c of valid) q2Counts.set(c, q2Counts.get(c)! + 1);
  }
  return {
    respondents: rows.length,
    q1Top: topCounts(
      rows.map((r) => r.q1Normalized).filter((v): v is string => Boolean(v)),
      8,
      q1MinCount,
    ),
    q2: { total: q2Total, items: q2Keys.map((k) => ({ key: k, count: q2Counts.get(k)! })) },
    q3: distribution(Q3_OPTIONS, rows.map((r) => r.q3)),
    q4: distribution(Q4_OPTIONS, rows.map((r) => r.q4)),
  };
}
