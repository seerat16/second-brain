import { describe, expect, it } from 'vitest'
import labeled from '@/fixtures/classify-labeled.json'
import { attemptExtraction, decisionExtraction } from '@/lib/capture/extract'
import { LABELS, labelByKeywords, parseLabel } from '@/lib/capture/classify'
import type { EvalRun } from '@/lib/recall/evals'
import { applyPatch, buildReflectionInput, decidePromotion } from '@/lib/recall/reflect'
import type { SlackClient, SlackPost } from '@/lib/slack/client'
import { signSlackRequest, verifySlackSignature } from '@/lib/slack/verify'
import { maybeWarn } from '@/lib/slack/warn'
import { getFixture } from '@/lib/fixtures'
import type { Feedback, HarnessScores, Message } from '@/lib/types'

const orbit = getFixture('orbit')!

describe('f-a-01 message classification', () => {
  it('parses a label out of a model reply', () => {
    expect(parseLabel('attempt_result')).toBe('attempt_result')
    expect(parseLabel('Label: "decision".')).toBe('decision')
    expect(parseLabel('I am not sure')).toBeUndefined()
  })

  it('keyword fallback labels the Orbit fixture messages correctly', () => {
    for (const message of orbit.messages) expect(labelByKeywords(message.text), message.text).toBe(message.label)
  })

  it('labeled set covers every label', () => {
    expect(labeled).toHaveLength(20)
    for (const label of LABELS) expect(labeled.some((item) => item.label === label)).toBe(true)
  })
})

describe('f-a-02 extraction schemas', () => {
  it('accepts an attempt with evidence given as plain strings and hours as text', () => {
    const parsed = attemptExtraction.parse({
      goal: 'Fast task search',
      approach: 'Postgres LIKE',
      outcome: 'abandoned',
      blockers: [{ type: 'performance', detail: '2.4s p95' }],
      evidence: [{ kind: 'benchmark', summary: 'p95 benchmark' }],
      hoursSpent: '9',
    })
    expect(parsed.hoursSpent).toBe(9)
    expect(parsed.alternative).toBeUndefined()
  })

  it('rejects an unknown outcome and normalizes a null supersede', () => {
    expect(() => attemptExtraction.parse({ goal: 'g', approach: 'a', outcome: 'worked' })).toThrow()
    expect(decisionExtraction.parse({ title: 't', rationale: 'r', supersedesId: null }).supersedesId).toBeUndefined()
  })
})

describe('f-a-06 Slack signature', () => {
  const secret = 'test-signing-secret'
  const body = '{"type":"event_callback"}'
  const now = Date.UTC(2026, 8, 26, 12)
  const timestamp = String(Math.floor(now / 1000))

  it('accepts a correctly signed request', () => {
    const signature = signSlackRequest(secret, timestamp, body)
    expect(verifySlackSignature({ secret, timestamp, signature, body, now })).toBe(true)
  })

  it('rejects a bad signature, a tampered body, a stale timestamp, and a missing secret', () => {
    const signature = signSlackRequest(secret, timestamp, body)
    expect(verifySlackSignature({ secret, timestamp, signature: 'v0=deadbeef', body, now })).toBe(false)
    expect(verifySlackSignature({ secret, timestamp, signature, body: `${body} `, now })).toBe(false)
    expect(verifySlackSignature({ secret, timestamp, signature, body, now: now + 10 * 60 * 1000 })).toBe(false)
    expect(verifySlackSignature({ secret: undefined, timestamp, signature, body, now })).toBe(false)
  })
})

function mockSlack() {
  const posts: SlackPost[] = []
  const client: SlackClient = {
    async postMessage(message) {
      posts.push(message)
      return { ok: true, ts: '1.0' }
    },
  }
  return { client, posts }
}

