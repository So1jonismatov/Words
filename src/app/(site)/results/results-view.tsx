"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { playMoreWords } from "@/actions/participant";
import { BarList, type BarItem } from "@/components/bars";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { WordGraph, type GraphEdge, type GraphNode } from "@/components/word-graph";
import type { ResponseStatus } from "@/lib/repo/game";
import { cn } from "@/lib/utils";

export interface ResultsCue {
  cueId: number;
  display: string;
  status: ResponseStatus | null;
  othersTotal: number;
  total: number;
  /** Enough people answered this cue to show comparisons. */
  enough: boolean;
  answers: { slot: number; raw: string; latin: string | null; unique: boolean; share: number | null }[];
  top: BarItem[];
}

export interface QuestionBlock {
  key: string;
  title: string;
  total: number;
  enough: boolean;
  /** The participant's own choice(s), as labels. */
  mine: string[];
  items: BarItem[];
}

export interface MapProps {
  minN: number;
  hub: { key: string; label: string; meaning: string; related: string[]; q1: { key: string; label: string; count: number; mine: boolean }[] };
  cues: { key: string; label: string; played: boolean; total: number; meaning: string | null; related: string[] }[];
  links: { cueKey: string; key: string; label: string; count: number; mine: boolean }[];
}

export type MoreState = { kind: "continue" | "more" | "none"; count: number };

type Tab = "answers" | "map" | "survey";

/**
 * Results in a single viewport-height card with three tabs: the participant's answers
 * per cue, an association map (graph) and the questionnaire. Long content scrolls
 * inside the panes, never the page.
 */
