import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { ingestMessage } from '@/lib/contracts'
import { collection, isDbConfigured } from '@/lib/db'
import { DEFAULT_PROJECT_ID } from '@/lib/memory'

export const maxDuration = 120

const input = z.object({
  text: z.string().trim().min(1).max(4000),
  author: z.string().trim().min(1).max(80).default('web'),
  threadId: z.string().trim().max(80).optional(),
  sourceId: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return Response.json({ error: 'Write a message to capture.' }, { status: 400 })
  if (!isDbConfigured()) return Response.json({ error: 'Atlas is not configured.' }, { status: 503 })

  try {
    const threadId = parsed.data.threadId || `web-${randomUUID().slice(0, 8)}`
    const result = await ingestMessage({
      projectId: DEFAULT_PROJECT_ID,
      source: 'web',
      sourceId: parsed.data.sourceId ?? randomUUID(),
      threadId,
      author: parsed.data.author,
      text: parsed.data.text,
    })
    const [attempts, decisions] = await Promise.all([
      (await collection('attempts')).find({ _id: { $in: result.attemptIds } }, { projection: { embedding: 0 } }).toArray(),
      (await collection('decisions')).find({ _id: { $in: result.decisionIds } }, { projection: { embedding: 0 } }).toArray(),
    ])
    return Response.json({ ...result, threadId, attempts, decisions })
  } catch (error) {
    console.error('[capture] failed', error)
    return Response.json({ error: 'ProjectBrain could not process that message. Try again.' }, { status: 502 })
  }
}

export async function GET() {
  if (!isDbConfigured()) return Response.json({ threads: [] })
  const threads = await (await collection('messages'))
    .aggregate([
      { $match: { projectId: DEFAULT_PROJECT_ID } },
      { $sort: { postedAt: 1 } },
      { $group: { _id: '$threadId', first: { $first: '$text' }, last: { $last: '$postedAt' }, count: { $sum: 1 } } },
      { $sort: { last: -1 } },
      { $limit: 20 },
    ])
    .toArray()
  return Response.json({ threads: threads.map((t) => ({ id: t._id, preview: String(t.first).slice(0, 80), count: t.count })) })
}
