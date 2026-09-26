import { recordFeedback } from '@/lib/feedback'
import { readEnv } from '@/lib/env'
import { DEFAULT_PROJECT_ID } from '@/lib/memory'
import { verifySlackSignature } from '@/lib/slack/verify'

export async function POST(request: Request) {
  const body = await request.text()
  const valid = verifySlackSignature({
    secret: readEnv().SLACK_SIGNING_SECRET,
    timestamp: request.headers.get('x-slack-request-timestamp'),
    signature: request.headers.get('x-slack-signature'),
    body,
  })
  if (!valid) return Response.json({ error: 'invalid signature' }, { status: 401 })

  const payload = JSON.parse(new URLSearchParams(body).get('payload') ?? '{}') as {
    actions?: Array<{ action_id: string; value: string }>
    user?: { id: string }
  }
  const action = payload.actions?.find((item) => item.action_id === 'not_relevant')
  if (action) {
    await recordFeedback({
      projectId: DEFAULT_PROJECT_ID,
      target: { kind: 'warning', id: action.value },
      verdict: 'not_relevant',
      note: payload.user ? `Slack user ${payload.user.id}` : undefined,
    })
  }
  return Response.json({ text: 'Thanks — noted as not relevant.', replace_original: false })
}
