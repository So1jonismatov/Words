"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Error boundary for the admin area: a failed query shows a short explanation and a
 * retry button instead of a blank page. The digest matches the server log entry.
 */
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("admin.error");
  return (
    <div className="flex flex-1 items-center justify-center">
      <Card className="w-full max-w-lg p-6 text-center">
        <h1 className="text-lg font-extrabold">{t("title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("text")}</p>
        {error.digest && <p className="mt-3 font-mono text-xs text-muted">{t("digest", { digest: error.digest })}</p>}
        <Button className="mt-5" onClick={() => retry()}>
          {t("retry")}
        </Button>
      </Card>
    </div>
  );
}
