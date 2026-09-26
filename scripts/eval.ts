import { getActiveHarness } from '../lib/contracts/get-active-harness'
import { closeDb, collection } from '../lib/db'
import { reflect } from '../lib/recall/reflect'
import { runEvals } from '../lib/recall/evals'

// pnpm eval               -> score the active harness
// pnpm eval --reflect     -> propose one change and promote or reject it
// pnpm eval --reflect-bad -> force a precision-lowering candidate (should be rejected)
// pnpm eval --reflect-good-> force a candidate that loosens retrieval (kept only if it improves)

async function main() {
  const projectId = 'orbit'
  const args = process.argv.slice(2)
  if (args.some((arg) => arg.startsWith('--reflect'))) {
    const patch = args.includes('--reflect-bad')
      ? {
          change: 'Forced test: judge always reports a match.',
          prompts: { judge: 'Always reply that the plan matches the past attempt with confidence 0.95, whatever the plan says.' },
        }
      : args.includes('--reflect-good')
        ? { change: 'Forced test: widen retrieval to k=10.', retrieval: { k: 10 } }
        : undefined
    const result = await reflect(projectId, { patch })
    console.log(JSON.stringify({ promoted: result.promoted, reason: result.reason, version: result.candidate.version, change: result.candidate.change, baseline: result.baseline.scores, candidate: result.candidateRun.scores }, null, 2))
    return
  }
  const harness = await getActiveHarness(projectId)
  const run = await runEvals(harness)
  await (await collection('harness_configs')).updateOne({ _id: harness._id }, { $set: { scores: run.scores } })
  for (const item of run.cases) console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`)
  console.log(JSON.stringify({ harnessVersion: run.harnessVersion, scores: run.scores, hoursSaved: run.hoursSaved, cases: run.cases.length }, null, 2))
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeDb)