export function ResultsView({
  cues,
  blocks,
  q1Top,
  myQ1,
  respondents,
  minN,
  fewPeople,
  map,
  more,
  deleteCode,
}: {
  cues: ResultsCue[];
  blocks: QuestionBlock[];
  q1Top: { key: string; label: string; pct: number; mine: boolean }[];
  myQ1: string | null;
  respondents: number;
  minN: number;
  fewPeople: boolean;
  map: MapProps;
  more: MoreState;
  deleteCode: string;
}) {
  const t = useTranslations("results");
  const tSurvey = useTranslations("survey");
  const [tab, setTab] = useState<Tab>("answers");

  const tabs: { id: Tab; label: string }[] = [
    { id: "answers", label: t("yourAnswers") },
    { id: "map", label: t("map.title") },
    { id: "survey", label: tSurvey("title") },
  ];

  return (
    <Card className="animate-enter flex h-[calc(100dvh-9.25rem)] min-h-112 sm:h-[calc(100dvh-8.25rem)] w-full max-w-5xl flex-col p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-muted sm:text-sm">{fewPeople ? t("firstParticipants") : t("sub")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <PlayMoreButton more={more} />
          <ShareButton />
        </div>
      </header>

      <div role="tablist" aria-label={t("title")} className="scroll-thin mt-3 flex w-fit max-w-full shrink-0 gap-1 overflow-x-auto rounded-full bg-card-3 p-1">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            id={`tab-${x.id}`}
            aria-selected={tab === x.id}
            aria-controls={`panel-${x.id}`}
            onClick={() => setTab(x.id)}
            className={cn(
              "tap h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold whitespace-nowrap transition-colors",
              tab === x.id ? "bg-accent-soft text-fg" : "text-muted hover:text-fg",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === "answers" && <AnswersPanel cues={cues} minN={minN} />}
      {tab === "map" && <MapPanel map={map} />}
      {tab === "survey" && <SurveyPanel blocks={blocks} q1Top={q1Top} myQ1={myQ1} respondents={respondents} minN={minN} />}

      <DeleteCodeBar code={deleteCode} />
    </Card>
  );
}

/* ------------------------------------------------------------------ answers */

function AnswersPanel({ cues, minN }: { cues: ResultsCue[]; minN: number }) {
  const t = useTranslations("results");
  const tGame = useTranslations("game");
  const [selected, setSelected] = useState(0);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cue = cues[selected];

  useEffect(() => {
    chipRefs.current[selected]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected]);

  if (!cue) return null;

  return (
    <div
      role="tabpanel"
      id="panel-answers"
      aria-labelledby="tab-answers"
      className="mt-3 grid min-h-0 flex-1 grid-rows-[auto_auto_1fr] gap-2.5 lg:grid-cols-[13rem_1fr] lg:grid-rows-[auto_1fr] lg:gap-x-5"
    >
      <Legend className="lg:col-span-2" />
      <nav
        aria-label={t("yourAnswers")}
        className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:px-0 lg:pr-1"
      >
        {cues.map((c, i) => (
          <button
            key={c.cueId}
            ref={(el) => {
              chipRefs.current[i] = el;
            }}
            type="button"
            lang="uz"
            aria-current={i === selected ? "true" : undefined}
            onClick={() => setSelected(i)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap transition-colors lg:h-10 lg:rounded-xl lg:text-sm",
              i === selected ? "bg-accent-soft text-fg" : "bg-card-3 text-fg/85 hover:bg-card-2",
            )}
          >
            <StatusDot cue={c} />
            {c.display}
          </button>
        ))}
      </nav>

      <section className="scroll-thin min-h-0 overflow-y-auto rounded-3xl bg-card-3 p-4 sm:p-5" aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <h2 lang="uz" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {cue.display}
          </h2>
          <div className="flex shrink-0 gap-1">
            <IconNav label={tGame("previous")} disabled={selected === 0} onClick={() => setSelected(selected - 1)} dir={-1} />
            <IconNav label={tGame("next")} disabled={selected === cues.length - 1} onClick={() => setSelected(selected + 1)} dir={1} />
          </div>
        </div>

        {cue.status === "unknown" || cue.status === "skipped" ? (
          <p className="mt-1 text-[13px] text-muted">{cue.status === "unknown" ? t("statusUnknown") : t("statusSkipped")}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {cue.answers.map((a) => (
              <li key={a.slot} className="flex items-center gap-1.5 rounded-full bg-card py-1 pr-1 pl-3 text-sm font-semibold">
                <span>
                  {a.raw}
                  {a.latin && (
                    <span lang="uz" className="ml-1.5 font-normal text-muted" title={t("comparedAs", { latin: a.latin })}>
                      → {a.latin}
                    </span>
                  )}
                </span>
                {a.unique || a.share ? (
                  <span
                    title={a.unique ? t("uniqueHint") : undefined}
                    className={cn("rounded-full px-2 py-0.5 text-xs font-bold", a.unique ? "bg-teal-soft text-teal" : "bg-accent-soft text-accent")}
                  >
                    {a.unique ? t("unique") : t("shared", { percent: a.share ?? 0 })}
                  </span>
                ) : (
                  <span className="w-1.5" />
                )}
              </li>
            ))}
          </ul>
        )}

        <Eyebrow className="mt-5 mb-2.5">{t("topAnswers")}</Eyebrow>
        {!cue.enough ? (
          <NotEnough text={t("notEnoughCue", { min: minN, count: cue.total })} value={cue.total} min={minN} />
        ) : cue.top.length === 0 ? (
          <p className="text-sm text-muted">{t("notEnough")}</p>
        ) : (
          <>
            <BarList total={cue.total} highlightLabel={t("you")} items={cue.top} />
            <p className="mt-3 text-xs text-muted">{t("basedOn", { count: cue.total })}</p>
          </>
        )}
      </section>
    </div>
  );
}

function Legend({ className }: { className?: string }) {
  const t = useTranslations("results.legend");
  const items = [
    { cls: "bg-accent", label: t("shared") },
    { cls: "bg-teal", label: t("unique") },
    { cls: "bg-muted", label: t("waiting") },
    { cls: "bg-muted/35", label: t("skipped") },
  ];
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted", className)} aria-label={t("title")}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2 rounded-full", i.cls)} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function StatusDot({ cue }: { cue: ResultsCue }) {
  const answered = cue.status === "answered";
  const unique = cue.answers.some((a) => a.unique);
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full", !answered ? "bg-muted/35" : !cue.enough ? "bg-muted" : unique ? "bg-teal" : "bg-accent")}
    />
  );
}

/** "Not enough data yet", with a small progress bar towards the threshold. */
function NotEnough({ text, value, min }: { text: string; value: number; min: number }) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3">
      <p className="text-[13px] leading-relaxed text-muted">{text}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card-2" aria-hidden>
        <div className="h-full rounded-full bg-muted/60" style={{ width: `${Math.min(100, (value / min) * 100)}%` }} />
      </div>
    </div>
  );
}

