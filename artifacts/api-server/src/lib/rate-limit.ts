import type { Request, RequestHandler } from "express";

/**
 * In-memory sliding-window rate limiter.
 *
 * Single-process only. That is a real limit: run more than one api-server
 * instance and each keeps its own counters, so the effective ceiling multiplies
 * by the instance count. Adequate for the current single-instance deployment;
 * move to Redis before scaling out.
 *
 * Extracted from `routes/activation.ts`, which had this inline. Login needed
 * the same thing and a second copy would have drifted.
 */

export function clientIp(req: Request): string {
  // Behind Cloudflare / a local router, req.ip is the proxy. Trust the first
  // XFF hop for bucketing only — never for authorization.
  const xff = req.headers["x-forwarded-for"];
  const xffStr = Array.isArray(xff) ? xff[0] : xff;
  return xffStr?.split(",")[0]?.trim() || req.ip || "unknown";
}

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  /**
   * Bucket key. Defaults to client IP. Return a composite (e.g. ip + account)
   * when limiting one actor must not lock out everyone else.
   */
  keyFor?: (req: Request) => string;
  message?: string;
};

export function createRateLimit(opts: RateLimitOptions): RequestHandler {
  const { windowMs, max, keyFor = clientIp, message = "Too many requests" } = opts;
  const buckets = new Map<string, number[]>();

  return (req, res, next) => {
    const key = keyFor(req);
    const now = Date.now();
    const cutoff = now - windowMs;
    const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);

    if (hits.length >= max) {
      const retryAfterMs = hits[0] + windowMs - now;
      res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
      res.status(429).json({ error: message, retryAfterMs });
      return;
    }

    hits.push(now);
    buckets.set(key, hits);

    // Bound the map. Without this a spray across many keys grows it forever.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        const kept = v.filter((t) => t > cutoff);
        if (kept.length === 0) buckets.delete(k);
        else buckets.set(k, kept);
      }
    }
    next();
  };
}
