import { chatText, isLlmConfigured } from '../llm'
import type { HarnessConfig, MessageLabel } from '../types'

export const LABELS: MessageLabel[] = ['decision', 'attempt_start', 'attempt_result', 'intent', 'question', 'noise']

const ATTEMPT_RESULT = /\b(tried|didn'?t work|does not (?:work|load)|doesn'?t (?:work|load)|failed|dropping|switching to|moving \w+ to|not shipping|lost \d+ hours?|hit \d+%)/i

// A failure report that also names the replacement ("tried X, going with Y")
// is an attempt result; the replacement is captured as the attempt's alternative.
const RULES: Array<[MessageLabel, RegExp]> = [
  ['attempt_result', ATTEMPT_RESULT],
  ['decision', /\b(decision|decided|we will use|going with|moves? to)\b/i],
  ['attempt_start', /\b(starting on|trying|spike on|going to try)\b/i],
  ['intent', /\b(going to|about to|plan to|let'?s add|will add|thinking of|we should)\b/i],
  ['question', /\?\s*$/],
]

export function labelByKeywords(text: string): MessageLabel {
  const match = RULES.find(([, pattern]) => pattern.test(text))
  return match ? match[0] : 'noise'
}

export function parseLabel(reply: string): MessageLabel | undefined {
  const normalized = reply.toLowerCase().replace(/[^a-z_\s]/g, ' ')
  return LABELS.find((label) => new RegExp(`\\b${label}\\b`).test(normalized))
}

const GUIDE = `Definitions:
- decision: the team commits to a choice ("Decision: ...", "we're going with X").
- attempt_start: someone starts trying an approach.
- attempt_result: someone reports how an approach went, usually a failure, cost, or abandonment. If a message reports a failed approach and also names what the team will do instead, it is attempt_result, not decision.
- intent: someone says they are about to do or plan to do something that has not started.
- question: a question to the team.
- noise: anything else.`

export async function classifyMessage(text: string, harness: HarnessConfig): Promise<{ label: MessageLabel; model: string }> {
  if (!isLlmConfigured()) return { label: labelByKeywords(text), model: 'keywords' }
  const model = harness.routing.classify
  const reply = await chatText(model, `${harness.prompts.classify}\n\n${GUIDE}`, text)
  const label = parseLabel(reply) ?? labelByKeywords(text)
  return { label: label === 'decision' && ATTEMPT_RESULT.test(text) ? 'attempt_result' : label, model }
}
