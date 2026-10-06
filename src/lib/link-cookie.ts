import { cookies } from "next/headers";
import { getLink, type SurveyLink } from "./repo/links";

/** httpOnly cookie holding the survey-link code a visitor arrived through (/s/<code>). */
export const LINK_COOKIE = "mx_link";
export const LINK_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** The active survey link this visitor came through, if any. */
export async function currentLink(): Promise<SurveyLink | null> {
  const code = (await cookies()).get(LINK_COOKIE)?.value;
  const link = await getLink(code);
  return link?.active ? link : null;
}
