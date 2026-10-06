import { getTranslations } from "next-intl/server";
import { isAdmin } from "@/lib/admin-auth";
import { displayUz } from "@/lib/normalize";
import { listWords } from "@/lib/repo/words";
import { WordsEditor } from "./words-editor";

export default async function AdminWordsPage() {
  if (!(await isAdmin())) return null;
  const [words, t] = await Promise.all([listWords(), getTranslations("admin.words")]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h1 className="text-lg font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-xs text-muted">{t("summary", { active: words.filter((w) => w.active).length, total: words.length })}</p>
      </div>
      <WordsEditor words={words.map((w) => ({ ...w, display: displayUz(w.text) }))} />
    </div>
  );
}