function slackMessage(text: string): Message {
  return {
    _id: 'msg-test',
    projectId: 'orbit',
    source: 'slack',
    sourceId: 'C1:1.0',
    threadId: '1.0',
    author: 'U1',
    text,
    postedAt: new Date().toISOString(),
  } as Message
}

describe('f-b-05 Slack proactive warning', () => {
  it('warns in the thread on the socket.io plan with evidence, alternative, and a Not relevant button', async () => {
    const { client, posts } = mockSlack()
    const warning = await maybeWarn({
      message: slackMessage('Going to add socket.io WebSockets to our serverless functions for live board updates.'),
      label: 'intent',
      channel: 'C1',
      client,
    })
    expect(posts).toHaveLength(1)
    expect(posts[0].thread_ts).toBe('1.0')
    const text = JSON.stringify(posts[0].blocks)
    expect(text).toContain('What worked instead:* Server-Sent Events')
    expect(text).toContain('log: WebSocket closed 1006')
    expect(text).toContain('not_relevant')
    expect(warning?.attemptId).toBe('att-websockets')
    expect(warning?.hoursSaved).toBe(14)
    expect(text).toContain(warning!._id)
  })

  it('posts nothing for a new idea or a non-warnable label', async () => {
    const { client, posts } = mockSlack()
    expect(await maybeWarn({ message: slackMessage('Going to add dark mode to the settings page.'), label: 'intent', channel: 'C1', client })).toBeUndefined()
    expect(await maybeWarn({ message: slackMessage('Going to add socket.io WebSockets to serverless functions.'), label: 'noise', channel: 'C1', client })).toBeUndefined()
    expect(posts).toHaveLength(0)
  })
})

function run(scores: Partial<HarnessScores>, failing = 0): EvalRun {
  return {
    _id: 'run',
    projectId: 'orbit',
    harnessVersion: 1,
    scores: { deadEndPrecision: 1, deadEndRecall: 1, citationAccuracy: 1, staleness: 1, overall: 1, ...scores },
    hoursSaved: 0,
    cases: Array.from({ length: failing }, (_, index) => ({ id: `case-${index}`, kind: 'deadEnd' as const, pass: false, detail: 'missed' })),
    createdAt: new Date().toISOString(),
  }
}

describe('f-b-07 reflection and promotion', () => {
  it('rejects a candidate that lowers precision even when overall improves', () => {
    const result = decidePromotion(run({ deadEndPrecision: 0.857, overall: 0.9 }), run({ deadEndPrecision: 0.75, overall: 0.97 }))
    expect(result.promoted).toBe(false)
    expect(result.reason).toMatch(/Precision dropped/)
  })

  it('promotes an improving candidate and rejects a flat one', () => {
    expect(decidePromotion(run({ deadEndPrecision: 0.857, overall: 0.9 }), run({ deadEndPrecision: 0.857, overall: 0.95 })).promoted).toBe(true)
    expect(decidePromotion(run({ overall: 0.9 }), run({ overall: 0.9 })).promoted).toBe(false)
  })

  it('feeds user feedback and failing cases into the reflection input', () => {
    const feedback = [
      { _id: 'fb-1', projectId: 'orbit', target: { kind: 'warning', id: 'warn-1' }, verdict: 'not_relevant', note: 'different goal', createdAt: '' },
    ] as Feedback[]
    const input = buildReflectionInput(orbit.harness, run({}, 2), feedback)
    expect(input.feedback).toEqual([{ verdict: 'not_relevant', target: { kind: 'warning', id: 'warn-1' }, note: 'different goal' }])
    expect(input.failures).toHaveLength(2)
  })

  it('builds the candidate as a new inactive version with a parent link', () => {
    const candidate = applyPatch(orbit.harness, { change: 'Lower minScore', retrieval: { minScore: 0.65 } }, 2)
    expect(candidate).toMatchObject({ version: 2, parentVersion: 1, active: false, _id: 'harness-orbit-v2' })
    expect(candidate.retrieval.minScore).toBe(0.65)
  })
})
