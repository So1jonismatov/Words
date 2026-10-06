import { headers } from "next/headers";
import { hmac } from "./secret";

/**
 * In-memory fixed-window rate limiter. Client IPs are never stored: the key is an
 * HMAC of (IP + current hour) with SESSION_SECRET, so it rotates hourly and cannot
 * be reversed, and entries expire with their window. On multi-instance deployments
 * each instance limits independently, which is fine for abuse prevention.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const hour = Math.floor(Date.now() / 3_600_000);
  return `${scope}:${hmac(`${ip}|${hour}`).slice(0, 22)}`;
}

/** Returns true when the request is allowed. */
export async function rateLimit(scope: string, limit: number, windowMs: number): Promise<boolean> {
  return hit(await clientKey(scope), limit, windowMs);
}
