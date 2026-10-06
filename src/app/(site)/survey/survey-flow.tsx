"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { saveSurveyStep, type SurveyStepInput } from "@/actions/survey";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/card";
import { ChoiceOption } from "@/components/ui/choice";
import { Input } from "@/components/ui/fields";
import { Q2_MAX, Q2_OPTIONS, Q3_OPTIONS, Q4_OPTIONS } from "@/lib/options";

interface Answers {
  q1Text: string;
  q2Choices: string[];
  q2Other: string;
  q3: string;
  q4: string;
}

const TOTAL = 4;

export function SurveyFlow({ initial, startStep }: { initial: Answers; startStep: number }) {
  const t = useTranslations("survey");
  const tc = useTranslations("common");
  const to = useTranslations("options");
  const tRoot = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState(startStep);
  const [a, setA] = useState<Answers>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const payload = (): SurveyStepInput | string => {
    switch (step) {
      case 1:
        return a.q1Text.trim() ? { step: 1, q1Text: a.q1Text.trim() } : t("answerRequired");
      case 2:
        if (a.q2Choices.length === 0) return t("answerRequired");
        if (a.q2Choices.includes("other") && !a.q2Other.trim()) return t("otherRequired");
        return {
          step: 2,
          q2Choices: a.q2Choices as Extract<SurveyStepInput, { step: 2 }>["q2Choices"],
          q2Other: a.q2Choices.includes("other") ? a.q2Other.trim() : null,
        };
      case 3:
        return a.q3 ? { step: 3, q3: a.q3 as (typeof Q3_OPTIONS)[number] } : t("answerRequired");
      default:
        return a.q4 ? { step: 4, q4: a.q4 as (typeof Q4_OPTIONS)[number] } : t("answerRequired");
    }
  };

  const next = (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = payload();
    if (typeof p === "string") {
      setError(p);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveSurveyStep(p);
      if (!res.ok) {
        setError(tRoot(res.error));
        return;
      }
      if (step === TOTAL) router.push("/game");
      else setStep(step + 1);
    });
  };

  const toggleChoice = (key: string) =>
    setA((prev) => {
      const has = prev.q2Choices.includes(key);
      if (!has && prev.q2Choices.length >= Q2_MAX) return prev;
      return { ...prev, q2Choices: has ? prev.q2Choices.filter((c) => c !== key) : [...prev.q2Choices, key] };
    });

  const question = t(`q${step}` as "q1");
  const atMax = a.q2Choices.length >= Q2_MAX;
  const progress = t("progress", { current: step, total: TOTAL });

  return (
    <form onSubmit={next} noValidate className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center gap-3">
        <span className="shrink-0 text-[13px] font-semibold text-muted tabular-nums">{progress}</span>
        <ProgressBar value={step - 1} max={TOTAL} label={progress} />
      </div>

      <fieldset key={step} className="animate-enter min-w-0 flex-1">
        <legend className="contents">
          <h1 ref={headingRef} tabIndex={-1} className="max-w-[40rem] text-lg leading-snug font-bold text-pretty outline-none sm:text-xl">
            {question}
          </h1>
        </legend>

        <div className="mt-4">
          {step === 1 && (
            <div className="space-y-1.5">
              <Input
                aria-label={question}
                aria-describedby="q1-hint"
                autoFocus
                maxLength={80}
                autoComplete="off"
                autoCapitalize="none"
                enterKeyHint="next"
                placeholder={t("q1Placeholder")}
                value={a.q1Text}
                onChange={(e) => setA({ ...a, q1Text: e.target.value })}
              />
              <p id="q1-hint" className="px-1 text-[13px] text-muted">
                {t("q1Hint")}
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 px-1 text-[13px]">
                <span className="text-muted">{t("q2Hint")}</span>
                <span aria-live="polite" className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-bold text-accent tabular-nums">
                  {t("q2Counter", { count: a.q2Choices.length, max: Q2_MAX })}
                </span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {[...Q2_OPTIONS, "other" as const].map((key) => {
                  const checked = a.q2Choices.includes(key);
                  return (
                    <ChoiceOption
                      key={key}
                      type="checkbox"
                      name="q2"
                      value={key}
                      checked={checked}
                      disabled={!checked && atMax}
                      onChange={() => toggleChoice(key)}
                      label={to(`q2.${key}`)}
                    />
                  );
                })}
                {a.q2Choices.includes("other") && (
                  <Input
                    aria-label={to("q2.other")}
                    autoFocus
                    maxLength={80}
                    placeholder={t("q2OtherPlaceholder")}
                    value={a.q2Other}
                    onChange={(e) => setA({ ...a, q2Other: e.target.value })}
                  />
                )}
              </div>
            </div>
          )}

          {(step === 3 || step === 4) && (
            <div className="grid gap-1.5" role="radiogroup" aria-label={question}>
              {(step === 3 ? Q3_OPTIONS : Q4_OPTIONS).map((key) => {
                const field = step === 3 ? "q3" : "q4";
                return (
                  <ChoiceOption
                    key={key}
                    type="radio"
                    name={field}
                    value={key}
                    checked={a[field] === key}
                    onChange={() => setA({ ...a, [field]: key })}
                    label={to(`${field}.${key}`)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </fieldset>

      {/* Reserved line: a message never pushes the buttons down. */}
      <div className="mt-3 min-h-5 px-1" aria-live="assertive">
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => (setError(null), setStep(step - 1))} disabled={pending}>
            ← {tc("back")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending} className="min-w-32">
          {pending ? tc("saving") : step === TOTAL ? t("finish") : `${tc("next")} →`}
        </Button>
      </div>
    </form>
  );
}
