import { z } from 'zod'
import { collection, isDbConfigured } from '../db'
import { getFixture } from '../fixtures'
import { chatJson, embedOne, isLlmConfigured } from '../llm'
import { attemptText } from '../memory-text'
import type { Attempt, DeadEndMatch, HarnessConfig } from '../types'

const STOP_WORDS = new Set(
  'a an and the to of for on in with so we our is it be get gets add use using from that this all everyone team'.split(' '),
)

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9.]+/)
      .map((word) => word.replace(/^\.+|\.+$/g, '').replace(/s$/, ''))
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  )
}

export function keywordDeadEnds(projectId: string, text: string): DeadEndMatch[] {
  const fixture = getFixture(projectId)
  if (!fixture) return []
  const planTokens = tokenize(text)
  return fixture.attempts
    .filter((attempt) => attempt.outcome !== 'partially_worked')
    .map((attempt) => {
      const attemptTokens = tokenize(`${attempt.goal} ${attempt.approach}`)
      return { attempt, shared: [...planTokens].filter((token) => attemptTokens.has(token)) }
    })
    .filter(({ shared }) => shared.length >= 3)
    .map(({ attempt, shared }) => ({
      attempt,
      confidence: Math.min(0.95, 0.6 + shared.length * 0.08),
      reason: `Shares ${shared.join(', ')} with a past ${attempt.outcome} attempt.`,
      hoursSaved: attempt.hoursSpent,
    }))
    .sort((a, b) => b.confidence - a.confidence)
}

export type Candidate = Attempt & { score: number }

export async function retrieveCandidates(projectId: string, text: string, harness: HarnessConfig): Promise<Candidate[]> {
  const queryVector = await embedOne(text, harness.routing.embed)
  const results = (await (await collection('attempts'))
    .aggregate([
      {
        $vectorSearch: {
          index: 'attempts_vector',
          path: 'embedding',
          queryVector,
          numCandidates: 100,
          limit: harness.retrieval.k,
          filter: { projectId, outcome: { $in: ['failed', 'abandoned'] }, status: { $in: ['active', 'revisitable'] } },
        },
      },
      { $project: { embedding: 0, score: { $meta: 'vectorSearchScore' } } },
    ])
    .toArray()) as Candidate[]
  return results.filter((candidate) => candidate.projectId === projectId && candidate.score >= harness.retrieval.minScore)
}

const judgeSchema = z.object({
  verdicts: z.array(
    z.object({
      attemptId: z.string(),
      match: z.boolean(),
      confidence: z.coerce.number().min(0).max(1),
      reason: z.string().default(''),
    }),
  ),
})

export const MATCH_CUTOFF = 0.6

export async function judgeCandidates(text: string, candidates: Candidate[], harness: HarnessConfig): Promise<DeadEndMatch[]> {
  if (!candidates.length) return []
  const listing = candidates
    .map((candidate) => {
      const conditions = candidate.conditions.map((c) => `${c.description}${c.met ? ' (now met)' : ''}`).join('; ')
      return `Attempt ${candidate._id} (outcome ${candidate.outcome}):\n${attemptText(candidate)}\nConditions under which it could work: ${conditions || 'none recorded'}`
    })
    .join('\n\n')
  const verdict = await chatJson(
    harness.routing.judge,
    `${harness.prompts.judge}\nA match means the new plan uses essentially the same approach for a similar goal and would hit the same blocker. Sharing a technology or a goal alone is not a match. JSON shape: {"verdicts":[{"attemptId": string, "match": boolean, "confidence": number 0-1, "reason": string}]} with one verdict per attempt.`,
    `New plan: ${text}\n\nPast attempts:\n${listing}`,
    judgeSchema,
  )
  return verdict.verdicts
    .filter((item) => item.match && item.confidence >= MATCH_CUTOFF)
    .flatMap((item) => {
      const candidate = candidates.find((c) => c._id === item.attemptId)
      if (!candidate) return []
      const { score: _score, ...attempt } = candidate
      return [{ attempt, confidence: item.confidence, reason: item.reason, hoursSaved: attempt.hoursSpent }]
    })
    .sort((a, b) => b.confidence - a.confidence)
}

export async function findDeadEnds(projectId: string, text: string, harness: HarnessConfig): Promise<DeadEndMatch[]> {
  if (!isDbConfigured() || !isLlmConfigured()) return keywordDeadEnds(projectId, text)
  const candidates = await retrieveCandidates(projectId, text, harness)
  return judgeCandidates(text, candidates, harness)
}
