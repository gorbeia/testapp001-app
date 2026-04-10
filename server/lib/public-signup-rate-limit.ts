type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory fixed-window rate limiter for unauthenticated public endpoints.
 * Key should be `req.ip` (requires `trust proxy` when behind nginx).
 */
export function createPublicSignupRateLimiter(options: { windowMs: number; max: number }) {
  const { windowMs, max } = options;

  return function allow(key: string): boolean {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || now >= b.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (b.count >= max) return false;
    b.count += 1;
    return true;
  };
}