function IconNav({ label, disabled, onClick, dir }: { label: string; disabled: boolean; onClick: () => void; dir: -1 | 1 }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="tap flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-fg/8 hover:text-fg disabled:opacity-30"
    >
      <svg viewBox="0 0 20 20" className={cn("size-4", dir === 1 && "rotate-180")} fill="currentColor" aria-hidden>
        <path d="M12.7 4.3a1 1 0 0 1 0 1.4L8.4 10l4.3 4.3a1 1 0 1 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z" />
      </svg>
    </button>
  );
}

/* ---------------------------------------------------------------------- map */

const HUB = "hub";
const cueId = (key: string) => `c:${key}`;

function MapPanel({ map }: { map: MapProps }) {
  const t = useTranslations("results.map");
  const tr = useTranslations("results");
  const anyPlayed = map.cues.some((c) => c.played);
  const [scope, setScope] = useState<"mine" | "all">(anyPlayed ? "mine" : "all");
  const [selected, setSelected] = useState<string | null>(HUB);

  const cueByKey = useMemo(() => new Map(map.cues.map((c) => [c.key, c])), [map.cues]);

  const { nodes, edges } = useMemo(() => {
    const scopeCues = scope === "mine" ? map.cues.filter((c) => c.played) : map.cues;
    const inScope = new Set(scopeCues.map((c) => c.key));
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const seenPair = new Set<string>();
    /** True the first time a pair of nodes is linked (one edge per pair). */
    const pair = (a: string, b: string) => {
      const k = [a, b].sort().join("|");
      if (seenPair.has(k)) return false;
      seenPair.add(k);
      return true;
    };
    const nodeFor = (key: string) => (inScope.has(key) ? cueId(key) : key === map.hub.key ? HUB : `w:${key}`);

    nodes.set(HUB, { id: HUB, label: map.hub.label, kind: "hub", weight: 1 });
    for (const c of scopeCues) {
      nodes.set(cueId(c.key), { id: cueId(c.key), label: c.label, kind: "cue", weight: Math.max(1, c.total), highlight: c.played });
      // Every cue is a facet of the concept: a weak link keeps the map centred on it.
      if (pair(HUB, cueId(c.key))) edges.push({ source: HUB, target: cueId(c.key), kind: "related", weight: 1 });
    }
    for (const l of map.links) {
      if (!inScope.has(l.cueKey) || l.key === l.cueKey) continue;
      const id = nodeFor(l.key);
      const prev = nodes.get(id);
      if (!prev) nodes.set(id, { id, label: l.label, kind: "answer", weight: Math.max(1, l.count), highlight: l.mine });
      else if (prev.kind === "answer") nodes.set(id, { ...prev, weight: prev.weight + Math.max(1, l.count), highlight: prev.highlight || l.mine });
      if (pair(cueId(l.cueKey), id)) edges.push({ source: cueId(l.cueKey), target: id, kind: "answer", weight: Math.max(1, l.count), highlight: l.mine });
    }
    // Dictionary relations between words on the map.
    for (const c of scopeCues) {
      for (const r of c.related) {
        if (r === c.key || !inScope.has(r)) continue;
        if (pair(cueId(c.key), cueId(r))) edges.push({ source: cueId(c.key), target: cueId(r), kind: "related", weight: 1 });
      }
    }
    // First words people associate with the concept itself (Q1).
    for (const w of map.hub.q1) {
      const id = nodeFor(w.key);
      if (!nodes.has(id)) nodes.set(id, { id, label: w.label, kind: "answer", weight: w.count, highlight: w.mine });
      if (pair(HUB, id)) edges.push({ source: HUB, target: id, kind: "q1", weight: w.count, highlight: w.mine });
    }
    return { nodes: [...nodes.values()], edges };
  }, [map, scope]);

  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const sel = selected && nodeIds.has(selected) ? selected : null;
  const findable = useMemo(
    () => nodes.filter((n) => n.kind !== "answer").sort((a, b) => (a.kind === "hub" ? -1 : b.kind === "hub" ? 1 : a.label.localeCompare(b.label))),
    [nodes],
  );

  return (
    <div role="tabpanel" id="panel-map" aria-labelledby="tab-map" className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5 lg:flex-row">
      <div className="flex min-h-56 flex-[2] flex-col gap-2 lg:min-h-0 lg:flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-card-3 p-1" role="group" aria-label={t("scope")}>
            {(["mine", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                onClick={() => setScope(s)}
                className={cn(
                  "tap h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                  scope === s ? "bg-accent-soft text-fg" : "text-muted hover:text-fg",
                )}
              >
                {s === "mine" ? t("scopeMine") : t("scopeAll")}
              </button>
            ))}
          </div>
          {/* Phones tap words on the map; the picker would take the graph's height. */}
          <label htmlFor="map-find" className="sr-only">
            {t("find")}
          </label>
          <select
            id="map-find"
            value={sel && !sel.startsWith("w:") ? sel : ""}
            onChange={(e) => setSelected(e.target.value || null)}
            className="hidden h-10 min-w-0 flex-1 basis-36 cursor-pointer rounded-t-xl sm:block rounded-b-md bg-card-3 px-3 text-base outline-none focus-visible:shadow-[inset_0_-2px_0_var(--accent)] sm:max-w-56"
          >
            <option value="">{t("find")}</option>
            {findable.map((n) => (
              <option key={n.id} value={n.id} lang="uz">
                {n.label}
              </option>
            ))}
          </select>
        </div>
        <WordGraph
          nodes={nodes}
          edges={edges}
          selected={sel}
          onSelect={setSelected}
          className="flex-1"
          labels={{ zoomIn: t("zoomIn"), zoomOut: t("zoomOut"), fit: t("fit"), graph: t("graph") }}
        />
        <MapLegend />
      </div>

      <aside className="scroll-thin min-h-24 flex-1 overflow-y-auto rounded-3xl bg-card-3 p-4 lg:min-h-0 lg:w-80 lg:flex-none" aria-live="polite">
        <NodeDetails id={sel} map={map} cueByKey={cueByKey} nodeIds={nodeIds} onSelect={setSelected} tr={tr} />
      </aside>
    </div>
  );
}

