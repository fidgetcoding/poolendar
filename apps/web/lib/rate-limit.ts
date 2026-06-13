const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

export function getRateLimitHeaders(key: string, limit: number, windowMs: number) {
  const entry = rateLimitMap.get(key)
  const remaining = entry ? Math.max(0, limit - entry.count) : limit
  const reset = entry ? Math.ceil((entry.resetTime - Date.now()) / 1000) : Math.ceil(windowMs / 1000)
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(reset),
  }
}
