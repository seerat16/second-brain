import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { collection, isDbConfigured } from '../db'
import { getFixture } from '../fixtures'
import { chatJson, isLlmConfigured } from '../llm'
import { decisionText } from '../memory-text'
import type { Attempt, ConditionTransition } from '../types'
import { getActiveHarness } from './get-active-harness'

// Owner: Capture lane (f-a-07). Vector search finds dead ends near the new
// decision, then the judge model decides which of their conditions it meets.

const verdictSchema = z.object({
  results: z.array(
    z.object({
      attemptId: z.string(),
      metConditions: z.array(z.coerce.number().int()).default([]),
      explanation: z.string().default(''),
    }),
  ),
})

function fixtureTransitions(projectId: string, decisionId: string): ConditionTransition[] {
  const fixture = getFixture(projectId)
  if (!fixture) return []
  return fixture.edges
    .filter((edge) => edge.kind === 'unblocks' && edge.from.kind === 'decision' && edge.from.id === decisionId)
    .map((edge) => ({ attemptId: edge.to.id, decisionId, explanation: edge.explanation ?? 'This decision may satisfy a condition of the attempt.' }))
}

export async function checkConditions(projectId: string, decisionId: string): Promise<ConditionTransition[]> {
  if (!isDbConfigured() || !isLlmConfigured()) return fixtureTransitions(projectId, decisionId)

  const decision = await (await collection('decisions')).findOne({ _id: decisionId, projectId })
  if (!decision?.embedding) return []
  const harness = await getActiveHarness(projectId)
  const attempts = await collection('attempts')

  const candidates = (await attempts
    .aggregate([
      {
        $vectorSearch: {
          index: 'attempts_vector',
          path: 'embedding',
          queryVector: decision.embedding,
          numCandidates: 100,
          limit: harness.retrieval.k,
          filter: { projectId, status: { $in: ['active', 'revisitable'] } },
        },
      },
      { $project: { embedding: 0 } },
    ])
    .toArray()) as Attempt[]

  const open = candidates.filter((attempt) => attempt.conditions.some((condition) => !condition.met))
  if (!open.length) return []

  const listing = open
    .map(
      (attempt) =>
        `Attempt ${attempt._id}: ${attempt.approach} (goal: ${attempt.goal}). Blockers: ${attempt.blockers.map((b) => b.detail).join('; ')}\nConditions:\n${attempt.conditions
          .map((condition, index) => `  ${index}. ${condition.description}${condition.met ? ' (already met)' : ''}`)
          .join('\n')}`,
    )
    .join('\n\n')

  const verdict = await chatJson(
    harness.routing.judge,
    `${harness.prompts.conditions}\nOnly count a condition as met when the decision clearly and directly makes it true for the same part of the system the attempt was about. A decision about an unrelated feature never meets a condition. Most decisions meet no conditions.\nJSON shape: {"results":[{"attemptId": string, "metConditions": [condition index numbers], "explanation": "which blocker may no longer apply and why, one sentence"}]}. Include only attempts with at least one met condition.`,
    `New ${decisionText(decision)}\n\nPast attempts:\n${listing}`,
    verdictSchema,
  )

  const edges = await collection('edges')
  const transitions: ConditionTransition[] = []
  for (const result of verdict.results) {
    const attempt = open.find((item) => item._id === result.attemptId)
    const met = result.metConditions.filter((index) => attempt?.conditions[index] && !attempt.conditions[index].met)
    if (!attempt || !met.length) continue

    const conditions = attempt.conditions.map((condition, index) =>
      met.includes(index) ? { ...condition, met: true, metByDecisionId: decisionId } : condition,
    )
    await attempts.updateOne({ _id: attempt._id }, { $set: { conditions, status: 'revisitable' } })
    const already = await edges.findOne({ projectId, kind: 'unblocks', 'from.id': decisionId, 'to.id': attempt._id })
    if (!already) {
      await edges.insertOne({
        _id: `edge-${randomUUID().slice(0, 8)}`,
        projectId,
        kind: 'unblocks',
        from: { kind: 'decision', id: decisionId },
        to: { kind: 'attempt', id: attempt._id },
        explanation: result.explanation,
      })
    }
    transitions.push({ attemptId: attempt._id, decisionId, explanation: result.explanation })
  }
  return transitions
}
