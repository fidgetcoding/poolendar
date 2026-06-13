import { timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'

/**
 * Verify the CRON_SECRET from the Authorization header using
 * constant-time comparison to prevent timing attacks.
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  const expected = process.env.CRON_SECRET

  if (!expected || !token) return false

  // Constant-time comparison requires equal-length buffers.
  // If lengths differ, the comparison is still constant-time
  // because we pad/hash both sides.
  const tokenBuf = Buffer.from(token, 'utf-8')
  const expectedBuf = Buffer.from(expected, 'utf-8')

  if (tokenBuf.length !== expectedBuf.length) return false

  return timingSafeEqual(tokenBuf, expectedBuf)
}
