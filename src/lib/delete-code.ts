import crypto from "node:crypto";

/**
 * Delete codes let a participant remove their answers after losing the session cookie
 * (another browser, cleared cookies). The code is derived from the random session token,
 * so the results page can show the same code on every visit without storing it; the
 * database keeps only sha256 of the code, exactly like the token itself.
 *
 * 12 characters from an alphabet without look-alikes (no 0/O, 1/I/L), shown as
 * XXXX-XXXX-XXXX: 60 bits, plenty against guessing with the action's rate limit.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 letters/digits; no 0 O 1 I L
const LENGTH = 12;

export function deleteCodeFor(token: string): string {
  const bytes = crypto.createHash("sha256").update(`mx-delete-code:${token}`).digest();
  let code = "";
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return formatDeleteCode(code);
}

export function formatDeleteCode(code: string): string {
  return code.match(/.{1,4}/g)!.join("-");
}

/** Accepts any casing, spaces or dashes. Null if it can't be a code. */
export function normalizeDeleteCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s\-_.]/g, "");
  if (s.length !== LENGTH || [...s].some((ch) => !ALPHABET.includes(ch))) return null;
  return s;
}

/** Hash of a code in either form (with or without dashes). */
export function hashDeleteCode(code: string): string {
  return crypto.createHash("sha256").update(`mx-delete-code-hash:${code.replace(/-/g, "")}`).digest("hex");
}
