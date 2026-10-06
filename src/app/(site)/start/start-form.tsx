"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startParticipation } from "@/actions/participant";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/fields";
import { AGE_GROUPS, BACKGROUNDS, EDUCATION, GENDERS, OTHER_COUNTRY, UZ_REGIONS } from "@/lib/options";

export interface Option {
  code: string;
  label: string;
}

interface FormState {
  ageGroup: string;
  gender: string;
  country: string;
  countryOther: string;
  region: string;
  education: string;
  background: string;
}

const EMPTY: FormState = { ageGroup: "", gender: "", country: "", countryOther: "", region: "", education: "", background: "" };

export function StartForm({
  countries,
  regions,
  consent,
  initial,
}: {
  countries: Option[];
  /** Uzbekistan's regions, already sorted by their translated name. */
  regions: Option[];
  consent: string[];
  initial: FormState | null;
}) {
  const t = useTranslations("start");
  const tc = useTranslations("common");
  const to = useTranslations("options");
  const tRoot = useTranslations();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial ?? EMPTY);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const under18 = form.ageGroup === "under18";
  const ready =
    Boolean(form.ageGroup) &&
    !under18 &&
    Boolean(form.country) &&
    (form.country !== OTHER_COUNTRY || form.countryOther.trim().length > 0) &&
    agreed;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) {
      setError(t("missing"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await startParticipation({
        ageGroup: form.ageGroup as (typeof AGE_GROUPS)[number],
        gender: (form.gender || null) as (typeof GENDERS)[number] | null,
        country: form.country,
        countryOther: form.country === OTHER_COUNTRY ? form.countryOther.trim() : null,
        region: form.country === "UZ" && form.region ? (form.region as (typeof UZ_REGIONS)[number]) : null,
        education: (form.education || null) as (typeof EDUCATION)[number] | null,
        background: (form.background || null) as (typeof BACKGROUNDS)[number] | null,
        consent: true,
      });
      if (res.ok) router.push("/survey");
      else setError(res.error === "under18" ? t("under18Text") : tRoot(res.error));
    });
  };

  const optional = tc("optional");
  const placeholder = <option value="">{tc("select")}</option>;

  return (
    <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
        <SelectField id="age" label={t("age")} required aria-required value={form.ageGroup} onChange={set("ageGroup")}>
          <option value="" disabled>
            {tc("select")}
          </option>
          {AGE_GROUPS.map((a) => (
            <option key={a} value={a}>
              {to(`ageGroup.${a}`)}
            </option>
          ))}
        </SelectField>

        {!under18 && (
          <>
            <SelectField id="gender" label={t("gender")} optional={optional} value={form.gender} onChange={set("gender")}>
              {placeholder}
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {to(`gender.${g}`)}
                </option>
              ))}
            </SelectField>

            <div className="col-span-2 sm:col-span-1">
              <SelectField id="country" label={t("country")} required aria-required value={form.country} onChange={set("country")}>
                <option value="" disabled>
                  {tc("select")}
                </option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </SelectField>
            </div>

            {form.country === OTHER_COUNTRY ? (
              <TextField
                id="countryOther"
                label={t("countryOther")}
                maxLength={80}
                required
                value={form.countryOther}
                onChange={set("countryOther")}
                autoComplete="off"
              />
            ) : (
              <SelectField
                id="region"
                label={t("region")}
                optional={optional}
                value={form.region}
                onChange={set("region")}
                disabled={form.country !== "UZ"}
              >
                {placeholder}
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </SelectField>
            )}

            <SelectField id="education" label={t("education")} optional={optional} value={form.education} onChange={set("education")}>
              {placeholder}
              {EDUCATION.map((e) => (
                <option key={e} value={e}>
                  {to(`education.${e}`)}
                </option>
              ))}
            </SelectField>

            <div className="col-span-2 sm:col-span-1">
              <SelectField
                id="background"
                label={t("background")}
                optional={optional}
                title={t("backgroundHint")}
                aria-description={t("backgroundHint")}
                value={form.background}
                onChange={set("background")}
              >
                {placeholder}
                {BACKGROUNDS.map((b) => (
                  <option key={b} value={b}>
                    {to(`background.${b}`)}
                  </option>
                ))}
              </SelectField>
            </div>
          </>
        )}
      </div>

      {under18 ? (
        <div role="status" className="animate-enter rounded-2xl bg-card-3 p-5 text-center">
          <p className="font-bold">{t("under18Title")}</p>
          <p className="mt-1 text-sm text-muted">{t("under18Text")}</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="consent-title" className="rounded-2xl bg-card-3 px-4 pt-3 pb-1">
            <h2 id="consent-title" className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">
              {t("consentTitle")}
            </h2>
            <ul
              id="consent-text"
              tabIndex={0}
              aria-labelledby="consent-title"
              className="scroll-thin mt-1.5 max-h-[4.6rem] space-y-1 overflow-y-auto pr-1 text-[13px] leading-relaxed text-muted sm:max-h-[5.5rem]"
            >
              {consent.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-accent" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex items-start gap-3 px-1 text-sm leading-snug">
            <input
              id="consent"
              type="checkbox"
              aria-describedby="consent-text"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 cursor-pointer accent-accent"
              required
              aria-required
            />
            <label htmlFor="consent" className="cursor-pointer">
              {t("consentCheckbox")}
            </label>
          </div>

          {/* Fixed-height slot so a message never pushes the button down. */}
          <div className="min-h-5 px-1" aria-live="assertive">
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!ready || pending}>
              {pending ? tc("saving") : t("submit")}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
