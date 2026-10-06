"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { adminLogin } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/fields";

export function LoginForm() {
  const t = useTranslations("admin.login");
  const tRoot = useTranslations();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-xl font-extrabold tracking-tight">{t("title")}</h1>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await adminLogin(password);
            if (res.ok) router.refresh();
            else setError(tRoot(res.error));
          });
        }}
      >
        <TextField
          id="admin-password"
          label={t("password")}
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(error)}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending || !password}>
          {t("submit")}
        </Button>
      </form>
    </Card>
  );
}
