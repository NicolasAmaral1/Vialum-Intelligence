/**
 * Simple in-memory sliding-window rate limiter.
 * No external dependencies — just a Map of timestamp arrays.
 */
const windows = new Map<string, number[]>();

/**
 * Check if a request is allowed under the rate limit.
 * Returns true if allowed, false if rate-limited.
 *
 * @param key - Unique key (e.g. "accountId:provider")
 * @param maxPerMinute - Maximum requests allowed per 60-second window
 */
export function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const timestamps = (windows.get(key) ?? []).filter((t) => now - t < 60_000);

  if (timestamps.length >= maxPerMinute) {
    windows.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  windows.set(key, timestamps);
  return true;
}

/**
 * Throws if rate-limited. Convenience wrapper around checkRateLimit.
 */
export function enforceRateLimit(key: string, maxPerMinute: number): void {
  if (!checkRateLimit(key, maxPerMinute)) {
    throw {
      statusCode: 429,
      message: `Rate limit exceeded (${maxPerMinute} req/min). Try again shortly.`,
      code: 'RATE_LIMIT_EXCEEDED',
    };
  }
}
