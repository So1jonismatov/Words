import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BarList } from "@/components/bars";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/fields";
import { isAdmin } from "@/lib/admin-auth";
import { displayUz } from "@/lib/normalize";
import { AGE_GROUPS, BACKGROUNDS, DEMOGRAPHIC_DIMENSIONS, GENDERS, K_ANON, OTHER_COUNTRY, type DemographicDimension } from "@/lib/options";
import { getDashboard, type StatsFilter } from "@/lib/repo/stats";
import { listLinks } from "@/lib/repo/links";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { listWords } from "@/lib/repo/words";
import { ChartBuilder } from "./chart-builder";

type Search = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function parseDate(v: string, endOfDay: boolean): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const ms = Date.parse(`${v}T00:00:00Z`);
  return Number.isNaN(ms) ? undefined : endOfDay ? ms + 86_399_999 : ms;
}

const FILTER_KEYS = ["link", "ageGroup", "gender", "country", "background", "from", "to"] as const;
const TABS = ["charts", "questionnaire", "cues", "cloud", "compare", "cooc", "export"] as const;
type Tab = (typeof TABS)[number];

const th = "sticky top-0 z-10 bg-card px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase";
const td = "px-3 py-2 align-top";
const row = "odd:bg-card-3/70 [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl";

export default async function AdminStatsPage({ searchParams }: { searchParams: Promise<Search> }) {
  if (!(await isAdmin())) return null;
  const sp = await searchParams;
  const params = Object.fromEntries([...FILTER_KEYS, "cloud", "cmp", "dim", "tab"].map((k) => [k, one(sp[k])]));
  const tab: Tab = (TABS as readonly string[]).includes(params.tab) ? (params.tab as Tab) : "charts";

  const filter: StatsFilter = {
    ageGroup: (AGE_GROUPS as readonly string[]).includes(params.ageGroup) ? params.ageGroup : undefined,
    gender: (GENDERS as readonly string[]).includes(params.gender) ? params.gender : undefined,
    country: /^([A-Z]{2}|OTHER)$/.test(params.country) ? params.country : undefined,
    background: (BACKGROUNDS as readonly string[]).includes(params.background) ? params.background : undefined,
    link: /^(none|[A-Za-z0-9]{4,32})$/.test(params.link) ? params.link : undefined,
    from: parseDate(params.from, false),
    to: parseDate(params.to, true),
  };
  const cmpCue = Number(params.cmp) || undefined;
  const dim = (DEMOGRAPHIC_DIMENSIONS as readonly string[]).includes(params.dim) ? (params.dim as DemographicDimension) : "ageGroup";

  const [t, to, locale, settings, data, links] = await Promise.all([
    getTranslations("admin"),
    getTranslations("options"),
    getLocale(),
    getSettings(),
    getDashboard(filter, tab === "compare" && cmpCue ? { cueId: cmpCue, dimension: dim } : undefined),
    listLinks(),
  ]);
  const chartCues = tab === "charts" ? (await listWords()).map((w) => ({ id: w.id, label: displayUz(w.text) })) : [];
  const chartFilter = {
    ageGroup: filter.ageGroup as (typeof AGE_GROUPS)[number] | undefined,
    gender: filter.gender as (typeof GENDERS)[number] | undefined,
    country: filter.country,
    background: filter.background as (typeof BACKGROUNDS)[number] | undefined,
    link: filter.link,
    from: filter.from !== undefined ? params.from : undefined,
    to: filter.to !== undefined ? params.to : undefined,
  };
  const countryNames = new Intl.DisplayNames([locale], { type: "region" });
  const countryLabel = (c: string) => (c === OTHER_COUNTRY ? to("country.OTHER") : (countryNames.of(c) ?? c));
  const groupLabel = (d: DemographicDimension, v: string) => {
    if (v === "na") return to("gender.na");
    if (d === "country") return countryLabel(v);
    return to(`${d}.${v}`);
  };

  /** Hidden inputs that carry the current state into a GET form. */
  const keep = (exclude: string[]) =>
    Object.entries(params)
      .filter(([k, v]) => v && !exclude.includes(k))
      .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  const tabHref = (id: Tab) => {
    const q = new URLSearchParams(Object.entries({ ...params, tab: id }).filter(([, v]) => v));
    return `/admin?${q}`;
  };

  const cloudCue = data.cues.find((c) => c.cueId === Number(params.cloud)) ?? data.cues.find((c) => c.responses > 0);
  const filters = [
    { name: "link", label: t("dimensions.link"), opts: [["none", t("filters.noLink")], ...links.map((l) => [l.id, l.name])] },
    { name: "ageGroup", label: t("dimensions.ageGroup"), opts: AGE_GROUPS.filter((a) => a !== "under18").map((v) => [v, to(`ageGroup.${v}`)]) },
    { name: "gender", label: t("dimensions.gender"), opts: GENDERS.map((v) => [v, to(`gender.${v}`)]) },
    { name: "country", label: t("dimensions.country"), opts: [...settings.countries, OTHER_COUNTRY].map((v) => [v, countryLabel(v)]) },
    { name: "background", label: t("dimensions.background"), opts: BACKGROUNDS.map((v) => [v, to(`background.${v}`)]) },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      {/* Phones: filters fold behind a CSS-only toggle; always open from lg up. */}
      <input id="filters-toggle" type="checkbox" className="peer sr-only" />
      <label
        htmlFor="filters-toggle"
        className="flex h-9 cursor-pointer items-center justify-between rounded-full bg-card px-4 text-xs font-semibold text-muted peer-focus-visible:outline-2 peer-focus-visible:outline-(--ring) peer-checked:[&_svg]:rotate-180 lg:hidden"
      >
        {t("filters.title")}
        {Object.entries(params).some(([k, v]) => v && (FILTER_KEYS as readonly string[]).includes(k)) && (
          <span className="ml-2 size-2 rounded-full bg-accent" aria-hidden />
        )}
        <span className="flex-1" />
        <svg aria-hidden viewBox="0 0 20 20" className="size-4 transition-transform" fill="currentColor">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </label>
      <form
        method="get"
        className="hidden flex-wrap items-center gap-2 rounded-3xl bg-card p-2.5 peer-checked:flex lg:flex"
        aria-label={t("filters.title")}
      >
        {keep([...FILTER_KEYS])}
        {filters.map((f) => (
          <div key={f.name} className="min-w-36 flex-1">
            <Select name={f.name} aria-label={f.label} defaultValue={params[f.name]}>
              {/* The empty option shows the dimension name: no filter = everyone. */}
              <option value="">{f.label}</option>
              {f.opts.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
        ))}
        <Input type="date" name="from" aria-label={t("filters.from")} title={t("filters.from")} defaultValue={params.from} wrapperClassName="min-w-36 flex-1" className="h-11" />
        <Input type="date" name="to" aria-label={t("filters.to")} title={t("filters.to")} defaultValue={params.to} wrapperClassName="min-w-36 flex-1" className="h-11" />
        <div className="flex gap-1">
          <button type="submit" className={cn(buttonClass("primary", "sm"), "h-11")}>
            {t("filters.apply")}
          </button>
          <Link href={`/admin?tab=${tab}`} className={cn(buttonClass("plain", "sm"), "h-11")}>
            {t("filters.reset")}
          </Link>
        </div>
      </form>

      <nav className="scroll-thin flex w-fit max-w-full shrink-0 gap-1 overflow-x-auto rounded-full bg-card p-1" aria-label={t("title")}>
        {TABS.map((id) => (
          <Link
            key={id}
            href={tabHref(id)}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "tap flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold whitespace-nowrap transition-colors",
              tab === id ? "bg-accent-soft text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t(`tabs.${id}`)}
          </Link>
        ))}
      </nav>

      <Card className="scroll-thin min-h-0 flex-1 overflow-auto rounded-3xl p-3 sm:p-4">
        {tab === "charts" ? (
          <ChartBuilder filter={chartFilter} cues={chartCues} />
        ) : data.suppressed && tab !== "export" ? (
          <p className="py-10 text-center text-sm text-muted">{t("suppressed", { k: K_ANON })}</p>
        ) : tab === "questionnaire" ? (
          data.questionnaire && (
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { title: t("questionnaire.q2"), dist: data.questionnaire.q2, ns: "q2" },
                { title: t("questionnaire.q3"), dist: data.questionnaire.q3, ns: "q3" },
                { title: t("questionnaire.q4"), dist: data.questionnaire.q4, ns: "q4" },
              ].map((b) => (
                <section key={b.ns} className={cn("rounded-2xl bg-card-3 p-4", b.ns === "q2" && "md:row-span-2")}>
                  <h2 className="mb-3 text-sm font-bold">
                    {b.title} <span className="font-normal text-muted">· n={b.dist.total}</span>
                  </h2>
                  <BarList total={b.dist.total} items={b.dist.items.map((i) => ({ key: i.key, label: `${to(`${b.ns}.${i.key}`)} · ${i.count}`, count: i.count }))} />
                </section>
              ))}
              <section className="rounded-2xl bg-card-3 p-4 md:col-span-2">
                <h2 className="mb-3 text-sm font-bold">{t("questionnaire.q1Top")}</h2>
                {data.questionnaire.q1Top.length === 0 ? (
                  <p className="text-sm text-muted">{t("questionnaire.empty")}</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5" lang="uz">
                    {data.questionnaire.q1Top.map((w) => (
                      <li key={w.key} className="rounded-full bg-card px-3 py-1 text-xs">
                        {w.key} <span className="text-muted tabular-nums">{w.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )
        ) : tab === "cues" ? (
          <table className="w-full min-w-180 border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className={th}>{t("cues.cue")}</th>
                <th className={cn(th, "text-right")}>{t("cues.seen")}</th>
                <th className={cn(th, "text-right")}>{t("cues.responses")}</th>
                <th className={cn(th, "text-right")}>{t("cues.unique")}</th>
                <th className={th}>{t("cues.top")}</th>
                <th className={cn(th, "text-right")}>{t("cues.unknownRate")}</th>
                <th className={cn(th, "text-right")}>{t("cues.skipRate")}</th>
              </tr>
            </thead>
            <tbody>
              {data.cues.map((c) => (
                <tr key={c.cueId} className={row}>
                  <td className={cn(td, "font-semibold")} lang="uz">
                    {displayUz(c.text)}
                    {!c.active && <span className="ml-1.5 text-xs font-normal text-muted">({t("cues.inactive")})</span>}
                  </td>
                  <td className={cn(td, "text-right tabular-nums")}>{c.seen}</td>
                  <td className={cn(td, "text-right tabular-nums")}>{c.responses}</td>
                  <td className={cn(td, "text-right tabular-nums")}>{c.uniqueAnswers}</td>
                  <td className={cn(td, "text-xs text-muted")} lang="uz">
                    {c.top.map((x) => `${x.key} (${x.count})`).join(", ") || "—"}
                  </td>
                  <td className={cn(td, "text-right tabular-nums")}>{c.seen ? `${Math.round(c.unknownRate * 100)}%` : "—"}</td>
                  <td className={cn(td, "text-right tabular-nums")}>{c.seen ? `${Math.round(c.skipRate * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === "cloud" ? (
          <div>
            <form method="get" className="flex max-w-md gap-2">
              {keep(["cloud"])}
              <div className="flex-1">
                <Select name="cloud" aria-label={t("cloud.cue")} defaultValue={cloudCue?.cueId}>
                  {data.cues.map((c) => (
                    <option key={c.cueId} value={c.cueId}>
                      {displayUz(c.text)} ({c.responses})
                    </option>
                  ))}
                </Select>
              </div>
              <button type="submit" className={cn(buttonClass("secondary", "sm"), "h-11")}>
                {t("compare.show")}
              </button>
            </form>
            <WordCloud items={cloudCue?.cloud ?? []} empty={t("cloud.empty")} />
          </div>
        ) : tab === "compare" ? (
          <div>
            <form method="get" className="grid max-w-xl grid-cols-[1fr_1fr_auto] gap-2">
              {keep(["cmp", "dim"])}
              <Select name="cmp" aria-label={t("compare.cue")} defaultValue={cmpCue}>
                {data.cues.map((c) => (
                  <option key={c.cueId} value={c.cueId}>
                    {displayUz(c.text)}
                  </option>
                ))}
              </Select>
              <Select name="dim" aria-label={t("compare.dimension")} defaultValue={dim}>
                {DEMOGRAPHIC_DIMENSIONS.map((d) => (
                  <option key={d} value={d}>
                    {t(`dimensions.${d}`)}
                  </option>
                ))}
              </Select>
              <button type="submit" className={cn(buttonClass("secondary", "sm"), "h-11")}>
                {t("compare.show")}
              </button>
            </form>
            {!data.comparison ? (
              <p className="mt-6 text-sm text-muted">{t("compare.pick")}</p>
            ) : (
              <table className="mt-3 w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className={th}>{t("compare.group")}</th>
                    <th className={cn(th, "text-right")}>{t("compare.n")}</th>
                    <th className={th}>{t("compare.top")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.comparison.map((g) => (
                    <tr key={g.group} className={row}>
                      <td className={cn(td, "font-semibold")}>{groupLabel(dim, g.group)}</td>
                      <td className={cn(td, "text-right tabular-nums")}>{g.suppressed ? `<${K_ANON}` : g.n}</td>
                      <td className={cn(td, "text-xs", g.suppressed && "text-muted italic")} lang="uz">
                        {g.suppressed ? t("compare.hidden", { k: K_ANON }) : g.top.map((x) => `${x.key} (${x.count})`).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : tab === "cooc" ? (
          data.coOccurrence.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">{t("cooc.empty")}</p>
          ) : (
            <table className="w-full min-w-140 border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className={th}>{t("cooc.answer")}</th>
                  <th className={cn(th, "text-right")}>{t("cooc.count")}</th>
                  <th className={th}>{t("cooc.cues")}</th>
                </tr>
              </thead>
              <tbody>
                {data.coOccurrence.map((r) => (
                  <tr key={r.answer} className={row}>
                    <td className={cn(td, "font-semibold")} lang="uz">
                      {r.answer}
                    </td>
                    <td className={cn(td, "text-right tabular-nums")}>{r.cueCount}</td>
                    <td className={cn(td, "text-xs text-muted")} lang="uz">
                      {r.cues
                        .slice(0, 8)
                        .map((c) => `${displayUz(c.key)} (${c.count})`)
                        .join(", ")}
                      {r.cues.length > 8 && ` +${r.cues.length - 8}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <div className="space-y-2">
            <h2 className="mb-1 text-sm font-bold">{t("export.title")}</h2>
            {(["responses", "participants", "questionnaire"] as const).map((kind) => (
              <div key={kind} className="flex flex-wrap items-center gap-2 rounded-2xl bg-card-3 px-4 py-2.5">
                <span className="min-w-32 flex-1 text-sm font-semibold">{t(`export.${kind}`)}</span>
                {(["csv", "json"] as const).map((fmt) => (
                  <a key={fmt} href={`/api/admin/export?type=${kind}&format=${fmt}`} className={buttonClass("secondary", "sm")}>
                    {fmt.toUpperCase()}
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/** Simple word cloud: font size scales with sqrt(count). No library. */
function WordCloud({ items, empty }: { items: { key: string; count: number }[]; empty: string }) {
  if (items.length === 0) return <p className="mt-6 text-sm text-muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count));
  const sorted = [...items].sort((a, b) => (a.key < b.key ? -1 : 1));
  return (
    <ul className="mt-4 flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1.5 py-4" lang="uz">
      {sorted.map((i) => {
        const r = Math.sqrt(i.count / max);
        return (
          <li
            key={i.key}
            title={`${i.key}: ${i.count}`}
            className={cn("leading-tight font-bold", r > 0.66 ? "text-accent" : r > 0.33 ? "text-teal" : "text-muted")}
            style={{ fontSize: `${0.8 + r * 1.9}rem` }}
          >
            {i.key}
            <span className="sr-only"> ({i.count})</span>
          </li>
        );
      })}
    </ul>
  );
}
