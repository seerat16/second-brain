import { isDbConfigured } from '@/lib/db'
import { feedbackInput, listFeedback, recordFeedback } from '@/lib/feedback'
import { DEFAULT_PROJECT_ID } from '@/lib/memory'

export async function POST(request: Request) {
  const parsed = feedbackInput.safeParse({ projectId: DEFAULT_PROJECT_ID, ...(await request.json().catch(() => ({}))) })
  if (!parsed.success) return Response.json({ error: 'Invalid feedback.' }, { status: 400 })
  if (!isDbConfigured()) return Response.json({ error: 'Atlas is not configured.' }, { status: 503 })
  return Response.json({ feedback: await recordFeedback({ ...parsed.data, projectId: DEFAULT_PROJECT_ID }) })
}

export async function GET(request: Request) {
  const targetId = new URL(request.url).searchParams.get('targetId')
  if (!targetId || !isDbConfigured()) return Response.json({ feedback: [] })
  return Response.json({ feedback: await listFeedback(DEFAULT_PROJECT_ID, targetId) })
}
