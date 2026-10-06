import { getTranslations } from "next-intl/server";
import { isAdmin } from "@/lib/admin-auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  if (!(await isAdmin())) return null;
  const [settings, t] = await Promise.all([getSettings(), getTranslations("admin.settings")]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="px-1 text-lg font-extrabold tracking-tight">{t("title")}</h1>
      <SettingsForm initial={settings} />
    </div>
  );
}
