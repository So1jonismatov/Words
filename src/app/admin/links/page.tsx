import { isAdmin } from "@/lib/admin-auth";
import { displayUz } from "@/lib/normalize";
import { listLinks } from "@/lib/repo/links";
import { listWords } from "@/lib/repo/words";
import { getSettings } from "@/lib/settings";
import { LinksManager } from "./links-manager";

export default async function AdminLinksPage() {
  if (!(await isAdmin())) return null;
  const [links, words, settings] = await Promise.all([listLinks(), listWords(), getSettings()]);
  return (
    <LinksManager
      links={links}
      words={words.map((w) => ({ id: w.id, display: displayUz(w.text), active: w.active }))}
      defaultPerParticipant={settings.cuesPerParticipant}
    />
  );
}