function MapLegend() {
  const t = useTranslations("results.map.legend");
  const dot = "size-2.5 rounded-full";
  return (
    <ul className="hidden flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted sm:flex">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className={cn(dot, "bg-accent")} />
        {t("played")}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className={cn(dot, "bg-[color-mix(in_oklab,var(--accent)_45%,var(--card-3))]")} />
        {t("cue")}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className={cn(dot, "bg-teal")} />
        {t("answer")}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className={cn(dot, "bg-accent-soft shadow-[inset_0_0_0_2px_var(--accent)]")} />
        {t("mine")}
      </li>
      <li className="flex items-center gap-1.5">
        <svg aria-hidden viewBox="0 0 16 4" className="h-1 w-4">
          <path d="M0 2h16" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
        {t("related")}
      </li>
    </ul>
  );
}

function Chip({ label, onClick, mine, count }: { label: string; onClick?: () => void; mine?: boolean; count?: string }) {
  const cls = cn(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px]",
    mine ? "bg-accent-soft font-bold text-fg" : "bg-card text-fg/90",
    onClick && "tap cursor-pointer hover:bg-card-2",
  );
  const body = (
    <>
      <span lang="uz">{label}</span>
      {count && <span className="text-xs text-muted tabular-nums">{count}</span>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <span className={cls}>{body}</span>
  );
}

