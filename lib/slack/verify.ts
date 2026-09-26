import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_AGE_SECONDS = 60 * 5

export function signSlackRequest(secret: string, timestamp: string, body: string): string {
  return `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`
}

export function verifySlackSignature(input: {
  secret: string | undefined
  timestamp: string | null
  signature: string | null
  body: string
  now?: number
}): boolean {
  const { secret, timestamp, signature, body } = input
  if (!secret || !timestamp || !signature) return false
  const seconds = Number(timestamp)
  const now = Math.floor((input.now ?? Date.now()) / 1000)
  if (!Number.isFinite(seconds) || Math.abs(now - seconds) > MAX_AGE_SECONDS) return false
  const expected = Buffer.from(signSlackRequest(secret, timestamp, body))
  const received = Buffer.from(signature)
  return expected.length === received.length && timingSafeEqual(expected, received)
}
