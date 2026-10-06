"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveSettingsAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField, TextField, Textarea } from "@/components/ui/fields";
import { LOCALES, type Locale } from "@/lib/options";
import type { Settings } from "@/lib/settings";
import { cn } from "@/lib/utils";

const LANG_NAMES: Record<Locale, string> = { uz: "Oʻzbekcha", en: "English", ru: "Русский" };

export function SettingsForm({ initial }: { initial: Settings }) {
  const t = useTranslations("admin.settings");
  const tRoot = useTranslations();
  const [s, setS] = useState(initial);
  const [countries, setCountries] = useState(initial.countries.join(", "));
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...s,
      countries: countries
        .split(/[\s,;]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    };
    startTransition(async () => {
      const res = await saveSettingsAction(payload);
      setMessage(res.ok ? { text: t("saved") } : { text: tRoot(res.error), error: true });
    });
  };

  return (
    <form onSubmit={save} className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
      <div className="scroll-thin grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-2 lg:overflow-visible">
        <Card className="scroll-thin space-y-2.5 rounded-3xl p-4 sm:p-5 lg:overflow-y-auto">
          <TextField id="siteTitle" label={t("siteTitle")} maxLength={80} value={s.siteTitle} onChange={(e) => setS({ ...s, siteTitle: e.target.value })} />
          <div className="grid grid-cols-2 gap-2.5">
            <TextField
              id="cues"
              label={t("cuesPerParticipant")}
              type="number"
              min={1}
              max={100}
              value={s.cuesPerParticipant}
              onChange={(e) => setS({ ...s, cuesPerParticipant: Number(e.target.value) })}
            />
            <SelectField id="rpc" label={t("responsesPerCue")} value={s.responsesPerCue} onChange={(e) => setS({ ...s, responsesPerCue: Number(e.target.value) })}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </SelectField>
          </div>
          <TextField
            id="countries"
            label={t("countries")}
            value={countries}
            onChange={(e) => setCountries(e.target.value)}
            aria-describedby="countries-hint"
          />
          <p id="countries-hint" className="px-1 text-xs text-muted">
            {t("countriesHint")}
          </p>
          <fieldset className="pt-1">
            <legend className="px-1 text-[13px] font-semibold text-muted">{t("languages")}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {LOCALES.map((l) => {
                const on = s.enabledLanguages.includes(l);
                return (
                  <label
                    key={l}
                    className={cn(
                      "tap flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-(--ring)",
                      on ? "bg-accent-soft text-fg" : "bg-card-3 text-muted",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={(e) =>
                        setS({
                          ...s,
                          enabledLanguages: e.target.checked
                            ? LOCALES.filter((x) => x === l || s.enabledLanguages.includes(x))
                            : s.enabledLanguages.filter((x) => x !== l),
                        })
                      }
                    />
                    {on ? "✓" : "+"} {LANG_NAMES[l]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-2.5 pt-3">
            <div className="px-1">
              <p className="text-sm font-semibold">{t("study")}</p>
              <p className="text-xs text-muted">{t("studyHint")}</p>
            </div>
            <TextField
              id="studyInstitution"
              label={t("studyInstitution")}
              maxLength={200}
              value={s.studyInstitution}
              onChange={(e) => setS({ ...s, studyInstitution: e.target.value })}
            />
            <TextField
              id="studyContact"
              label={t("studyContact")}
              maxLength={200}
              value={s.studyContact}
              onChange={(e) => setS({ ...s, studyContact: e.target.value })}
            />
            <TextField
              id="ethicsApproval"
              label={t("ethicsApproval")}
              maxLength={300}
              value={s.ethicsApproval}
              onChange={(e) => setS({ ...s, ethicsApproval: e.target.value })}
            />
          </div>
        </Card>

        <Card className="scroll-thin flex min-h-0 flex-col gap-2.5 rounded-3xl p-4 sm:p-5 lg:overflow-y-auto">
          <div className="px-1">
            <p className="text-sm font-semibold">{t("consent")}</p>
            <p className="text-xs text-muted">{t("consentHint")}</p>
          </div>
          {LOCALES.map((l) => (
            <div key={l}>
              <label htmlFor={`consent-${l}`} className="mb-1 block px-1 text-[13px] font-semibold text-muted">
                {LANG_NAMES[l]}
              </label>
              <Textarea
                id={`consent-${l}`}
                lang={l}
                rows={3}
                className="min-h-0 text-sm"
                value={s.consentText[l]}
                onChange={(e) => setS({ ...s, consentText: { ...s.consentText, [l]: e.target.value } })}
              />
            </div>
          ))}

          <div className="px-1 pt-3">
            <p className="text-sm font-semibold">{t("retention")}</p>
            <p className="text-xs text-muted">{t("retentionHint")}</p>
          </div>
          {LOCALES.map((l) => (
            <div key={l}>
              <label htmlFor={`retention-${l}`} className="mb-1 block px-1 text-[13px] font-semibold text-muted">
                {LANG_NAMES[l]}
              </label>
              <Textarea
                id={`retention-${l}`}
                lang={l}
                rows={2}
                className="min-h-0 text-sm"
                value={s.dataRetention[l]}
                onChange={(e) => setS({ ...s, dataRetention: { ...s.dataRetention, [l]: e.target.value } })}
              />
            </div>
          ))}
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
        {message && (
          <p role="status" className={message.error ? "text-sm text-danger" : "text-sm text-teal"}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
