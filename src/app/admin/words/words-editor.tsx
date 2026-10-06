"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  addWordsAction,
  deleteWordAction,
  importWordsCsvAction,
  markWordReviewedAction,
  moveWordAction,
  setWordActiveAction,
  updateWordAction,
  updateWordMeaningAction,
} from "@/actions/admin";
import type { ActionResult } from "@/actions/types";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Input, Textarea, TextField } from "@/components/ui/fields";
import type { CueWordRow } from "@/lib/repo/words";
import { cn } from "@/lib/utils";

type Row = CueWordRow & { display: string };

export function WordsEditor({ words }: { words: Row[] }) {
  const t = useTranslations("admin.words");
  const tRoot = useTranslations();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [bulk, setBulk] = useState("");
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [meaningFor, setMeaningFor] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (fn: () => Promise<ActionResult<unknown>>, onOk?: (res: ActionResult<unknown>) => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) onOk?.(res);
      else setMessage({ text: tRoot(res.error), error: true });
    });

  const addBulk = () =>
    startTransition(async () => {
      const res = await addWordsAction(bulk);
      if (!res.ok || !res.data)
        return setMessage({
          text: tRoot(res.ok ? "common.errorGeneric" : res.error),
          error: true,
        });
      const parts = [t("added", { count: res.data.added.length })];
      if (res.data.skipped.length) parts.push(t("skipped", { list: res.data.skipped.join(", ") }));
      setMessage({ text: parts.join(" ") });
      setBulk("");
    });

  const importCsv = async (file: File) => {
    const text = await file.text();
    startTransition(async () => {
      const res = await importWordsCsvAction(text);
      if (res.ok && res.data) setMessage({ text: t("imported", res.data) });
      else
        setMessage({
          text: tRoot(res.ok ? "common.errorGeneric" : res.error),
          error: true,
        });
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[1fr_18rem]">
      <Card className="scroll-thin order-2 min-h-0 flex-1 overflow-auto rounded-3xl p-2 sm:p-3 lg:order-1">
        <div>
          <table className="w-full min-w-160 border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left">
                <th className="sticky top-0 z-10 bg-card px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  {t("order")}
                </th>
                <th className="sticky top-0 z-10 bg-card px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  {t("word")}
                </th>
                <th className="sticky top-0 z-10 bg-card px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  {t("status")}
                </th>
                <th className="sticky top-0 z-10 bg-card px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase text-right">
                  {t("responses")}
                </th>
                <th className="sticky top-0 z-10 bg-card px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase text-right">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className={cn(pending && "opacity-60")}>
              {words.map((w, i) => (
                <Fragment key={w.id}>
                  <tr className="odd:bg-card-3/70 [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl">
                    <td className="px-3 py-1.5 text-xs text-muted tabular-nums">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      {editing?.id === w.id ? (
                        <form
                          className="flex gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            run(
                              () => updateWordAction(w.id, editing.text),
                              () => setEditing(null),
                            );
                          }}
                        >
                          <Input
                            autoFocus
                            aria-label={t("word")}
                            value={editing.text}
                            maxLength={80}
                            onChange={(e) => setEditing({ id: w.id, text: e.target.value })}
                            className="h-8 text-sm"
                          />
                          <Button type="submit" size="sm" disabled={pending}>
                            {t("save")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            {t("cancel")}
                          </Button>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span lang="uz" className={cn("font-semibold", !w.active && "text-muted line-through decoration-muted/50")}>
                            {w.display}
                          </span>
                          {w.needsReview && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                              ⚠ {t("checkSpelling")}
                              <button
                                type="button"
                                className="underline underline-offset-2"
                                onClick={() => run(() => markWordReviewedAction(w.id))}
                              >
                                {t("markOk")}
                              </button>
                            </span>
                          )}
                          <span className="basis-full truncate text-xs text-muted" title={w.meaning?.uz}>
                            {w.meaning ? w.meaning.uz : <span className="italic">{t("noMeaning")}</span>}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => run(() => setWordActiveAction(w.id, !w.active))}
                        title={w.active ? t("deactivate") : t("activate")}
                        className={cn(
                          "tap rounded-full px-2.5 py-0.5 text-xs font-bold",
                          w.active ? "bg-teal-soft text-teal" : "bg-card-2 text-muted",
                        )}
                      >
                        {w.active ? t("active") : t("inactive")}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{w.responses}</td>
                    <td className="px-3 py-1.5">
                      {confirmDelete === w.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-danger">
                            {w.responses ? t("confirmDelete", { count: w.responses }) : t("confirmDeleteEmpty")}
                          </span>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() =>
                              run(
                                () => deleteWordAction(w.id),
                                () => setConfirmDelete(null),
                              )
                            }
                          >
                            {t("delete")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                            {t("cancel")}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton label={t("moveUp")} disabled={i === 0} onClick={() => run(() => moveWordAction(w.id, -1))}>
                            ↑
                          </IconButton>
                          <IconButton
                            label={t("moveDown")}
                            disabled={i === words.length - 1}
                            onClick={() => run(() => moveWordAction(w.id, 1))}
                          >
                            ↓
                          </IconButton>
                          <IconButton label={t("edit")} onClick={() => setEditing({ id: w.id, text: w.text })}>
                            ✎
                          </IconButton>
                          <IconButton label={t("meaningTitle")} onClick={() => setMeaningFor(meaningFor === w.id ? null : w.id)}>
                            <span className="font-serif italic">i</span>
                          </IconButton>
                          <IconButton label={t("delete")} onClick={() => setConfirmDelete(w.id)} danger>
                            ✕
                          </IconButton>
                        </div>
                      )}
                    </td>
                  </tr>
                  {meaningFor === w.id && (
                    <tr>
                      <td colSpan={5} className="px-3 pb-3">
                        <MeaningEditor
                          word={w}
                          pending={pending}
                          onCancel={() => setMeaningFor(null)}
                          onSave={(input) =>
                            run(
                              () => updateWordMeaningAction({ wordId: w.id, ...input }),
                              () => setMeaningFor(null),
                            )
                          }
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="order-1 shrink-0 lg:order-2 lg:min-h-0">
        {/* Phones: tools fold behind a CSS-only toggle; always visible from lg up. */}
        <input id="tools-toggle" type="checkbox" className="peer sr-only" />
        <label
          htmlFor="tools-toggle"
          className="flex h-9 cursor-pointer items-center justify-between rounded-full bg-card px-4 text-xs font-semibold text-muted peer-focus-visible:outline-2 peer-focus-visible:outline-(--ring) peer-checked:[&_svg]:rotate-180 lg:hidden"
        >
          {t("addTitle")} · CSV
          <svg aria-hidden viewBox="0 0 20 20" className="size-4 transition-transform" fill="currentColor">
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
          </svg>
        </label>
        <div className="scroll-thin mt-2 hidden max-h-[45dvh] space-y-3 overflow-y-auto peer-checked:block lg:mt-0 lg:block lg:h-full lg:max-h-none">
          {message && (
            <p role="status" className={cn("rounded-2xl p-3 text-xs", message.error ? "bg-danger/15 text-danger" : "bg-teal-soft text-fg")}>
              {message.text}
            </p>
          )}
          <Card className="rounded-3xl p-4 sm:p-4">
            <Eyebrow>{t("addTitle")}</Eyebrow>
            <Textarea
              className="mt-3"
              aria-label={t("addTitle")}
              lang="uz"
              rows={4}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"vijdon\nmehr-oqibat\n…"}
            />
            <p className="mt-1.5 text-xs text-muted">{t("addHint")}</p>
            <Button size="sm" className="mt-2.5 w-full" onClick={addBulk} disabled={pending || !bulk.trim()}>
              {t("addButton")}
            </Button>
          </Card>
          <Card className="rounded-3xl p-4 sm:p-4">
            <Eyebrow>{t("csvTitle")}</Eyebrow>
            <p className="mt-1.5 text-xs text-muted">{t("csvHint")}</p>
            <div className="mt-2.5 flex gap-2">
              <label className={cn(buttonClass("secondary", "sm"), "flex-1 cursor-pointer")}>
                {t("csvImport")}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
                />
              </label>
              <a href="/api/admin/export?type=words&format=csv" className={cn(buttonClass("ghost", "sm"), "flex-1")}>
                {t("csvExport")}
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "tap flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-fg/8 disabled:opacity-30",
        danger ? "hover:text-danger" : "hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function MeaningEditor({
  word,
  pending,
  onSave,
  onCancel,
}: {
  word: Row;
  pending: boolean;
  onSave: (input: { uz: string; en: string; ru: string; related: string[] }) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("admin.words");
  const [m, setM] = useState({ uz: word.meaning?.uz ?? "", en: word.meaning?.en ?? "", ru: word.meaning?.ru ?? "" });
  const [related, setRelated] = useState(word.related.join(", "));
  return (
    <form
      className="space-y-2 rounded-2xl bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...m,
          related: related
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean),
        });
      }}
    >
      <p className="text-xs text-muted">{t("meaningHint")}</p>
      <div className="grid gap-2 md:grid-cols-3">
        {(["uz", "en", "ru"] as const).map((l) => (
          <TextField
            key={l}
            id={`meaning-${word.id}-${l}`}
            label={`${t("meaning")} · ${l.toUpperCase()}`}
            lang={l}
            maxLength={400}
            value={m[l]}
            onChange={(e) => setM({ ...m, [l]: e.target.value })}
          />
        ))}
      </div>
      <TextField id={`related-${word.id}`} label={t("related")} lang="uz" value={related} onChange={(e) => setRelated(e.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {t("save")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
