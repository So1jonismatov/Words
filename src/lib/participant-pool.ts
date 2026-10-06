import { getLink } from "./repo/links";
import type { CuePool } from "./repo/game";
import { getSettings } from "./settings";

/**
 * Where a participant's cues come from: their survey link's word set and size, or all
 * active words and the global "cues per participant" setting.
 */
export async function poolFor(participant: { linkId: string | null }): Promise<{ n: number; pool: CuePool }> {
  const link = await getLink(participant.linkId);
  if (link) return { n: link.cuesPerParticipant, pool: { cueIds: link.cueIds, linkId: link.id } };
  return { n: (await getSettings()).cuesPerParticipant, pool: {} };
}
