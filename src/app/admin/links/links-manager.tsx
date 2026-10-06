"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createLinkAction, deleteLinkAction, setLinkActiveAction, updateLinkAction } from "@/actions/admin";
import type { ActionResult } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { TextField } from "@/components/ui/fields";
import type { SurveyLinkRow } from "@/lib/repo/links";
import { cn } from "@/lib/utils";

interface Word {
  id: number;
  display: string;
  active: boolean;
}

interface Draft {
  /** null = creating a new link */
  id: string | null;
  name: string;
  perParticipant: number;
  cueIds: Set<number>;
}

export function LinksManager({
  links,
  words,
  defaultPerParticipant,
}: {
  links: SurveyLinkRow[];
  words: Word[];
  defaultPerParticipant: number;
}) {
  const t = useTranslations("admin.links");
  const tRoot = useTranslations();
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const activeIds = () => new Set(words.filter((w) => w.active).map((w) => w.id));
  const blank = (): Draft => ({ id: null, name: "", perParticipant: defaultPerParticipant, cueIds: activeIds() });
  const [draft, setDraft] = useState<Draft>(blank);

  useEffect(() => setOrigin(window.location.origin), []);

  const urlFor = (id: string) => `${origin}/s/${id}`;

  const run = (fn: () => Promise<ActionResult<unknown>>, ok?: (res: ActionResult<unknown>) => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) ok?.(res);
      else setMessage({ text: tRoot(res.error), error: true });
    });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return setMessage({ text: t("needName"), error: true });
    if (draft.cueIds.size === 0) return setMessage({ text: t("needWords"), error: true });
    const input = { name: draft.name, cueIds: [...draft.cueIds], cuesPerParticipant: draft.perParticipant };
    if (draft.id) {
      const id = draft.id;
      run(
        () => updateLinkAction(id, input),
        () => {
          setMessage({ text: t("saved") });
          setHighlight(id);
          setDraft(blank());
        },
      );
    } else {
      run(
        () => createLinkAction(input),
        (res) => {
          const id = (res as { data?: { id: string } }).data?.id ?? null;
          setMessage({ text: t("created") });
          setHighlight(id);
          setDraft(blank());
        },
      );
    }
  };

  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(urlFor(id));
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard unavailable: the URL is visible and selectable.
    }
  };

  const toggleWord = (id: number) =>
    setDraft((d) => {
      const next = new Set(d.cueIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...d, cueIds: next };
    });

  const selectedCount = draft.cueIds.size;

  return (
    <div className="scroll-thin grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[1fr_26rem] lg:overflow-visible">
      <Card className="scroll-thin flex min-h-0 flex-col rounded-3xl p-4 sm:p-5 lg:overflow-y-auto">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">{t("title")}</h1>
            <p className="mt-0.5 text-xs text-muted">{t("intro", { n: defaultPerParticipant })}</p>
          </div>
          {draft.id && (
            <Button size="sm" variant="secondary" onClick={() => setDraft(blank())}>
              + {t("new")}
            </Button>
          )}
        </div>

        {message && (
          <p role="status" className={cn("mt-3 rounded-2xl px-3 py-2 text-xs", message.error ? "bg-danger/15 text-danger" : "bg-teal-soft")}>
            {message.text}
          </p>
        )}

        {links.length === 0 ? (
          <p className="mt-6 text-sm text-muted">{t("empty")}</p>
        ) : (
          <ul className={cn("mt-3 space-y-2", pending && "opacity-70")}>
            {links.map((l) => (
              <li
                key={l.id}
                className={cn(
                  "rounded-2xl bg-card-3 p-3 transition-shadow",
                  highlight === l.id && "shadow-[inset_0_0_0_2px_var(--accent)]",
                  draft.id === l.id && "bg-accent-soft",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 flex-1 truncate font-bold">{l.name}</h2>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
                      l.active ? "bg-teal-soft text-teal" : "bg-card-2 text-muted",
                    )}
                  >
                    {l.active ? t("active") : t("inactive")}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {t("wordsInfo", { n: Math.min(l.cuesPerParticipant, l.cueIds.length), words: l.cueIds.length })} ·{" "}
                  {t("stats", { participants: l.participants, completed: l.completed })}
                </p>

                <div className="mt-2 flex items-center gap-1.5">
                  <code className="min-w-0 flex-1 truncate rounded-t-lg rounded-b-sm bg-card-2 px-3 py-2 text-xs select-all" title={urlFor(l.id)}>
                    {urlFor(l.id)}
                  </code>
                  <Button size="sm" onClick={() => copy(l.id)} aria-live="polite">
                    {copied === l.id ? t("copied") : t("copy")}
                  </Button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {confirmDelete === l.id ? (
                    <>
                      <span className="mr-1 text-xs text-danger">{t("confirmDelete")}</span>
                      <Button size="sm" variant="danger" onClick={() => run(() => deleteLinkAction(l.id), () => setConfirmDelete(null))}>
                        {t("delete")}
                      </Button>
                      <Button size="sm" variant="plain" onClick={() => setConfirmDelete(null)}>
                        {t("cancel")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="plain"
                        onClick={() => {
                          setMessage(null);
                          setDraft({ id: l.id, name: l.name, perParticipant: l.cuesPerParticipant, cueIds: new Set(l.cueIds) });
                        }}
                      >
                        {t("edit")}
                      </Button>
                      <Button size="sm" variant="plain" onClick={() => run(() => setLinkActiveAction(l.id, !l.active))}>
                        {l.active ? t("deactivate") : t("activate")}
                      </Button>
                      <a href={`/s/${l.id}`} target="_blank" rel="noreferrer" className="flex h-8 items-center rounded-full px-3.5 text-xs font-semibold text-muted hover:bg-fg/8 hover:text-fg">
                        {t("open")} ↗
                      </a>
                      <span className="flex-1" />
                      <Button size="sm" variant="plain" className="hover:text-danger" onClick={() => setConfirmDelete(l.id)}>
                        {t("delete")}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex min-h-0 flex-col rounded-3xl p-4 sm:p-5">
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col gap-2.5">
          <Eyebrow>{draft.id ? t("editTitle") : t("new")}</Eyebrow>
          <TextField
            id="link-name"
            label={t("name")}
            placeholder={t("namePlaceholder")}
            maxLength={80}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <TextField
            id="link-n"
            label={t("perParticipant")}
            type="number"
            min={1}
            max={100}
            value={draft.perParticipant}
            onChange={(e) => setDraft({ ...draft, perParticipant: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
          />

          <div className="mt-1 flex items-center gap-2 px-1">
            <span className="text-xs font-semibold text-muted">{t("words")}</span>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent tabular-nums" aria-live="polite">
              {t("selected", { count: selectedCount })}
            </span>
            <span className="flex-1" />
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setDraft({ ...draft, cueIds: activeIds() })}>
              {t("selectAll")}
            </Button>
            <Button size="sm" variant="plain" className="h-7" onClick={() => setDraft({ ...draft, cueIds: new Set() })}>
              {t("clear")}
            </Button>
          </div>

          <div role="group" aria-label={t("words")} className="scroll-thin flex min-h-24 flex-1 flex-wrap content-start gap-1.5 overflow-y-auto rounded-2xl bg-card-3 p-2">
            {words.map((w) => {
              const on = draft.cueIds.has(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  lang="uz"
                  aria-pressed={on}
                  title={w.active ? undefined : t("inactiveWord")}
                  onClick={() => toggleWord(w.id)}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-xs transition-colors",
                    on ? "bg-accent-soft font-semibold text-fg" : "bg-card text-muted hover:text-fg",
                    !w.active && "italic opacity-60",
                  )}
                >
                  {on && <span aria-hidden>✓ </span>}
                  {w.display}
                </button>
              );
            })}
          </div>

          {selectedCount > 0 && selectedCount < draft.perParticipant && (
            <p className="px-1 text-[11px] text-accent">{t("tooFew", { n: draft.perParticipant, count: selectedCount })}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={pending}>
              {draft.id ? t("save") : t("create")}
            </Button>
            {draft.id && (
              <Button variant="plain" onClick={() => setDraft(blank())}>
                {t("cancel")}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
