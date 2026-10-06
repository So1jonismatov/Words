"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteByCode, deleteMyData } from "@/actions/participant";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/fields";

/** "Delete my data": for this browser's session, or by the delete code from the results page. */
export function DeleteData({ hasData }: { hasData: boolean }) {
  const t = useTranslations("about");
  const tc = useTranslations("common");
  const [stage, setStage] = useState<"idle" | "confirm" | "done" | "error">("idle");
  const [pending, startTransition] = useTransition();

  // Checked before hasData: deleting clears the session cookie, so the page re-renders with hasData=false.
  if (stage === "done") {
    return (
      <p role="status" className="mt-2 text-sm font-semibold text-teal">
        {t("deleteDone")}
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-4">
      {hasData ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-muted">{t("deleteText")}</p>
          {stage === "error" && (
            <p role="alert" className="text-sm text-danger">
              {tc("errorGeneric")}
            </p>
          )}
          {stage === "confirm" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteMyData();
                    setStage(res.ok ? "done" : "error");
                  })
                }
              >
                {pending ? tc("saving") : t("deleteConfirm")}
              </Button>
              <Button variant="plain" onClick={() => setStage("idle")} disabled={pending}>
                {t("deleteCancel")}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setStage("confirm")}>
              {t("deleteButton")}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">{t("deleteNone")}</p>
      )}
      <DeleteByCode onDone={() => setStage("done")} />
    </div>
  );
}

function DeleteByCode({ onDone }: { onDone: () => void }) {
  const t = useTranslations("about");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const res = await deleteByCode(code);
      if (res.ok) onDone();
      else {
        setConfirming(false);
        setError(tRoot(res.error));
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl bg-card-3 p-3" noValidate>
      <p className="text-[13px] leading-relaxed text-muted">{t("deleteCodeText")}</p>
      <TextField
        id="delete-code"
        label={t("deleteCodeLabel")}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setConfirming(false);
          setError(null);
        }}
        placeholder="XXXX-XXXX-XXXX"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "delete-code-error" : undefined}
        className="font-mono tracking-wider uppercase"
      />
      <div className="min-h-5" aria-live="assertive">
        {error && (
          <p id="delete-code-error" role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant={confirming ? "danger" : "secondary"} size="sm" disabled={pending || !code.trim()}>
          {pending ? tc("saving") : confirming ? t("deleteConfirm") : t("deleteCodeButton")}
        </Button>
        {confirming && (
          <Button variant="plain" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
            {t("deleteCancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
