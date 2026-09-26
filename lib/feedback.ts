import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { collection } from './db'
import type { Feedback } from './types'

export const feedbackInput = z.object({
  projectId: z.string().min(1).max(64),
  target: z.object({ kind: z.enum(['warning', 'answer', 'check']), id: z.string().min(1).max(64) }),
  verdict: z.enum(['helpful', 'not_relevant']),
  note: z.string().max(500).optional(),
})

export async function recordFeedback(input: z.infer<typeof feedbackInput>): Promise<Feedback> {
  const feedback: Feedback = { _id: `fb-${randomUUID().slice(0, 8)}`, ...input, createdAt: new Date().toISOString() }
  await (await collection('feedback')).insertOne(feedback)
  return feedback
}

export async function listFeedback(projectId: string, targetId: string): Promise<Feedback[]> {
  return (await collection('feedback')).find({ projectId, 'target.id': targetId }).sort({ createdAt: -1 }).toArray()
}
