import { after } from 'next/server'
import { ingestMessage } from '@/lib/contracts'
import { readEnv } from '@/lib/env'
import { DEFAULT_PROJECT_ID } from '@/lib/memory'
import { createSlackClient } from '@/lib/slack/client'
import { verifySlackSignature } from '@/lib/slack/verify'
import { maybeWarn } from '@/lib/slack/warn'

export const maxDuration = 60

interface SlackMessageEvent {
  type: string
  subtype?: string
  bot_id?: string
  user?: string
  text?: string
  ts: string
  thread_ts?: string
  channel: string
  client_msg_id?: string
}

export async function POST(request: Request) {
  const body = await request.text()
  const valid = verifySlackSignature({
    secret: readEnv().SLACK_SIGNING_SECRET,
    timestamp: request.headers.get('x-slack-request-timestamp'),
    signature: request.headers.get('x-slack-signature'),
    body,
  })
  if (!valid) return Response.json({ error: 'invalid signature' }, { status: 401 })

  const payload = JSON.parse(body) as { type: string; challenge?: string; event?: SlackMessageEvent }
  if (payload.type === 'url_verification') return Response.json({ challenge: payload.challenge })

  const event = payload.event
  if (payload.type !== 'event_callback' || event?.type !== 'message' || event.subtype || event.bot_id || !event.text) {
    return Response.json({ ok: true })
  }

  after(async () => {
    try {
      const result = await ingestMessage({
        projectId: DEFAULT_PROJECT_ID,
        source: 'slack',
        sourceId: `${event.channel}:${event.ts}`,
        threadId: event.thread_ts ?? event.ts,
        author: event.user ?? 'unknown',
        text: event.text as string,
        postedAt: new Date(Number(event.ts) * 1000).toISOString(),
      })
      const client = createSlackClient()
      if (!result.duplicate && client) await maybeWarn({ message: result.message, label: result.label, channel: event.channel, client })
    } catch (error) {
      console.error('[slack] event processing failed', error)
    }
  })
  return Response.json({ ok: true })
}
