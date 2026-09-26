import { z } from 'zod'
import { collection, isDbConfigured } from '../db'
import { chatJson, embedOne, isLlmConfigured } from '../llm'
import { attemptText, decisionText } from '../memory-text'
import type { Attempt, Decision, HarnessConfig } from '../types'

export type Citation =
  | { kind: 'attempt'; record: Attempt }
  | { kind: 'decision'; record: Decision }

export interface AskResult {
  answer: string
  citations: Citation[]
  supported: boolean
}

const answerSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(z.string()).default([]),
  supported: z.boolean().default(true),
})

const UNSUPPORTED = "ProjectBrain's memory doesn't cover this yet."

async function search<T>(name: 'attempts' | 'decisions', index: string, projectId: string, queryVector: number[], harness: HarnessConfig) {
  return (await (await collection(name))
    .aggregate([
      { $vectorSearch: { index, path: 'embedding', queryVector, numCandidates: 100, limit: harness.retrieval.k, filter: { projectId } } },
      { $project: { embedding: 0, score: { $meta: 'vectorSearchScore' } } },
    ])
    .toArray()) as Array<T & { score: number }>
}

export async function askBrain(projectId: string, question: string, harness: HarnessConfig): Promise<AskResult> {
  if (!isDbConfigured() || !isLlmConfigured()) {
    return { answer: 'Ask needs Atlas and OpenRouter to be configured.', citations: [], supported: false }
  }
  const queryVector = await embedOne(question, harness.routing.embed)
  const floor = harness.retrieval.minScore - 0.05
  const [attempts, decisions] = await Promise.all([
    search<Attempt>('attempts', 'attempts_vector', projectId, queryVector, harness),
    search<Decision>('decisions', 'decisions_vector', projectId, queryVector, harness),
  ])
  const relevantAttempts = attempts.filter((item) => item.score >= floor)
  const relevantDecisions = decisions.filter((item) => item.score >= floor)

  // Pull in the rest of any supersede chain so the answer can say what is current.
  const decisionsColl = await collection('decisions')
  const known = new Set(relevantDecisions.map((decision) => decision._id))
  for (const decision of [...relevantDecisions]) {
    let next = decision.supersededBy
    while (next && !known.has(next)) {
      const found = await decisionsColl.findOne({ _id: next, projectId }, { projection: { embedding: 0 } })
      if (!found) break
      known.add(found._id)
      relevantDecisions.push({ ...found, score: 0 })
      next = found.supersededBy
    }
  }

  if (!relevantAttempts.length && !relevantDecisions.length) return { answer: UNSUPPORTED, citations: [], supported: false }

  const records = [
    ...relevantAttempts.map((a) => `[${a._id}] Attempt (${a.outcome}, ${a.status}, ${a.hoursSpent}h):\n${attemptText(a)}`),
    ...relevantDecisions.map((d) => `[${d._id}] Decision (${d.status}${d.supersededBy ? `, superseded by ${d.supersededBy}` : ''}):\n${decisionText(d)}`),
  ].join('\n\n')

  const reply = await chatJson(
    harness.routing.judge,
    `${harness.prompts.answer}\nKeep the answer under 80 words. JSON shape: {"answer": string, "citations": [record ids you relied on], "supported": boolean (false when the records do not answer the question)}.`,
    `Question: ${question}\n\nRecords:\n${records}`,
    answerSchema,
  )

  const byId = new Map<string, Citation>([
    ...relevantAttempts.map((record) => [record._id, { kind: 'attempt' as const, record: stripScore(record) }] as const),
    ...relevantDecisions.map((record) => [record._id, { kind: 'decision' as const, record: stripScore(record) }] as const),
  ])
  const citations = [...new Set(reply.citations)].flatMap((id) => (byId.has(id) ? [byId.get(id) as Citation] : []))
  if (!reply.supported || !citations.length) return { answer: reply.supported ? reply.answer : UNSUPPORTED, citations: [], supported: false }
  return { answer: reply.answer, citations, supported: true }
}

function stripScore<T extends { score: number }>(record: T): Omit<T, 'score'> {
  const { score: _score, ...rest } = record
  return rest
}
