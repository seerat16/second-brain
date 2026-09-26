import { z } from 'zod'
import { getActiveHarness } from '../contracts/get-active-harness'
import { collection } from '../db'
import { chatJson } from '../llm'
import type { HarnessConfig } from '../types'
import { type EvalRun, runEvals } from './evals'

export const harnessPatch = z.object({
  change: z.string().min(1),
  retrieval: z
    .object({
      k: z.coerce.number().int().min(2).max(20).optional(),
      minScore: z.coerce.number().min(0.5).max(0.95).optional(),
    })
    .optional(),
  prompts: z.object({ judge: z.string().min(20).optional(), answer: z.string().min(20).optional() }).optional(),
})
export type HarnessPatch = z.infer<typeof harnessPatch>

export interface ReflectionResult {
  promoted: boolean
  reason: string
  baseline: EvalRun
  candidateRun: EvalRun
  candidate: HarnessConfig
}

export function applyPatch(base: HarnessConfig, patch: HarnessPatch, version: number): HarnessConfig {
  return {
    ...base,
    _id: `harness-${base.projectId}-v${version}`,
    version,
    parentVersion: base.version,
    active: false,
    retrieval: { ...base.retrieval, ...patch.retrieval },
    prompts: { ...base.prompts, ...patch.prompts },
    change: patch.change,
    scores: undefined,
    rejectedReason: undefined,
    createdAt: new Date().toISOString(),
  }
}

export function decidePromotion(baseline: EvalRun, candidate: EvalRun): { promoted: boolean; reason: string } {
  const b = baseline.scores
  const c = candidate.scores
  if (c.deadEndPrecision < b.deadEndPrecision) {
    return { promoted: false, reason: `Precision dropped from ${b.deadEndPrecision} to ${c.deadEndPrecision}.` }
  }
  if (c.overall <= b.overall) {
    return { promoted: false, reason: `Overall score did not improve (${b.overall} to ${c.overall}).` }
  }
  return { promoted: true, reason: `Overall improved from ${b.overall} to ${c.overall} with precision ${c.deadEndPrecision}.` }
}

async function proposePatch(active: HarnessConfig, baseline: EvalRun): Promise<HarnessPatch> {
  const feedback = await (await collection('feedback')).find({ projectId: active.projectId }).sort({ createdAt: -1 }).limit(20).toArray()
  const failures = baseline.cases.filter((item) => !item.pass)
  return chatJson(
    active.routing.reflect,
    `You tune a retrieval harness for a team memory tool. Propose exactly ONE small change that should fix the failing cases without adding false warnings. You may change retrieval.k, retrieval.minScore, prompts.judge, or prompts.answer. JSON shape: {"change": "one sentence describing the change", "retrieval"?: {"k"?: number, "minScore"?: number}, "prompts"?: {"judge"?: string, "answer"?: string}}.`,
    JSON.stringify({
      current: { retrieval: active.retrieval, prompts: { judge: active.prompts.judge, answer: active.prompts.answer } },
      scores: baseline.scores,
      failures,
      feedback: feedback.map((item) => ({ verdict: item.verdict, target: item.target, note: item.note })),
    }),
    harnessPatch,
  )
}

export async function reflect(projectId: string, options: { patch?: HarnessPatch } = {}): Promise<ReflectionResult> {
  const active = await getActiveHarness(projectId)
  const configs = await collection('harness_configs')

  const baseline = await runEvals(active)
  await configs.updateOne({ _id: active._id }, { $set: { scores: baseline.scores } })

  const patch = options.patch ?? (await proposePatch(active, baseline))
  const latest = await configs.find({ projectId }).sort({ version: -1 }).limit(1).next()
  const candidate = applyPatch(active, patch, (latest?.version ?? active.version) + 1)
  const candidateRun = await runEvals(candidate)
  candidate.scores = candidateRun.scores

  const decision = decidePromotion(baseline, candidateRun)
  if (decision.promoted) {
    await configs.insertOne({ ...candidate, active: false })
    await configs.updateOne({ _id: active._id }, { $set: { active: false } })
    await configs.updateOne({ _id: candidate._id }, { $set: { active: true } })
    candidate.active = true
  } else {
    candidate.rejectedReason = decision.reason
    await configs.insertOne(candidate)
  }
  return { ...decision, baseline, candidateRun, candidate }
}
