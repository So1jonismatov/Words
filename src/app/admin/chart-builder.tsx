"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { arc, line, pie, scaleBand, scaleLinear, scalePoint, stack, curveMonotoneX } from "d3";
import { chartAction, type ChartInput, type LabelledChart } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/fields";
import {
  CHART_DIMENSIONS,
  CHART_METRICS,
  CHART_TYPES,
  RESPONSE_METRICS,
  type ChartDimension,
  type ChartMetric,
  type ChartType,
  type ChartUnit,
} from "@/lib/charts";
import { K_ANON } from "@/lib/options";
import { cn } from "@/lib/utils";

/** Series colours: the theme's primary and tertiary first, then fixed mid-tone hues readable on both themes. */
const PALETTE = ["var(--accent)", "var(--teal)", "#8f6fc0", "#d9734e", "#4f86c6", "#c2577f", "#7a9a3a", "#a1887f", "#3fa7a0", "#b58a1b"];

interface Spec {
  x: ChartDimension;
  series: ChartDimension | "none";
  metric: ChartMetric;
  type: ChartType;
  word: string;
  cueIds: number[];
}

const PRESETS: { id: string; spec: Partial<Spec> }[] = [
  { id: "ageQ4", spec: { x: "ageGroup", series: "q4", metric: "share", type: "stacked100" } },
  // Weekly, not daily: days with fewer than K_ANON people are hidden and would break the line.
  { id: "daily", spec: { x: "week", series: "none", metric: "participants", type: "line" } },
  { id: "cueUnknown", spec: { x: "cue", series: "none", metric: "unknownRate", type: "bar" } },
  { id: "genderQ2", spec: { x: "q2", series: "gender", metric: "share", type: "bar" } },
  { id: "latencyAge", spec: { x: "ageGroup", series: "none", metric: "latency", type: "bar" } },
];

const fmt = (v: number, unit: ChartUnit) => (unit === "percent" ? `${v}%` : unit === "seconds" ? `${v} s` : String(v));

