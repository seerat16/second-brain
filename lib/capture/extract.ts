import { z } from 'zod'
import { chatJson } from '../llm'
import type { HarnessConfig, Message } from '../types'

const blockerType = z.enum(['technical_limit', 'cost', 'performance', 'library_bug', 'licensing', 'org_constraint', 'time'])
const evidenceKind = z.enum(['log', 'benchmark', 'pr', 'commit', 'slack_thread'])
const evidence = z.union([
  z.object({ kind: evidenceKind.catch('slack_thread'), summary: z.string().min(1), url: z.string().optional() }),
  z
    .string()
    .min(1)
    .transform((summary) => ({ kind: 'slack_thread' as const, summary, url: undefined })),
])

export const attemptExtraction = z.object({
  goal: z.string().min(1),
  approach: z.string().min(1),
  outcome: z.enum(['failed', 'partially_worked', 'abandoned']),
  blockers: z.array(z.object({ type: blockerType, detail: z.string().min(1), evidence: z.array(evidence).default([]) })).default([]),
  evidence: z.array(evidence).default([]),
  conditions: z.array(z.string().min(1)).default([]),
  alternative: z.string().nullish().transform((value) => value || undefined),
  hoursSpent: z.coerce.number().min(0).default(0),
  entities: z.array(z.string().min(1)).default([]),
})
export type AttemptExtraction = z.infer<typeof attemptExtraction>

export const decisionExtraction = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  supersedesId: z.string().nullish().transform((value) => value || undefined),
  entities: z.array(z.string().min(1)).default([]),
})
export type DecisionExtraction = z.infer<typeof decisionExtraction>

function transcript(messages: Pick<Message, 'author' | 'text' | 'postedAt'>[]): string {
  return messages.map((message) => `[${message.postedAt}] ${message.author}: ${message.text}`).join('\n')
}

const ATTEMPT_SHAPE = `JSON fields: goal (what the team wanted), approach (what they tried, include named technologies), outcome (failed | partially_worked | abandoned), blockers [{type, detail, evidence: []}], evidence [{kind: log|benchmark|pr|commit|slack_thread, summary}] (only evidence mentioned, e.g. "benchmark attached" or "log attached"), conditions (short statements of what would have to change for this approach to work again), alternative (what the team did instead, if stated), hoursSpent (number; 1 day = 7 hours), entities (named technologies or services).`

export async function extractAttempt(thread: Message[], harness: HarnessConfig): Promise<AttemptExtraction> {
  return chatJson(harness.routing.extract, `${harness.prompts.extract}\n\n${ATTEMPT_SHAPE}`, transcript(thread), attemptExtraction)
}

const DECISION_SHAPE = `JSON fields: title (short imperative, e.g. "Use Atlas Search for task search"), rationale (why, from the message), supersedesId (the id of an active decision listed below that this decision replaces, or null), entities (named technologies or services).`

export async function extractDecision(
  thread: Message[],
  activeDecisions: Array<{ _id: string; title: string }>,
  harness: HarnessConfig,
): Promise<DecisionExtraction> {
  const context = activeDecisions.length
    ? `Active decisions:\n${activeDecisions.map((decision) => `- ${decision._id}: ${decision.title}`).join('\n')}`
    : 'There are no active decisions.'
  const result = await chatJson(
    harness.routing.extract,
    `${harness.prompts.extract}\n\n${DECISION_SHAPE}\n\n${context}`,
    transcript(thread),
    decisionExtraction,
  )
  if (result.supersedesId && !activeDecisions.some((decision) => decision._id === result.supersedesId)) {
    return { ...result, supersedesId: undefined }
  }
  return result
}
