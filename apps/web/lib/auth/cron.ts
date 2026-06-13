import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'

export function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  const expected = process.env.CRON_SECRET

  if (!expected || !token) return false

  // Hash both values to fixed-length digests so timingSafeEqual
  // never leaks the secret's length via an early return.
  const hmacKey = 'poolendar-cron-verify'
  const tokenHash = createHmac('sha256', hmacKey).update(token).digest()
  const expectedHash = createHmac('sha256', hmacKey).update(expected).digest()

  return timingSafeEqual(tokenHash, expectedHash)
}
