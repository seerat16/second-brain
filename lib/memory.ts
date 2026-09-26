import { collection, isDbConfigured } from './db'
import { getFixture } from './fixtures'
import type { Attempt, Decision, Edge, Entity, HarnessConfig, Message, Project, Warning } from './types'

export const DEFAULT_PROJECT_ID = 'orbit'

export interface ProjectMemory {
  source: 'atlas' | 'fixture'
  project: Project
  messages: Message[]
  attempts: Attempt[]
  decisions: Decision[]
  entities: Entity[]
  edges: Edge[]
}

const NO_EMBEDDING = { projection: { embedding: 0 } } as const

export async function loadMemory(projectId = DEFAULT_PROJECT_ID): Promise<ProjectMemory | undefined> {
  if (isDbConfigured()) {
    try {
      const [project, attempts, decisions, entities, edges, messages] = await Promise.all([
        (await collection('projects')).findOne({ _id: projectId }),
        (await collection('attempts')).find({ projectId }, NO_EMBEDDING).toArray(),
        (await collection('decisions')).find({ projectId }, NO_EMBEDDING).toArray(),
        (await collection('entities')).find({ projectId }).toArray(),
        (await collection('edges')).find({ projectId }).toArray(),
        (await collection('messages')).find({ projectId }).sort({ postedAt: 1 }).toArray(),
      ])
      if (project && (attempts.length || decisions.length)) {
        return { source: 'atlas', project, attempts, decisions, entities, edges, messages }
      }
    } catch (error) {
      console.error('[memory] Atlas read failed, using fixture', error)
    }
  }
  const fixture = getFixture(projectId)
  if (!fixture) return undefined
  return { source: 'fixture', ...fixture }
}

export async function loadAttempt(projectId: string, attemptId: string) {
  const memory = await loadMemory(projectId)
  const attempt = memory?.attempts.find((item) => item._id === attemptId)
  if (!memory || !attempt) return undefined
  const decisionsById = new Map(memory.decisions.map((decision) => [decision._id, decision]))
  const related = memory.edges
    .filter((edge) => edge.to.id === attemptId || edge.from.id === attemptId)
    .map((edge) => ({ edge, decision: decisionsById.get(edge.from.id === attemptId ? edge.to.id : edge.from.id) }))
  const sourceMessages = memory.messages.filter((message) => attempt.sourceMessageIds.includes(message._id))
  return { memory, attempt, related, sourceMessages, decisionsById }
}

export async function listHarnessVersions(projectId = DEFAULT_PROJECT_ID): Promise<HarnessConfig[]> {
  if (isDbConfigured()) {
    try {
      const versions = await (await collection('harness_configs')).find({ projectId }).sort({ version: 1 }).toArray()
      if (versions.length) return versions
    } catch (error) {
      console.error('[memory] harness read failed', error)
    }
  }
  const fixture = getFixture(projectId)?.harness
  return fixture ? [fixture] : []
}

export interface Impact {
  warnings: Array<Warning & { notRelevant: boolean }>
  hoursSaved: number
  precisionTrend: Array<{ version: number; precision: number; createdAt: string }>
}

export async function loadImpact(projectId = DEFAULT_PROJECT_ID): Promise<Impact> {
  if (!isDbConfigured()) return { warnings: [], hoursSaved: 0, precisionTrend: [] }
  const [warnings, feedback, runs] = await Promise.all([
    (await collection('warnings')).find({ projectId }).sort({ createdAt: -1 }).limit(100).toArray(),
    (await collection('feedback')).find({ projectId, 'target.kind': 'warning', verdict: 'not_relevant' }).toArray(),
    (await collection('evals')).find({ projectId }).sort({ createdAt: 1 }).toArray(),
  ])
  const dismissed = new Set(feedback.map((item) => item.target.id))
  const rows = warnings.map((warning) => ({ ...warning, notRelevant: dismissed.has(warning._id) }))
  return {
    warnings: rows,
    hoursSaved: rows.filter((row) => !row.notRelevant).reduce((sum, row) => sum + row.hoursSaved, 0),
    precisionTrend: runs.map((run) => ({
      version: run.harnessVersion as number,
      precision: (run.scores as { deadEndPrecision: number }).deadEndPrecision,
      createdAt: run.createdAt as string,
    })),
  }
}
