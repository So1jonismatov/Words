import { NextResponse, type NextRequest } from "next/server";
import { LINK_COOKIE, LINK_COOKIE_MAX_AGE } from "@/lib/link-cookie";
import { getLink } from "@/lib/repo/links";

/**
 * GET /s/<code> — entry point of a survey link. Remembers the link in an httpOnly
 * cookie and sends the visitor to the landing page. Participants who then start
 * the survey get cue words from this link's word set.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = /^[A-Za-z0-9]{4,32}$/.test(code) ? await getLink(code) : null;
  if (!link?.active) {
    const res = NextResponse.redirect(new URL("/?link=inactive", req.url), 303);
    res.cookies.delete(LINK_COOKIE);
    return res;
  }
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(LINK_COOKIE, link.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LINK_COOKIE_MAX_AGE,
  });
  return res;
}
