import { beforeAll, describe, expect, it, vi } from 'vitest'

// Unit tests run offline against the fixture; live Atlas and OpenRouter are
// exercised by pnpm eval and the API checks instead.
beforeAll(() => {
  vi.stubEnv('MONGODB_URI', '')
  vi.stubEnv('OPENROUTER_API_KEY', '')
})
import { checkConditions, checkDeadEnds, getActiveHarness } from '@/lib/contracts'
import { labelByKeywords } from '@/lib/contracts/ingest-message'
import { missingKeys, readEnv } from '@/lib/env'
import { getFixture } from '@/lib/fixtures'
import { COLLECTIONS } from '@/lib/types'
import { SEARCH_INDEXES, STANDARD_INDEXES } from '@/scripts/db-setup-indexes'

const orbit = getFixture('orbit')!
const BLOCKER_TYPES = ['technical_limit', 'cost', 'performance', 'library_bug', 'licensing', 'org_constraint', 'time']

describe('env (f-sh-01)', () => {
  it('reports missing MONGODB_URI without exposing values', () => {
    expect(missingKeys(['MONGODB_URI'], readEnv({}))).toEqual(['MONGODB_URI'])
    expect(missingKeys(['MONGODB_URI'], readEnv({ MONGODB_URI: 'mongodb+srv://x' }))).toEqual([])
  })
  it('treats blank values as missing', () => {
    expect(missingKeys(['OPENAI_API_KEY'], readEnv({ OPENAI_API_KEY: '  ' }))).toEqual(['OPENAI_API_KEY'])
  })
})

describe('indexes (f-sh-02)', () => {
  it('only indexes known collections', () => {
    for (const name of Object.keys(STANDARD_INDEXES)) expect(COLLECTIONS).toContain(name)
  })
  it('stays within the M0 limit of three search indexes', () => {
    expect(SEARCH_INDEXES).toHaveLength(3)
  })
  it('filters vector search by projectId', () => {
    for (const spec of SEARCH_INDEXES.filter((s) => s.type === 'vectorSearch')) {
      const fields = (spec.definition as { fields: Array<{ type: string; path: string }> }).fields
      expect(fields).toContainEqual({ type: 'filter', path: 'projectId' })
    }
  })
})

describe('harness (f-sh-03)', () => {
  it('returns v1 for orbit from the fixture when no database is configured', async () => {
    const previous = process.env.MONGODB_URI
    delete process.env.MONGODB_URI
    try {
      const harness = await getActiveHarness('orbit')
      expect(harness).toMatchObject({ version: 1, active: true, retrieval: { k: 8, minScore: 0.72, hybridWeight: 0.3 } })
      expect(harness.routing.judge).not.toBe(harness.routing.classify)
    } finally {
      if (previous) process.env.MONGODB_URI = previous
    }
  })
})

describe('orbit fixture (f-sh-04)', () => {
  it('has the four R31 dead ends with hours and alternatives', () => {
    const hours = Object.fromEntries(orbit.attempts.map((a) => [a._id, a.hoursSpent]))
    expect(hours).toMatchObject({ 'att-websockets': 14, 'att-postgres-like': 9, 'att-pdf-library': 6 })
    expect(orbit.attempts).toHaveLength(4)
    expect(orbit.attempts.find((a) => a._id === 'att-websockets')?.alternative).toBe('Server-Sent Events')
    expect(orbit.attempts.find((a) => a._id === 'att-postgres-like')?.alternative).toBe('Atlas Search')
  })
  it('uses only R3 blocker types', () => {
    for (const blocker of orbit.attempts.flatMap((a) => a.blockers)) expect(BLOCKER_TYPES).toContain(blocker.type)
  })
  it('has the R32 sessions -> JWT -> Better Auth chain', () => {
    const byId = Object.fromEntries(orbit.decisions.map((d) => [d._id, d]))
    expect(byId['dec-sessions'].supersededBy).toBe('dec-jwt')
    expect(byId['dec-jwt'].supersededBy).toBe('dec-better-auth')
    expect(byId['dec-better-auth'].status).toBe('active')
  })
  it('references only existing records in edges', () => {
    const ids = new Set([...orbit.attempts, ...orbit.decisions, ...orbit.entities].map((r) => r._id))
    for (const edge of orbit.edges) {
      expect(ids.has(edge.from.id)).toBe(true)
      expect(ids.has(edge.to.id)).toBe(true)
    }
  })
})

describe('contracts without Atlas or a model key (fixture fallback)', () => {
  it('matches the socket.io plan to the WebSockets dead end', async () => {
    const [match] = await checkDeadEnds('orbit', 'Add socket.io so task boards get live updates for everyone on the team.')
    expect(match.attempt._id).toBe('att-websockets')
    expect(match.hoursSaved).toBe(14)
  })
  it('does not match an unrelated plan or another project', async () => {
    expect(await checkDeadEnds('orbit', 'Add CSV export for invoices')).toEqual([])
    expect(await checkDeadEnds('other', 'Add socket.io so task boards get live updates')).toEqual([])
  })
  it('reopens WebSockets for the App Runner decision only', async () => {
    expect((await checkConditions('orbit', 'dec-app-runner')).map((t) => t.attemptId)).toEqual(['att-websockets'])
    expect(await checkConditions('orbit', 'dec-atlas-search')).toEqual([])
  })
  it('labels fixture messages the way they are labeled in the fixture', () => {
    for (const message of orbit.messages) expect(labelByKeywords(message.text)).toBe(message.label)
  })
})
