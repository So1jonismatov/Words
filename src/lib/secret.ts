import crypto from "node:crypto";

let warned = false;

/** SESSION_SECRET signs the admin cookie and salts rate-limit keys. */
export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set (16+ characters) in production.");
  }
  if (!warned) {
    console.warn("[mx] SESSION_SECRET is not set; using an insecure development secret.");
    warned = true;
  }
  return "insecure-development-secret-do-not-use";
}

export function hmac(value: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