export function ChartBuilder({ filter, cues }: { filter: ChartInput["filter"]; cues: { id: number; label: string }[] }) {
  const t = useTranslations("admin.charts");
  const tRoot = useTranslations();
  const [spec, setSpec] = useState<Spec>({ x: "ageGroup", series: "q4", metric: "share", type: "stacked100", word: "", cueIds: [] });
  const [data, setData] = useState<LabelledChart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showTable, setShowTable] = useState(false);
  const [word, setWord] = useState("");

  // Debounce the free-text answer word.
  useEffect(() => {
    const id = setTimeout(() => setSpec((s) => (s.word === word ? s : { ...s, word })), 400);
    return () => clearTimeout(id);
  }, [word]);

  const filterKey = JSON.stringify(filter);
  useEffect(() => {
    startTransition(async () => {
      const res = await chartAction({ x: spec.x, series: spec.series, metric: spec.metric, word: spec.word || undefined, cueIds: spec.cueIds, filter });
      if (res.ok) {
        setData(res.data ?? null);
        setError(null);
      } else setError(tRoot(res.error));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.x, spec.series, spec.metric, spec.word, spec.cueIds, filterKey]);

  const update = (patch: Partial<Spec>) => setSpec((s) => ({ ...s, ...patch }));
  const responseMetric = RESPONSE_METRICS.has(spec.metric);

  const csv = () => {
    if (!data) return;
    const head = ["x", "series", "value", "n"];
    const rows = data.cells.map((c) => [data.xLabels[c.x], data.seriesLabels[c.s], c.value ?? "", c.n]);
    const text = [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `chart-${spec.x}-${spec.metric}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorText = data?.error ? t(`errors.${data.error}`, { k: K_ANON }) : null;

  return (
    <div className="flex h-full min-h-[24rem] flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <LabeledSelect id="ch-x" label={t("x")} value={spec.x} onChange={(v) => update({ x: v as ChartDimension })}>
          {CHART_DIMENSIONS.map((d) => (
            <option key={d} value={d} disabled={d === "cue" && !responseMetric}>
              {t(`dims.${d}`)}
            </option>
          ))}
        </LabeledSelect>
        <LabeledSelect id="ch-s" label={t("series")} value={spec.series} onChange={(v) => update({ series: v as Spec["series"] })}>
          <option value="none">{t("none")}</option>
          {CHART_DIMENSIONS.filter((d) => d !== spec.x && d !== "day" && d !== "week").map((d) => (
            <option key={d} value={d} disabled={d === "cue" && !responseMetric}>
              {t(`dims.${d}`)}
            </option>
          ))}
        </LabeledSelect>
        <LabeledSelect id="ch-m" label={t("metric")} value={spec.metric} onChange={(v) => update({ metric: v as ChartMetric })}>
          {CHART_METRICS.map((m) => (
            <option key={m} value={m}>
              {t(`metrics.${m}`)}
            </option>
          ))}
        </LabeledSelect>
        <LabeledSelect id="ch-t" label={t("type")} value={spec.type} onChange={(v) => update({ type: v as ChartType })}>
          {CHART_TYPES.map((c) => (
            <option key={c} value={c}>
              {t(`types.${c}`)}
            </option>
          ))}
        </LabeledSelect>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {responseMetric && <CuePicker cues={cues} selected={spec.cueIds} onChange={(cueIds) => update({ cueIds })} />}
        {spec.metric === "answerShare" && (
          <Input
            aria-label={t("word")}
            placeholder={t("wordPlaceholder")}
            value={word}
            onChange={(e) => setWord(e.target.value)}
            wrapperClassName="w-44"
            className="h-9"
            lang="uz"
          />
        )}
        <span className="text-xs font-semibold text-muted">{t("presets")}:</span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => update(p.spec)}
            className="tap h-8 rounded-full bg-card-3 px-3 text-[13px] text-fg/85 transition-colors hover:bg-card-2"
          >
            {t(`preset.${p.id}`)}
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1 rounded-2xl bg-card-3 p-2 sm:p-3">
        {pending && <span className="absolute top-2 right-3 z-10 text-xs text-muted">{t("loading")}</span>}
        {error || errorText ? (
          <p className="p-6 text-center text-sm text-muted">{error ?? errorText}</p>
        ) : !data ? null : data.x.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{t("empty")}</p>
        ) : showTable ? (
          <DataTable data={data} />
        ) : (
          <Chart data={data} type={spec.type} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {data && !data.error && (
          <>
            <span>{t("basedOn", { count: data.totalN })}</span>
            {data.cells.some((c) => c.value === null && c.n === 0) && (
              <span className="flex items-center gap-1.5">
                <svg className="size-3" aria-hidden>
                  <rect width="12" height="12" fill="url(#hatch-legend)" />
                  <defs>
                    <Hatch id="hatch-legend" />
                  </defs>
                </svg>
                {t("suppressed", { k: K_ANON })}
              </span>
            )}
            {data.truncated > 0 && <span>{t("truncated", { count: data.truncated })}</span>}
          </>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="plain" onClick={() => setShowTable(!showTable)} aria-pressed={showTable}>
          {t("table")}
        </Button>
        <Button size="sm" variant="plain" onClick={csv} disabled={!data || Boolean(data.error)}>
          {t("csv")} ↓
        </Button>
      </div>
    </div>
  );
}

function LabeledSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block px-1 text-xs font-semibold text-muted">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </Select>
    </div>
  );
}

function CuePicker({ cues, selected, onChange }: { cues: { id: number; label: string }[]; selected: number[]; onChange: (ids: number[]) => void }) {
  const t = useTranslations("admin.charts");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const set = new Set(selected);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="tap flex h-9 items-center gap-2 rounded-full bg-accent-soft px-3.5 text-[13px] font-semibold"
      >
        {t("words")}: {selected.length ? t("wordsSelected", { count: selected.length }) : t("allWords")}
        <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor" aria-hidden>
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-11 left-0 z-20 w-[min(26rem,85vw)] rounded-2xl bg-card p-2 shadow-xl">
          <div className="mb-1.5 flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onChange([])}>
              {t("allWords")}
            </Button>
          </div>
          <div role="group" aria-label={t("words")} className="scroll-thin flex max-h-56 flex-wrap gap-1 overflow-y-auto">
            {cues.map((c) => {
              const on = set.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  lang="uz"
                  aria-pressed={on}
                  onClick={() => onChange(on ? selected.filter((x) => x !== c.id) : [...selected, c.id])}
                  className={cn("h-8 rounded-full px-2.5 text-[13px]", on ? "bg-accent-soft font-semibold" : "bg-card-3 text-muted hover:text-fg")}
                >
                  {on && "✓ "}
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Hatch({ id }: { id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="var(--card-2)" />
      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" strokeOpacity="0.5" strokeWidth="2" />
    </pattern>
  );
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

interface Tip {
  x: number;
  y: number;
  text: string;
}

/** Renders the chart types with d3 scales/shapes; React owns the DOM. */
function Chart({ data, type }: { data: LabelledChart; type: ChartType }) {
  const t = useTranslations("admin.charts");
  const { ref, w, h } = useSize();
  const [tip, setTip] = useState<Tip | null>(null);
  const multi = data.series.length > 1;
  const color = (s: string) => PALETTE[data.series.indexOf(s) % PALETTE.length];
  const cell = useMemo(() => new Map(data.cells.map((c) => [`${c.x}\u0000${c.s}`, c])), [data]);
  const get = (x: string, s: string) => cell.get(`${x}\u0000${s}`);
  const label = (x: string, s: string) => `${data.xLabels[x]}${multi ? ` · ${data.seriesLabels[s]}` : ""}`;
  const tipText = (x: string, s: string) => {
    const c = get(x, s);
    return c?.value == null ? `${label(x, s)}: ${t("suppressed", { k: K_ANON })}` : `${label(x, s)}: ${fmt(c.value, data.unit)} (${t("n")}=${c.n})`;
  };
  const show = (e: React.PointerEvent, text: string) => {
    const box = ref.current!.getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, text });
  };

  const many = data.x.length > 8;
  // Heatmap rows are labelled on the left: make room for the longest series label.
  const longest = Math.max(...data.series.map((s) => data.seriesLabels[s].length));
  const margin = { top: 12, right: 12, bottom: many ? 78 : 34, left: type === "heatmap" && multi ? Math.min(150, 14 + longest * 6.2) : 46 };
  const iw = Math.max(0, w - margin.left - margin.right);
  const ih = Math.max(0, h - margin.top - margin.bottom - (multi ? 26 : 0));

  let body: React.ReactNode = null;
  let yTicks: number[] = [];
  let y = scaleLinear().range([ih, 0]);
  let xAxis: { key: string; pos: number }[] = [];

  if (w > 0 && h > 0) {
    if (type === "pie") {
      // Donut over the X categories (summed across series).
      const totals = data.x.map((x) => ({ x, v: data.series.reduce((a, s) => a + (get(x, s)?.value ?? 0), 0) }));
      const r = Math.max(10, Math.min(w, h - (multi ? 26 : 0)) / 2 - 16);
      const arcs = pie<{ x: string; v: number }>().value((d) => d.v).sort(null)(totals);
      const gen = arc<(typeof arcs)[number]>().innerRadius(r * 0.55).outerRadius(r).padAngle(0.012).cornerRadius(3);
      body = (
        <g transform={`translate(${w / 2},${(h - (multi ? 26 : 0)) / 2})`}>
          {arcs.map((a, i) => (
            <path
              key={a.data.x}
              d={gen(a) ?? undefined}
              fill={PALETTE[i % PALETTE.length]}
              onPointerMove={(e) => show(e, `${data.xLabels[a.data.x]}: ${fmt(Math.round(a.data.v * 10) / 10, data.unit)}`)}
              onPointerLeave={() => setTip(null)}
            />
          ))}
          {arcs.map((a) => {
            if (a.endAngle - a.startAngle < 0.25) return null;
            const [cx, cy] = gen.centroid(a);
            return (
              <text key={a.data.x} x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={700} fill="#fff" className="pointer-events-none">
                {data.xLabels[a.data.x].slice(0, 14)}
              </text>
            );
          })}
        </g>
      );
    } else if (type === "heatmap") {
      const xs = scaleBand().domain(data.x).range([0, iw]).padding(0.04);
      const ys = scaleBand().domain(data.series).range([0, ih]).padding(0.04);
      const max = Math.max(1e-9, ...data.cells.map((c) => c.value ?? 0));
      xAxis = data.x.map((k) => ({ key: k, pos: (xs(k) ?? 0) + xs.bandwidth() / 2 }));
      body = (
        <g>
          {data.series.map((s) => (
            <text key={s} x={-6} y={(ys(s) ?? 0) + ys.bandwidth() / 2} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--muted)">
              {data.seriesLabels[s].length > 24 ? data.seriesLabels[s].slice(0, 23) + "…" : data.seriesLabels[s]}
            </text>
          ))}
          {data.x.map((x) =>
            data.series.map((s) => {
              const c = get(x, s);
              const v = c?.value;
              return (
                <g key={`${x}|${s}`} onPointerMove={(e) => show(e, tipText(x, s))} onPointerLeave={() => setTip(null)}>
                  <rect
                    x={xs(x)}
                    y={ys(s)}
                    width={xs.bandwidth()}
                    height={ys.bandwidth()}
                    rx={4}
                    fill={v == null ? "url(#hatch)" : `color-mix(in oklab, var(--accent) ${Math.round(8 + 92 * (v / max))}%, var(--card-2))`}
                  />
                  {v != null && xs.bandwidth() > 28 && ys.bandwidth() > 16 && (
                    <text
                      x={(xs(x) ?? 0) + xs.bandwidth() / 2}
                      y={(ys(s) ?? 0) + ys.bandwidth() / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill={v / max > 0.55 ? "var(--accent-fg)" : "var(--fg)"}
                      className="pointer-events-none"
                    >
                      {fmt(v, data.unit)}
                    </text>
                  )}
                </g>
              );
            }),
          )}
        </g>
      );
    } else if (type === "line") {
      const xs = scalePoint().domain(data.x).range([0, iw]).padding(0.3);
      const max = Math.max(1e-9, ...data.cells.map((c) => c.value ?? 0));
      y = scaleLinear().domain([0, max]).nice().range([ih, 0]);
      yTicks = y.ticks(5);
      xAxis = data.x.map((k) => ({ key: k, pos: xs(k) ?? 0 }));
      body = (
        <g>
          {data.series.map((s) => {
            const pts = data.x.map((x) => ({ x, v: get(x, s)?.value ?? null }));
            const gen = line<{ x: string; v: number | null }>()
              .defined((d) => d.v != null)
              .x((d) => xs(d.x) ?? 0)
              .y((d) => y(d.v ?? 0))
              .curve(curveMonotoneX);
            return (
              <g key={s}>
                <path d={gen(pts) ?? undefined} fill="none" stroke={color(s)} strokeWidth={2.2} />
                {pts.map((p) =>
                  p.v == null ? null : (
                    <circle
                      key={p.x}
                      cx={xs(p.x)}
                      cy={y(p.v)}
                      r={data.x.length > 40 ? 2 : 3.5}
                      fill={color(s)}
                      onPointerMove={(e) => show(e, tipText(p.x, s))}
                      onPointerLeave={() => setTip(null)}
                    />
                  ),
                )}
              </g>
            );
          })}
        </g>
      );
    } else {
      // bar, stacked, stacked100
      const xs = scaleBand().domain(data.x).range([0, iw]).padding(0.22);
      xAxis = data.x.map((k) => ({ key: k, pos: (xs(k) ?? 0) + xs.bandwidth() / 2 }));
      if (type === "bar" || !multi) {
        const inner = scaleBand().domain(data.series).range([0, xs.bandwidth()]).padding(0.08);
        const max = Math.max(1e-9, ...data.cells.map((c) => c.value ?? 0));
        y = scaleLinear().domain([0, max]).nice().range([ih, 0]);
        yTicks = y.ticks(5);
        body = (
          <g>
            {data.x.map((x) =>
              data.series.map((s) => {
                const v = get(x, s)?.value;
                const bx = (xs(x) ?? 0) + (inner(s) ?? 0);
                return (
                  <rect
                    key={`${x}|${s}`}
                    x={bx}
                    y={v == null ? ih - 6 : y(v)}
                    width={inner.bandwidth()}
                    height={v == null ? 6 : Math.max(0, ih - y(v))}
                    rx={Math.min(4, inner.bandwidth() / 3)}
                    fill={v == null ? "url(#hatch)" : color(s)}
                    onPointerMove={(e) => show(e, tipText(x, s))}
                    onPointerLeave={() => setTip(null)}
                  />
                );
              }),
            )}
          </g>
        );
      } else {
        const rows = data.x.map((x) => {
          const row: Record<string, number | string> = { x };
          const sum = data.series.reduce((a, s) => a + (get(x, s)?.value ?? 0), 0);
          for (const s of data.series) {
            const v = get(x, s)?.value ?? 0;
            row[s] = type === "stacked100" ? (sum ? (100 * v) / sum : 0) : v;
          }
          return row;
        });
        const stacked = stack<Record<string, number | string>>()
          .keys(data.series)
          .value((d, k) => Number(d[k]))(rows);
        const max = type === "stacked100" ? 100 : Math.max(1e-9, ...stacked.flatMap((layer) => layer.map((p) => p[1])));
        y = scaleLinear().domain([0, max]).nice().range([ih, 0]);
        yTicks = y.ticks(5);
        body = (
          <g>
            {stacked.map((layer) =>
              layer.map((p) => {
                const x = String(p.data.x);
                const s = layer.key;
                const hidden = get(x, s)?.value == null;
                return (
                  <rect
                    key={`${x}|${s}`}
                    x={xs(x)}
                    y={y(p[1])}
                    width={xs.bandwidth()}
                    height={Math.max(0, y(p[0]) - y(p[1]))}
                    fill={hidden ? "url(#hatch)" : color(s)}
                    stroke="var(--card-3)"
                    strokeWidth={1}
                    onPointerMove={(e) =>
                      show(e, type === "stacked100" && !hidden ? `${tipText(x, s)} · ${Math.round(p[1] - p[0])}%` : tipText(x, s))
                    }
                    onPointerLeave={() => setTip(null)}
                  />
                );
              }),
            )}
          </g>
        );
      }
    }
  }

  const unitSuffix = type === "stacked100" ? "%" : data.unit === "percent" ? "%" : data.unit === "seconds" ? " s" : "";

  return (
    <div ref={ref} className="relative h-full min-h-64 w-full">
      {multi && type !== "pie" && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 px-1 pb-1 text-xs">
          {data.series.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: color(s) }} />
              {data.seriesLabels[s]}
            </li>
          ))}
        </ul>
      )}
      {type === "pie" && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 px-1 pb-1 text-xs">
          {data.x.map((x, i) => (
            <li key={x} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
              {data.xLabels[x]}
            </li>
          ))}
        </ul>
      )}
      {w > 0 && (
        <svg width={w} height={Math.max(0, h - (multi || type === "pie" ? 26 : 0))} role="img" aria-label={t("title")} className="overflow-visible">
          <defs>
            <Hatch id="hatch" />
          </defs>
          {type === "pie" ? (
            body
          ) : (
            <g transform={`translate(${margin.left},${margin.top})`}>
              {type !== "heatmap" &&
                yTicks.map((v) => (
                  <g key={v} transform={`translate(0,${y(v)})`}>
                    <line x2={iw} stroke="var(--line)" strokeOpacity={0.6} />
                    <text x={-8} dominantBaseline="middle" textAnchor="end" fontSize={11} fill="var(--muted)">
                      {v}
                      {unitSuffix}
                    </text>
                  </g>
                ))}
              {body}
              {xAxis.map(({ key, pos }, i) =>
                many && data.x.length > 30 && i % Math.ceil(data.x.length / 30) !== 0 ? null : (
                  <text
                    key={key}
                    transform={`translate(${pos},${ih + 14})${many ? " rotate(-38)" : ""}`}
                    textAnchor={many ? "end" : "middle"}
                    fontSize={11}
                    fill="var(--muted)"
                    lang="uz"
                  >
                    {data.xLabels[key].length > 18 ? data.xLabels[key].slice(0, 17) + "…" : data.xLabels[key]}
                  </text>
                ),
              )}
            </g>
          )}
        </svg>
      )}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 -translate-x-1/2 -translate-y-full rounded-xl bg-fg px-2.5 py-1.5 text-xs font-semibold text-bg shadow-lg"
          style={{ left: tip.x, top: tip.y - 10 }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}

function DataTable({ data }: { data: LabelledChart }) {
  const t = useTranslations("admin.charts");
  const multi = data.series.length > 1;
  return (
    <div className="scroll-thin h-full overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky top-0 bg-card-3 px-3 py-2 text-left text-xs font-semibold text-muted" />
            {data.series.map((s) => (
              <th key={s} className="sticky top-0 bg-card-3 px-3 py-2 text-right text-xs font-semibold text-muted">
                {data.seriesLabels[s]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.x.map((x) => (
            <tr key={x} className="odd:bg-card/60">
              <th scope="row" className="px-3 py-1.5 text-left font-semibold" lang="uz">
                {data.xLabels[x]}
              </th>
              {data.series.map((s) => {
                const c = data.cells.find((c) => c.x === x && c.s === s);
                return (
                  <td key={s} className="px-3 py-1.5 text-right tabular-nums">
                    {c?.value == null ? <span className="text-muted">—</span> : fmt(c.value, data.unit)}
                    {c && c.value != null && <span className="ml-1.5 text-xs text-muted">n={c.n}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
