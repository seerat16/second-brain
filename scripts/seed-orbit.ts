import { closeDb, getDb } from '../lib/db'
import { getFixture } from '../lib/fixtures'
import { embed } from '../lib/llm'
import { attemptText, decisionText } from '../lib/memory-text'

// Seeds Orbit from fixtures/orbit.json and computes embeddings through the
// pipeline's embed step. The App Runner decision is held back (unless --full)
// so it can be captured live to demo the revisitable transition (f-a-07).

const HELD_BACK = { decisions: ['dec-app-runner'], messages: ['msg-apprunner'] }

async function main() {
  const full = process.argv.includes('--full')
  const fixture = getFixture('orbit')
  if (!fixture) throw new Error('orbit fixture missing')
  const db = await getDb()
  const projectId = fixture.project._id

  for (const name of ['messages', 'attempts', 'decisions', 'entities', 'edges', 'warnings', 'traces', 'feedback', 'evals']) {
    await db.collection(name).deleteMany({ projectId })
  }
  await db.collection('projects').replaceOne({ _id: projectId as never }, fixture.project, { upsert: true })

  const messages = full ? fixture.messages : fixture.messages.filter((m) => !HELD_BACK.messages.includes(m._id))
  const decisions = full ? fixture.decisions : fixture.decisions.filter((d) => !HELD_BACK.decisions.includes(d._id))
  const edges = full ? fixture.edges : fixture.edges.filter((e) => e.kind !== 'unblocks')
  const attempts = fixture.attempts.map((attempt) =>
    full ? attempt : { ...attempt, status: 'active' as const, conditions: attempt.conditions.map(({ description }) => ({ description, met: false })) },
  )

  const vectors = await embed([...attempts.map(attemptText), ...decisions.map(decisionText)], fixture.harness.routing.embed)
  const withAttemptVectors = attempts.map((attempt, i) => ({ ...attempt, embedding: vectors[i] }))
  const withDecisionVectors = decisions.map((decision, i) => ({ ...decision, embedding: vectors[attempts.length + i] }))

  await db.collection('messages').insertMany(messages as never[])
  await db.collection('attempts').insertMany(withAttemptVectors as never[])
  await db.collection('decisions').insertMany(withDecisionVectors as never[])
  await db.collection('entities').insertMany(fixture.entities as never[])
  if (edges.length) await db.collection('edges').insertMany(edges as never[])

  const harness = db.collection('harness_configs')
  if (!(await harness.findOne({ projectId, active: true }))) {
    await harness.replaceOne({ _id: fixture.harness._id as never }, fixture.harness, { upsert: true })
  }

  const deadEnds = withAttemptVectors.filter((a) => a.outcome !== 'partially_worked')
  console.log(`seeded ${projectId}${full ? ' (full)' : ''}: ${messages.length} messages, ${attempts.length} attempts, ${decisions.length} decisions, ${edges.length} edges`)
  console.log(`dead ends: ${deadEnds.map((a) => `${a._id}=${a.hoursSpent}h`).join(', ')}`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeDb)
