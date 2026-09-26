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
- attempt_start: someone says work on an approach is starting now or today ("Starting on X", "Spike on X today", "Trying X this afternoon").
- attempt_result: someone reports how an approach went, usually a failure, cost, or abandonment. If a message reports a failed approach and also names what the team will do instead, it is attempt_result, not decision.
- intent: someone plans or is about to do engineering work that has not started ("about to add X", "plan to add X next sprint", "thinking of moving X").
- question: a question to the team.
- noise: anything that is not about the product's engineering choices, including meetings, standups, schedule changes, lunch, thanks, and greetings, even when phrased as a plan or a change.`

const LOGISTICS = /\b(lunch|standup|stand-up|meeting|call|demo|coffee|holiday|out of office|ooo|thanks|thank you)\b/i

export async function classifyMessage(text: string, harness: HarnessConfig): Promise<{ label: MessageLabel; model: string }> {
  if (!isLlmConfigured()) return { label: labelByKeywords(text), model: 'keywords' }
  const model = harness.routing.classify
  const reply = await chatText(model, `${harness.prompts.classify}\n\n${GUIDE}`, text)
  return { label: correctLabel(parseLabel(reply) ?? labelByKeywords(text), text), model }
}

// Deterministic corrections for the model's most common confusions on the labeled set.
export function correctLabel(label: MessageLabel, text: string): MessageLabel {
  const keyword = labelByKeywords(text)
  if (label === 'decision' && ATTEMPT_RESULT.test(text)) return 'attempt_result'
  if (label === 'intent' && keyword === 'attempt_start') return 'attempt_start'
  if ((label === 'intent' || label === 'decision') && keyword === 'noise' && LOGISTICS.test(text)) return 'noise'
  return label
}
