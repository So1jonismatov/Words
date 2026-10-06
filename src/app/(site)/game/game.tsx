"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { finishGame, saveCue, type SaveCueInput } from "@/actions/game";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow, ProgressBar } from "@/components/ui/card";
import { Input } from "@/components/ui/fields";
import { cn } from "@/lib/utils";
import { checkAnswer, type AnswerProblem } from "@/lib/validation";

export interface GameCue {
  cueId: number;
  /** Cue text prepared for display (Uzbek apostrophes). */
  display: string;
  done: boolean;
  /** Previously saved answers, used when going back. */
  answers: string[];
}

type Event = SaveCueInput["event"];

export function Game({
  cues,
  responsesPerCue,
  startIndex,
  showIntro,
}: {
  cues: GameCue[];
  responsesPerCue: number;
  startIndex: number;
  showIntro: boolean;
}) {
  const t = useTranslations("game");
  const tRoot = useTranslations();
  const router = useRouter();
  const total = cues.length;

  const [intro, setIntro] = useState(showIntro);
  const [index, setIndex] = useState(startIndex);
  const [wentBack, setWentBack] = useState(false);
  const savedAnswers = useRef(new Map(cues.map((c) => [c.cueId, c.answers])));
  const [values, setValues] = useState<string[]>(() => fill(savedAnswers.current.get(cues[startIndex]?.cueId) ?? [], responsesPerCue));
  const [invalid, setInvalid] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [finishing, setFinishing] = useState(false);

  /** Cues whose answers were sent (optimistically: a failed save removes the cue again). */
  const done = useRef(new Set(cues.filter((c) => c.done).map((c) => c.cueId)));
  /**
   * Saves run one after another in the background, so the next cue appears at once and
   * fast typists never type into a field that is about to be cleared.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());

  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const shownAt = useRef(0);
  const firstKeyAt = useRef<(number | null)[]>([]);

  const cue = cues[index];

  /**
   * Shows cue `i`: fills its saved answers, resets the timers and moves focus to the
   * first field in the same event, before the next keystroke can arrive. The inputs stay
   * mounted between cues, so nothing typed is lost.
   */
  const show = useCallback(
    (i: number, message: string | null = null) => {
      setIndex(i);
      setValues(fill(savedAnswers.current.get(cues[i]?.cueId) ?? [], responsesPerCue));
      setInvalid(message ? 0 : null);
      setError(message);
      shownAt.current = performance.now();
      firstKeyAt.current = blank(responsesPerCue).map(() => null);
      inputs.current[0]?.focus();
    },
    [cues, responsesPerCue],
  );

  useEffect(() => {
    if (!intro) show(index);
    // Only when the intro closes (or on first render without one).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro]);

  /** First cue without a saved answer, looking forward from `from` and then from the start. */
  const nextOpen = (from: number) => {
    for (let i = from; i < total; i++) if (!done.current.has(cues[i].cueId)) return i;
    for (let i = 0; i < from && i < total; i++) if (!done.current.has(cues[i].cueId)) return i;
    return total;
  };

  const finish = useCallback(() => {
    setFinishing(true);
    startTransition(async () => {
      await queue.current;
      const open = cues.findIndex((c) => !done.current.has(c.cueId));
      if (open !== -1) {
        // A background save failed; its cue was already shown again with the error.
        setFinishing(false);
        return;
      }
      const res = await finishGame();
      if (res.ok) router.push("/results");
      else {
        setFinishing(false);
        setError(tRoot(res.error));
      }
    });
  }, [cues, router, tRoot]);

  useEffect(() => {
    if (!intro && index >= total && !finishing && !error) finish();
  }, [index, total, intro, finishing, error, finish]);

  const problemMessage = (reason: AnswerProblem) => t(`errors.${reason}`);

  /** Validates the filled fields. Returns the cleaned answers or marks the first bad field. */
  const collect = (): string[] | null => {
    const answers: string[] = [];
    const seen: string[] = [];
    for (let i = 0; i < values.length; i++) {
      const v = values[i].trim();
      if (!v) continue;
      const check = checkAnswer(v, seen);
      if (!check.ok) {
        setInvalid(i);
        setError(problemMessage(check.reason));
        inputs.current[i]?.focus();
        return null;
      }
      seen.push(check.normalized);
      answers.push(v);
    }
    return answers;
  };

  const submit = (event: Event) => {
    if (finishing || !cue) return;
    const now = performance.now();
    let answers: string[] = [];
    let latencies: (number | null)[] = [];
    if (event !== "unknown" && event !== "skipped") {
      const collected = collect();
      if (!collected) return;
      if (collected.length === 0) {
        setInvalid(0);
        setError(problemMessage("empty"));
        inputs.current[0]?.focus();
        return;
      }
      answers = collected;
      latencies = values
        .map((v, i) => (v.trim() ? firstKeyAt.current[i] : undefined))
        .filter((x): x is number | null => x !== undefined);
      if (answers.length < responsesPerCue) event = "no_more";
    }
    const payload: SaveCueInput = {
      cueId: cue.cueId,
      answers: answers.map((text, i) => ({ text, latencyMs: latencies[i] ?? null })),
      event,
      eventLatencyMs: event ? Math.round(now - shownAt.current) : null,
    };
    const at = index;
    savedAnswers.current.set(cue.cueId, answers);
    done.current.add(cue.cueId);
    queue.current = queue.current.then(async () => {
      const res = await saveCue(payload).catch(() => ({ ok: false as const, error: "game.saveFailed" }));
      if (res.ok) return;
      // Bring the player back to the cue that failed, with their answers and the reason.
      done.current.delete(payload.cueId);
      show(at, tRoot(res.error));
    });
    setWentBack(false);
    show(nextOpen(at + 1));
  };

  const onKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const v = values[i].trim();
    if (!v) {
      if (i === 0) {
        setInvalid(0);
        setError(problemMessage("empty"));
      } else submit("no_more");
      return;
    }
    const seen = values
      .slice(0, i)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const c = checkAnswer(x);
        return c.ok ? c.normalized : x;
      });
    const check = checkAnswer(v, seen);
    if (!check.ok) {
      setInvalid(i);
      setError(problemMessage(check.reason));
      return;
    }
    setInvalid(null);
    setError(null);
    if (i < responsesPerCue - 1) inputs.current[i + 1]?.focus();
    else submit(null);
  };

  const onChange = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (firstKeyAt.current[i] == null && v.length > 0) firstKeyAt.current[i] = Math.round(performance.now() - shownAt.current);
    setValues((prev) => prev.map((x, j) => (j === i ? v : x)));
    if (invalid === i) {
      setInvalid(null);
      setError(null);
    }
  };

  const goBack = () => {
    if (index === 0 || wentBack || finishing) return;
    setWentBack(true);
    show(index - 1);
  };

  if (intro) {
    return (
      <Card className="animate-enter w-full max-w-xl p-5 sm:p-7">
        <Eyebrow>{t("progress", { current: 0, total })}</Eyebrow>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{t("introTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("introText")}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {[t("introRule1"), t("introRule2"), t("introRule3")].map((rule, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
        <Button size="lg" className="mt-6 w-full" autoFocus onClick={() => setIntro(false)}>
          {t("introStart")}
        </Button>
      </Card>
    );
  }

  if (!cue) {
    return (
      <Card className="w-full max-w-xl text-center">
        {error ? (
          <>
            <p role="alert" className="text-danger">
              {error}
            </p>
            <Button className="mt-6" onClick={() => (setError(null), finish())}>
              {t("finish")}
            </Button>
          </>
        ) : (
          <p className="text-muted" role="status">
            {tRoot("common.saving")}
          </p>
        )}
      </Card>
    );
  }

  const progressLabel = t("progress", { current: index + 1, total });
  const isLast = index === total - 1;

  return (
    <Card className="w-full max-w-xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-[13px] font-bold text-muted tabular-nums" aria-hidden>
          {progressLabel}
        </span>
        <ProgressBar value={index} max={total} label={progressLabel} />
        {index > 0 && !wentBack && (
          <button
            type="button"
            onClick={goBack}
            disabled={finishing}
            className="tap shrink-0 rounded-full px-2.5 py-1 text-[13px] text-muted transition-colors hover:bg-fg/8 hover:text-fg disabled:opacity-50"
          >
            ← {t("previous")}
          </button>
        )}
      </div>

      {/* Announces each new cue with its position; the visible counter above is aria-hidden. */}
      <p className="sr-only" aria-live="polite" aria-atomic>
        {progressLabel}: <span lang="uz">{cue.display}</span>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(null);
        }}
        noValidate
      >
        <div key={cue.cueId} className="animate-enter py-[clamp(0.75rem,4.5dvh,2.75rem)] text-center">
          <Eyebrow className="sr-only">{t("cueLabel")}</Eyebrow>
          <h1
            lang="uz"
            className="text-[clamp(2.1rem,min(13vw,10.5dvh),5.25rem)] leading-[1.05] font-extrabold tracking-tight break-words hyphens-auto"
          >
            {cue.display}
          </h1>
        </div>

        <div className="mx-auto max-w-md space-y-1.5">
          {values.map((v, i) => (
            <div key={i}>
              <label htmlFor={`r${i}`} className="sr-only">
                {t("responseLabel", { n: i + 1 })}
              </label>
              <Input
                id={`r${i}`}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={v}
                onChange={onChange(i)}
                onKeyDown={onKeyDown(i)}
                maxLength={60}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint={i < responsesPerCue - 1 ? "next" : "done"}
                aria-label={`${t("responseLabel", { n: i + 1 })}: ${cue.display}`}
                aria-invalid={invalid === i}
                aria-describedby={invalid === i ? "game-error" : undefined}
                placeholder={i === 0 ? t("placeholderFirst") : t("placeholderMore")}
                wrapperClassName={i === 0 ? undefined : "bg-card-3"}
                className={cn(i === 0 ? "h-12 text-[17px]" : "h-11 text-base")}
              />
            </div>
          ))}

          {/* Fixed height (two lines) so an error never moves the buttons. */}
          <div className="min-h-[2.5rem] px-1" aria-live="assertive">
            {error && (
              <p id="game-error" role="alert" className="text-[13px] leading-snug font-medium text-danger">
                {error}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={finishing}>
            {finishing ? tRoot("common.saving") : isLast ? t("finish") : `${t("next")} →`}
          </Button>

          <div className="flex flex-wrap justify-center gap-1.5 pt-1.5">
            <Button variant="secondary" size="sm" disabled={finishing} onClick={() => submit("no_more")}>
              {t("noMore")}
            </Button>
            <Button variant="secondary" size="sm" disabled={finishing} onClick={() => submit("unknown")}>
              {t("unknown")}
            </Button>
            <Button variant="plain" size="sm" disabled={finishing} onClick={() => submit("skipped")}>
              {t("skip")}
            </Button>
          </div>
          <p className="hidden pt-1 text-center text-xs text-muted sm:block">{t("enterHint")}</p>
        </div>
      </form>
    </Card>
  );
}

function blank(n: number): string[] {
  return Array.from({ length: n }, () => "");
}

function fill(prior: string[], n: number): string[] {
  return Array.from({ length: n }, (_, i) => prior[i] ?? "");
}
