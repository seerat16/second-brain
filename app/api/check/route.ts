import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { checkDeadEnds, getActiveHarness } from '@/lib/contracts'
import { collection, isDbConfigured } from '@/lib/db'
import { DEFAULT_PROJECT_ID } from '@/lib/memory'
import type { Warning } from '@/lib/types'

export const maxDuration = 60

const input = z.object({ plan: z.string().trim().min(8).max(4000) })

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return Response.json({ error: 'Describe the plan in a sentence or two.' }, { status: 400 })

  try {
    const matches = await checkDeadEnds(DEFAULT_PROJECT_ID, parsed.data.plan)
    const harness = await getActiveHarness(DEFAULT_PROJECT_ID)
    const results = matches.map((match) => ({ ...match, warningId: `warn-${randomUUID().slice(0, 8)}` }))
    if (results.length && isDbConfigured()) {
      const warnings: Warning[] = results.map((result) => ({
        _id: result.warningId,
        projectId: DEFAULT_PROJECT_ID,
        attemptId: result.attempt._id,
        channel: 'web',
        confidence: result.confidence,
        hoursSaved: result.hoursSaved,
        harnessVersion: harness.version,
        createdAt: new Date().toISOString(),
      }))
      await (await collection('warnings')).insertMany(warnings)
    }
    return Response.json({ matches: results.map(({ attempt: { embedding: _e, ...attempt }, ...rest }) => ({ ...rest, attempt })) })
  } catch (error) {
    console.error('[check] failed', error)
    return Response.json({ error: 'The check could not run. Try again.' }, { status: 502 })
  }
}
