import { randomUUID } from 'node:crypto'
import evalSet from '@/fixtures/evals.json'
import { collection, isDbConfigured } from '../db'
import type { HarnessConfig, HarnessScores } from '../types'
import { askBrain } from './ask'
import { findDeadEnds } from './dead-ends'

export interface EvalSet {
  projectId: string
  deadEnd: Array<{ id: string; plan: string; expect: string | null }>
  ask: Array<{ id: string; question: string; expect: string[] }>
  staleness: Array<{ id: string; question: string; current: string; stale: string[] }>
}

export const EVAL_SET = evalSet as EvalSet

export interface CaseResult {
  id: string
  kind: 'deadEnd' | 'ask' | 'staleness'
  pass: boolean
  detail: string
}

export interface EvalRun {
  _id: string
  projectId: string
  harnessVersion: number
  scores: HarnessScores
  hoursSaved: number
  cases: CaseResult[]
  createdAt: string
}

async function pool<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await run(items[index])
      }
    }),
  )
  return results
}

const ratio = (hit: number, total: number) => (total ? hit / total : 1)
const round = (value: number) => Math.round(value * 1000) / 1000

export function overallScore(scores: Omit<HarnessScores, 'overall'>): number {
  return round(0.35 * scores.deadEndPrecision + 0.25 * scores.deadEndRecall + 0.2 * scores.citationAccuracy + 0.2 * scores.staleness)
}

export async function runEvals(harness: HarnessConfig, set: EvalSet = EVAL_SET): Promise<EvalRun> {
  const projectId = harness.projectId
  const cases: CaseResult[] = []
  let truePositives = 0
  let predicted = 0
  let hoursSaved = 0

  const deadEnd = await pool(set.deadEnd, 4, async (item) => ({ item, matches: await findDeadEnds(projectId, item.plan, harness) }))
  for (const { item, matches } of deadEnd) {
    const top = matches[0]
    if (top) predicted++
    const correct = top ? top.attempt._id === item.expect : item.expect === null
    if (top && correct) {
      truePositives++
      hoursSaved += top.hoursSaved
    }
    cases.push({
      id: item.id,
      kind: 'deadEnd',
      pass: correct,
      detail: top ? `matched ${top.attempt._id} (${top.confidence.toFixed(2)}), expected ${item.expect ?? 'none'}` : `no match, expected ${item.expect ?? 'none'}`,
    })
  }
  const positives = set.deadEnd.filter((item) => item.expect).length

  const asks = await pool(set.ask, 3, async (item) => ({ item, result: await askBrain(projectId, item.question, harness) }))
  let citationHits = 0
  for (const { item, result } of asks) {
    const ids = result.citations.map((citation) => citation.record._id)
    const sameProject = result.citations.every((citation) => citation.record.projectId === projectId)
    const pass = sameProject && (item.expect.length ? ids.some((id) => item.expect.includes(id)) : ids.length === 0)
    if (pass) citationHits++
    cases.push({ id: item.id, kind: 'ask', pass, detail: `cited [${ids.join(', ')}], expected one of [${item.expect.join(', ')}]` })
  }

  const stale = await pool(set.staleness, 2, async (item) => ({ item, result: await askBrain(projectId, item.question, harness) }))
  let freshHits = 0
  for (const { item, result } of stale) {
    const current = result.citations.find((citation) => citation.record._id === item.current)
    const pass = Boolean(current) && result.answer.toLowerCase().includes('better auth')
    if (pass) freshHits++
    cases.push({ id: item.id, kind: 'staleness', pass, detail: `cited [${result.citations.map((c) => c.record._id).join(', ')}]` })
  }

  const partial = {
    deadEndPrecision: round(ratio(truePositives, predicted)),
    deadEndRecall: round(ratio(truePositives, positives)),
    citationAccuracy: round(ratio(citationHits, set.ask.length)),
    staleness: round(ratio(freshHits, set.staleness.length)),
  }
  const run: EvalRun = {
    _id: `eval-${randomUUID().slice(0, 8)}`,
    projectId,
    harnessVersion: harness.version,
    scores: { ...partial, overall: overallScore(partial) },
    hoursSaved,
    cases,
    createdAt: new Date().toISOString(),
  }
  if (isDbConfigured()) await (await collection('evals')).insertOne(run as never)
  return run
}
