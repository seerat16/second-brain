import { revalidatePath } from 'next/cache'
import { isDbConfigured } from '@/lib/db'
import { isLlmConfigured } from '@/lib/llm'
import { DEFAULT_PROJECT_ID } from '@/lib/memory'
import { reflect } from '@/lib/recall/reflect'

export const maxDuration = 300

export async function POST() {
  if (!isDbConfigured() || !isLlmConfigured()) return Response.json({ error: 'Atlas and OpenRouter must be configured.' }, { status: 503 })
  try {
    const result = await reflect(DEFAULT_PROJECT_ID)
    revalidatePath('/lab')
    revalidatePath('/impact')
    return Response.json({
      promoted: result.promoted,
      reason: result.reason,
      version: result.candidate.version,
      change: result.candidate.change,
      baseline: result.baseline.scores,
      candidate: result.candidateRun.scores,
    })
  } catch (error) {
    console.error('[reflect] failed', error)
    return Response.json({ error: 'Reflection failed. Try again.' }, { status: 502 })
  }
}
