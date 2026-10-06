import { cookies } from "next/headers";
import { hmac, safeEqual } from "./secret";

export const ADMIN_COOKIE = "mx_admin";
const SESSION_MS = 8 * 60 * 60 * 1000;

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Compare fixed-length MACs so timing does not leak the password length.
  return safeEqual(hmac(input), hmac(expected));
}

export async function setAdminSession() {
  const exp = Date.now() + SESSION_MS;
  const store = await cookies();
  store.set(ADMIN_COOKIE, `${exp}.${hmac(`admin|${exp}`)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export function verifyAdminToken(value: string | undefined): boolean {
  if (!value) return false;
  const [expStr, sig] = value.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;
  return safeEqual(sig, hmac(`admin|${exp}`));
}

export async function isAdmin(): Promise<boolean> {
  return verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}
