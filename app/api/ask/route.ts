import { z } from 'zod'
import { getActiveHarness } from '@/lib/contracts'
import { DEFAULT_PROJECT_ID } from '@/lib/memory'
import { askBrain } from '@/lib/recall/ask'

export const maxDuration = 60

const input = z.object({ question: z.string().trim().min(3).max(1000) })

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return Response.json({ error: 'Ask a question.' }, { status: 400 })
  try {
    return Response.json(await askBrain(DEFAULT_PROJECT_ID, parsed.data.question, await getActiveHarness(DEFAULT_PROJECT_ID)))
  } catch (error) {
    console.error('[ask] failed', error)
    return Response.json({ error: 'The brain could not answer right now. Try again.' }, { status: 502 })
  }
}
