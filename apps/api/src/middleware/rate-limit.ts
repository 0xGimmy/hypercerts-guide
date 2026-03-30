import type { Context, Next } from 'hono'

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Per-isolate rate limiter. On CF Workers each isolate is short-lived,
// so this provides basic burst protection, not a global rate limit.
// For production-grade limiting, configure Cloudflare Rate Limiting rules.
const hits = new Map<string, RateLimitEntry>()
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key)
  }
}

export function rateLimit(windowMs = 60_000, maxRequests = 60) {
  return async (c: Context, next: Next) => {
    cleanup()

    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown'

    const key = `${ip}:${maxRequests}`
    const now = Date.now()

    let entry = hits.get(key)
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(key, entry)
    }

    entry.count++

    c.header('X-RateLimit-Limit', maxRequests.toString())
    c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString())

    if (entry.count > maxRequests) {
      return c.json({ error: 'Too many requests' }, 429)
    }

    return next()
  }
}
