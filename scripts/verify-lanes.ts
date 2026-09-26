import labeled from '../fixtures/classify-labeled.json'
import { classifyMessage } from '../lib/capture/classify'
import { extractAttempt, extractDecision } from '../lib/capture/extract'
import { getActiveHarness } from '../lib/contracts'
import { closeDb } from '../lib/db'
import type { Message, MessageLabel } from '../lib/types'

const projectId = 'orbit'
const message = (text: string, author = 'maya', postedAt = '2026-09-01T10:00:00.000Z') =>
  ({ _id: `msg-${postedAt}`, projectId, source: 'web', sourceId: postedAt, threadId: 't', author, text, postedAt }) as Message

async function classifierAccuracy() {
  const harness = await getActiveHarness(projectId)
  const misses: string[] = []
  for (const item of labeled) {
    const { label } = await classifyMessage(item.text, harness)
    if (label !== (item.label as MessageLabel)) misses.push(`${item.label} -> ${label}: ${item.text}`)
  }
  const accuracy = (labeled.length - misses.length) / labeled.length
  console.log(`[f-a-01] classifier accuracy ${labeled.length - misses.length}/${labeled.length} = ${accuracy}`)
  for (const miss of misses) console.log(`  miss ${miss}`)
  return accuracy >= 0.85
}

async function postgresExtraction() {
  const harness = await getActiveHarness(projectId)
  const result = await extractAttempt(
    [
      message('Spike on Postgres LIKE for task search today, will report back.', 'dev', '2026-08-03T09:00:00.000Z'),
      message('Postgres LIKE search is 2.4s p95 on 200k tasks, benchmark attached. Spent 9 hours on it. Moving search to Atlas Search.', 'dev', '2026-08-04T16:00:00.000Z'),
    ],
    harness,
  )
  const ok = result.blockers.length > 0 && result.evidence.some((item) => item.kind === 'benchmark') && result.hoursSpent === 9
  console.log(`[f-a-02] postgres LIKE: outcome=${result.outcome} hours=${result.hoursSpent} blockers=${JSON.stringify(result.blockers.map((b) => b.detail))} evidence=${JSON.stringify(result.evidence)} alternative=${result.alternative} -> ${ok ? 'PASS' : 'FAIL'}`)
  return ok
}

async function authSupersedeChain() {
  const harness = await getActiveHarness(projectId)
  const steps = [
    'Decision: we use server sessions stored in Postgres for login.',
    'Decision: we are moving auth from server sessions to stateless JWTs so the API can scale horizontally.',
    'Decision: we replace our hand-rolled JWT auth with Better Auth.',
  ]
  const active: Array<{ _id: string; title: string }> = []
  const chain: string[] = []
  for (const [index, text] of steps.entries()) {
    const id = `dec-auth-${index + 1}`
    const result = await extractDecision([message(text, 'maya', `2026-07-0${index + 1}T10:00:00.000Z`)], active, harness)
    chain.push(`${id} "${result.title}" supersedes ${result.supersedesId ?? 'none'}`)
    if (result.supersedesId) active.splice(active.findIndex((item) => item._id === result.supersedesId), 1)
    active.push({ _id: id, title: result.title })
  }
  const ok = chain[0].endsWith('none') && chain[1].endsWith('dec-auth-1') && chain[2].endsWith('dec-auth-2') && active.length === 1
  for (const line of chain) console.log(`[f-a-02] ${line}`)
  console.log(`[f-a-02] supersede chain -> ${ok ? 'PASS' : 'FAIL'}`)
  return ok
}

const results = { classifier: await classifierAccuracy(), postgres: await postgresExtraction(), auth: await authSupersedeChain() }
console.log(JSON.stringify(results))
await closeDb().catch(() => undefined)
process.exit(Object.values(results).every(Boolean) ? 0 : 1)
