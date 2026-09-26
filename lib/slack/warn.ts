import { randomUUID } from 'node:crypto'
import { checkDeadEnds, getActiveHarness } from '../contracts'
import { collection, isDbConfigured } from '../db'
import type { DeadEndMatch, Message, MessageLabel, Warning } from '../types'
import type { SlackClient } from './client'

// Owner: Recall lane (f-b-05).

const WARNABLE: MessageLabel[] = ['intent', 'attempt_start', 'question']

export function warningBlocks(match: DeadEndMatch, warningId: string) {
  const { attempt } = match
  const blocker = attempt.blockers[0]
  const evidence = attempt.evidence.map((item) => `• ${item.kind}: ${item.summary}`).join('\n')
  const lines = [
    `*Heads up — the team already tried this.* ${attempt.approach} (${attempt.outcome}).`,
    blocker ? `*Blocker:* ${blocker.detail}` : '',
    evidence ? `*Evidence:*\n${evidence}` : '',
    attempt.alternative ? `*What worked instead:* ${attempt.alternative}` : '',
    `*Hours this could save:* ${match.hoursSaved} · confidence ${Math.round(match.confidence * 100)}%`,
  ].filter(Boolean)
  return [
    { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
    {
      type: 'actions',
      elements: [{ type: 'button', action_id: 'not_relevant', text: { type: 'plain_text', text: 'Not relevant' }, value: warningId }],
    },
  ]
}

export async function maybeWarn(input: {
  message: Message
  label: MessageLabel
  channel: string
  client: SlackClient
}): Promise<Warning | undefined> {
  const { message, label, channel, client } = input
  if (!WARNABLE.includes(label)) return undefined
  const [match] = await checkDeadEnds(message.projectId, message.text)
  if (!match) return undefined

  const harness = await getActiveHarness(message.projectId)
  const warning: Warning = {
    _id: `warn-${randomUUID().slice(0, 8)}`,
    projectId: message.projectId,
    attemptId: match.attempt._id,
    messageId: message._id,
    channel: 'slack',
    confidence: match.confidence,
    hoursSaved: match.hoursSaved,
    harnessVersion: harness.version,
    createdAt: new Date().toISOString(),
  }
  const posted = await client.postMessage({
    channel,
    thread_ts: message.threadId,
    text: `The team already tried ${match.attempt.approach}. ${match.attempt.alternative ? `Instead: ${match.attempt.alternative}.` : ''}`,
    blocks: warningBlocks(match, warning._id),
  })
  if (!posted.ok) throw new Error(`Slack postMessage failed: ${posted.error}`)
  if (isDbConfigured()) await (await collection('warnings')).insertOne(warning)
  return warning
}
