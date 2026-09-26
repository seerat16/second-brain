import { randomUUID } from 'node:crypto'
import { classifyMessage, labelByKeywords } from '../capture/classify'
import { extractAttempt, extractDecision } from '../capture/extract'
import { timed } from '../capture/traces'
import { collection, isDbConfigured } from '../db'
import { embedOne, isLlmConfigured } from '../llm'
import { attemptText, decisionText } from '../memory-text'
import type { Attempt, Decision, HarnessConfig, IngestInput, IngestResult, Message } from '../types'
import { checkConditions } from './check-conditions'
import { getActiveHarness } from './get-active-harness'

export { labelByKeywords }

// Owner: Capture lane (f-a-03). classify -> store -> extract -> merge -> embed -> checkConditions.

const shortId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`
const DAY_MS = 24 * 60 * 60 * 1000

async function upsertEntities(projectId: string, names: string[]): Promise<string[]> {
  const entities = await collection('entities')
  const ids: string[] = []
  for (const name of [...new Set(names.map((value) => value.trim()).filter(Boolean))]) {
    const existing = await entities.findOne({ projectId, name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })
    if (existing) {
      ids.push(existing._id)
      continue
    }
    const _id = `ent-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${randomUUID().slice(0, 4)}`
    try {
      await entities.insertOne({ _id, projectId, name, kind: 'technology' })
      ids.push(_id)
    } catch {
      const raced = await entities.findOne({ projectId, name })
      if (raced) ids.push(raced._id)
    }
  }
  return ids
}

async function handleAttempt(message: Message, thread: Message[], harness: HarnessConfig): Promise<string[]> {
  const attempts = await collection('attempts')
  const windowStart = new Date(new Date(message.postedAt).getTime() - harness.mergeWindowDays * DAY_MS).toISOString()
  const existing = await attempts.findOne({
    projectId: message.projectId,
    sourceMessageIds: { $in: thread.map((item) => item._id) },
    startedAt: { $gte: windowStart },
    status: { $ne: 'resolved' },
  })

  if (message.label === 'attempt_start' && !existing) return []

  const extracted = await timed(
    { projectId: message.projectId, messageId: message._id, step: 'extract', model: harness.routing.extract, harnessVersion: harness.version },
    () => extractAttempt(thread, harness),
  )
  const entityIds = await upsertEntities(message.projectId, extracted.entities)
  const fields = {
    goal: extracted.goal,
    approach: extracted.approach,
    outcome: extracted.outcome,
    blockers: extracted.blockers,
    evidence: extracted.evidence,
    alternative: extracted.alternative,
    hoursSpent: extracted.hoursSpent,
  }
  const embedding = await timed(
    { projectId: message.projectId, messageId: message._id, step: 'embed', model: harness.routing.embed },
    () => embedOne(attemptText(fields), harness.routing.embed),
    (vector) => ({ dimensions: vector.length }),
  )

  if (existing) {
    const conditions = extracted.conditions.map(
      (description) => existing.conditions.find((condition) => condition.description === description) ?? { description, met: false },
    )
    await timed(
      { projectId: message.projectId, messageId: message._id, step: 'merge' },
      () =>
        attempts.updateOne(
          { _id: existing._id },
          {
            $set: { ...fields, conditions, embedding, endedAt: message.postedAt },
            $addToSet: { sourceMessageIds: { $each: thread.map((item) => item._id) }, authors: message.author, entityIds: { $each: entityIds } },
          },
        ),
      () => ({ merged: existing._id }),
    )
    return [existing._id]
  }

  const attempt: Attempt = {
    _id: shortId('att'),
    projectId: message.projectId,
    ...fields,
    conditions: extracted.conditions.map((description) => ({ description, met: false })),
    authors: [...new Set(thread.map((item) => item.author))],
    sourceMessageIds: thread.map((item) => item._id),
    entityIds,
    status: 'active',
    startedAt: thread[0].postedAt,
    endedAt: message.postedAt,
    embedding,
  }
  await timed({ projectId: message.projectId, messageId: message._id, step: 'merge' }, () => attempts.insertOne(attempt), () => ({ created: attempt._id }))
  return [attempt._id]
}

async function handleDecision(message: Message, harness: HarnessConfig): Promise<string[]> {
  const decisions = await collection('decisions')
  const active = await decisions.find({ projectId: message.projectId, status: 'active' }, { projection: { _id: 1, title: 1 } }).toArray()
  const extracted = await timed(
    { projectId: message.projectId, messageId: message._id, step: 'extract', model: harness.routing.extract, harnessVersion: harness.version },
    () => extractDecision([message], active, harness),
  )
  const entityIds = await upsertEntities(message.projectId, extracted.entities)
  const embedding = await timed(
    { projectId: message.projectId, messageId: message._id, step: 'embed', model: harness.routing.embed },
    () => embedOne(decisionText(extracted), harness.routing.embed),
    (vector) => ({ dimensions: vector.length }),
  )
  const decision: Decision = {
    _id: shortId('dec'),
    projectId: message.projectId,
    title: extracted.title,
    rationale: extracted.rationale,
    status: 'active',
    authors: [message.author],
    sourceMessageIds: [message._id],
    entityIds,
    decidedAt: message.postedAt,
    embedding,
  }
  await decisions.insertOne(decision)
  if (extracted.supersedesId) {
    await decisions.updateOne({ _id: extracted.supersedesId, projectId: message.projectId }, { $set: { status: 'superseded', supersededBy: decision._id } })
    await (await collection('edges')).insertOne({
      _id: shortId('edge'),
      projectId: message.projectId,
      kind: 'superseded_by',
      from: { kind: 'decision', id: extracted.supersedesId },
      to: { kind: 'decision', id: decision._id },
    })
  }
  return [decision._id]
}

export async function ingestMessage(input: IngestInput): Promise<IngestResult> {
  const harness = await getActiveHarness(input.projectId)
  const base: Message = {
    _id: shortId('msg'),
    projectId: input.projectId,
    source: input.source,
    sourceId: input.sourceId,
    threadId: input.threadId,
    author: input.author,
    text: input.text,
    postedAt: input.postedAt ?? new Date().toISOString(),
  }

  if (!isDbConfigured()) {
    const label = labelByKeywords(input.text)
    return { message: { ...base, label }, label, duplicate: false, attemptIds: [], decisionIds: [], transitions: [] }
  }

  const messages = await collection('messages')
  const existing = await messages.findOne({ projectId: input.projectId, source: input.source, sourceId: input.sourceId })
  if (existing) {
    return { message: existing, label: existing.label ?? 'noise', duplicate: true, attemptIds: [], decisionIds: [], transitions: [] }
  }

  const { label } = await timed(
    { projectId: input.projectId, messageId: base._id, step: 'classify', model: harness.routing.classify, harnessVersion: harness.version },
    () => classifyMessage(input.text, harness),
  )
  const message: Message = { ...base, label }
  try {
    await messages.insertOne(message)
  } catch (error) {
    const raced = await messages.findOne({ projectId: input.projectId, source: input.source, sourceId: input.sourceId })
    if (raced) return { message: raced, label: raced.label ?? label, duplicate: true, attemptIds: [], decisionIds: [], transitions: [] }
    throw error
  }

  const result: IngestResult = { message, label, duplicate: false, attemptIds: [], decisionIds: [], transitions: [] }
  if (!isLlmConfigured()) return result

  if (label === 'attempt_start' || label === 'attempt_result') {
    const thread = await messages.find({ projectId: input.projectId, threadId: input.threadId }).sort({ postedAt: 1 }).toArray()
    result.attemptIds = await handleAttempt(message, thread, harness)
  } else if (label === 'decision') {
    result.decisionIds = await handleDecision(message, harness)
    for (const decisionId of result.decisionIds) {
      result.transitions.push(
        ...(await timed(
          { projectId: input.projectId, messageId: message._id, step: 'conditions', model: harness.routing.judge, harnessVersion: harness.version },
          () => checkConditions(input.projectId, decisionId),
        )),
      )
    }
  }
  return result
}