function NodeDetails({
  id,
  map,
  cueByKey,
  nodeIds,
  onSelect,
  tr,
}: {
  id: string | null;
  map: MapProps;
  cueByKey: Map<string, MapProps["cues"][number]>;
  nodeIds: Set<string>;
  onSelect: (id: string) => void;
  tr: ReturnType<typeof useTranslations<"results">>;
}) {
  const t = useTranslations("results.map");
  const go = (key: string) => {
    const target = nodeIds.has(cueId(key)) ? cueId(key) : key === map.hub.key ? HUB : nodeIds.has(`w:${key}`) ? `w:${key}` : null;
    return target ? () => onSelect(target) : undefined;
  };
  const people = (n: number) => (n > 0 ? t("people", { count: n }) : undefined);

  if (!id) return <p className="text-sm text-muted">{t("pick")}</p>;

  if (id === HUB) {
    return (
      <div className="space-y-4">
        <Heading label={map.hub.label} kind={t("concept")} />
        <Meaning text={map.hub.meaning} />
        <Related words={map.hub.related} cueByKey={cueByKey} go={go} title={t("related")} />
        <section>
          <Eyebrow className="mb-2">{t("q1")}</Eyebrow>
          {map.hub.q1.length === 0 ? (
            <p className="text-[13px] text-muted">{tr("notEnough")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {map.hub.q1.map((w) => (
                <Chip key={w.key} label={w.label} mine={w.mine} count={String(w.count)} onClick={go(w.key)} />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  const key = id.slice(2);
  const cue = id.startsWith("c:") ? cueByKey.get(key) : undefined;
  const asAnswer = map.links.filter((l) => l.key === key);
  const label = cue?.label ?? asAnswer[0]?.label ?? map.hub.q1.find((w) => w.key === key)?.label ?? key;
  const meaning = cueByKey.get(key)?.meaning ?? null;

  return (
    <div className="space-y-4">
      <Heading label={label} kind={cue ? (cue.played ? t("kindPlayed") : t("kindCue")) : t("kindAnswer")} />
      {meaning ? <Meaning text={meaning} /> : cue ? <p className="text-[13px] text-muted">{t("noMeaning")}</p> : null}
      {cue && <Related words={cue.related} cueByKey={cueByKey} go={go} title={t("related")} />}

      {cue && (
        <section>
          <Eyebrow className="mb-2">{t("answers")}</Eyebrow>
          {cue.total < map.minN && <p className="mb-2 text-[13px] leading-relaxed text-muted">{tr("notEnoughCue", { min: map.minN, count: cue.total })}</p>}
          <div className="flex flex-wrap gap-1.5">
            {map.links
              .filter((l) => l.cueKey === key)
              .sort((a, b) => b.count - a.count)
              .map((l) => (
                <Chip key={l.key} label={l.label} mine={l.mine} count={people(l.count)} onClick={go(l.key)} />
              ))}
          </div>
        </section>
      )}

      {asAnswer.length > 0 && (
        <section>
          <Eyebrow className="mb-2">{t("givenFor")}</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {asAnswer
              .sort((a, b) => b.count - a.count)
              .map((l) => (
                <Chip key={l.cueKey} label={cueByKey.get(l.cueKey)?.label ?? l.cueKey} mine={l.mine} count={people(l.count)} onClick={go(l.cueKey)} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Heading({ label, kind }: { label: string; kind: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{kind}</p>
      <h3 lang="uz" className="text-2xl leading-tight font-extrabold tracking-tight">
        {label}
      </h3>
    </div>
  );
}

function Meaning({ text }: { text: string }) {
  const t = useTranslations("results.map");
  return (
    <section>
      <Eyebrow className="mb-1">{t("meaning")}</Eyebrow>
      <p className="text-sm leading-relaxed">{text}</p>
    </section>
  );
}

function Related({
  words,
  cueByKey,
  go,
  title,
}: {
  words: string[];
  cueByKey: Map<string, MapProps["cues"][number]>;
  go: (key: string) => (() => void) | undefined;
  title: string;
}) {
  if (words.length === 0) return null;
  return (
    <section>
      <Eyebrow className="mb-2">{title}</Eyebrow>
      <div className="flex flex-wrap gap-1.5">
        {words.map((w) => (
          <Chip key={w} label={cueByKey.get(w)?.label ?? displayRelated(w)} onClick={go(w)} />
        ))}
      </div>
    </section>
  );
}

/** Related words that aren't cue words are plain canonical text: render oʻ/gʻ/ʼ. */
function displayRelated(text: string) {
  return text.replace(/([oOgG])'/g, "$1ʻ").replace(/'/g, "ʼ");
}

/* ------------------------------------------------------------------- survey */

function SurveyPanel({
  blocks,
  q1Top,
  myQ1,
  respondents,
  minN,
}: {
  blocks: QuestionBlock[];
  q1Top: { key: string; label: string; pct: number; mine: boolean }[];
  myQ1: string | null;
  respondents: number;
  minN: number;
}) {
  const t = useTranslations("results");
  return (
    <div role="tabpanel" id="panel-survey" aria-labelledby="tab-survey" className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
      <p className="mb-3 text-[13px] text-muted">{t("basedOn", { count: respondents })}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-3xl bg-card-3 p-4">
          <h2 className="mb-2.5 text-sm font-bold">{t("q1Top")}</h2>
          {myQ1 && <p className="mb-2 text-[13px] text-muted">{t("yourChoice", { answer: myQ1 })}</p>}
          {respondents < minN ? (
            <NotEnough text={t("notEnoughQuestion", { min: minN, count: respondents })} value={respondents} min={minN} />
          ) : q1Top.length === 0 ? (
            <p className="text-[13px] text-muted">{t("notEnough")}</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {q1Top.map((w) => (
                <li key={w.key} lang="uz" className={cn("rounded-full px-3 py-1 text-[13px]", w.mine ? "bg-accent-soft font-bold text-accent" : "bg-card text-fg/85")}>
                  {w.label}
                  <span className="ml-1.5 text-muted tabular-nums">{w.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        {blocks.map((b) => (
          <section key={b.key} className={cn("rounded-3xl bg-card-3 p-4", b.key === "q2" && b.enough && "md:row-span-2")}>
            <h2 className="mb-2.5 text-sm font-bold">{b.title}</h2>
            {b.enough ? (
              <BarList total={b.total} highlightLabel={t("you")} items={b.items} />
            ) : (
              <>
                {b.mine.length > 0 && <p className="mb-2 text-[13px] text-muted">{t("yourChoice", { answer: b.mine.join(", ") })}</p>}
                <NotEnough text={t("notEnoughQuestion", { min: minN, count: b.total })} value={b.total} min={minN} />
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ actions */

function PlayMoreButton({ more }: { more: MoreState }) {
  const t = useTranslations("results");
  const tRoot = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (more.kind === "none") return null;
  return (
    <>
      <Button
        size="sm"
        disabled={pending}
        title={error ?? undefined}
        onClick={() =>
          startTransition(async () => {
            const res = await playMoreWords();
            if (res.ok) router.push("/game");
            else setError(tRoot(res.error));
          })
        }
      >
        {more.kind === "continue" ? t("continueMore", { count: more.count }) : t("playMore", { count: more.count })}
      </Button>
      {error && (
        <p role="alert" className="w-full text-xs text-danger">
          {error}
        </p>
      )}
    </>
  );
}

/** Shares the site's home page only (it has a proper link preview), never personal results. */
function ShareButton() {
  const t = useTranslations("results");
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.origin + "/";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title: document.title, text: t("shareText") });
        return;
      } catch {
        // Cancelled or unsupported: fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <Button variant="secondary" size="sm" onClick={share} aria-live="polite" title={t("shareText")}>
      <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor" aria-hidden>
        <path d="M13 3a3 3 0 1 1-2.8 4.1L7.9 8.4a3 3 0 0 1 0 3.2l2.3 1.3A3 3 0 1 1 9.7 14l-2.4-1.3a3 3 0 1 1 0-5.4L9.7 6A3 3 0 0 1 13 3Z" />
      </svg>
      {copied ? t("copied") : t("share")}
    </Button>
  );
}

/** The participant's delete code: lets them delete their answers later from any device. */
function DeleteCodeBar({ code }: { code: string }) {
  const t = useTranslations("results");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The code is visible and selectable.
    }
  };
  return (
    <div className="mt-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-card-3 px-4 py-2 text-[13px]">
      <span className="text-muted">{t("deleteCode")}</span>
      <code className="font-mono text-sm font-bold tracking-wider select-all" data-testid="delete-code">
        {code}
      </code>
      <button type="button" onClick={copy} className="tap text-[13px] font-semibold text-accent hover:underline" aria-live="polite">
        {copied ? t("copied") : t("copyCode")}
      </button>
      <span className="hidden flex-1 text-xs text-muted md:block">{t("deleteCodeHint")}</span>
      <Link href="/about#delete" className="tap text-xs text-muted hover:text-fg">
        {t("deleteHow")}
      </Link>
    </div>
  );
}
