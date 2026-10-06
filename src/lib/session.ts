import { cookies } from "next/headers";
import { findParticipantByToken } from "./repo/participants";

/** httpOnly cookie holding the participant's random session token (only its SHA-256 is stored). */
export const SESSION_COOKIE = "mx_session";

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function currentParticipant() {
  return findParticipantByToken(await sessionToken());
}

/** Where a participant should be in the flow. */
export type Stage = "start" | "survey" | "game" | "results";

export function stageOf(p: Awaited<ReturnType<typeof currentParticipant>>): Stage {
  if (!p) return "start";
  if (!p.surveyCompletedAt) return "survey";
  if (!p.completedAt) return "game";
  return "results";
}
