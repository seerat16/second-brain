import { collection, isDbConfigured } from '../db'

export interface TraceInput {
  projectId: string
  messageId?: string
  step: 'classify' | 'extract' | 'merge' | 'embed' | 'conditions' | 'judge' | 'answer' | 'reflect'
  model?: string
  harnessVersion?: number
  ms: number
  output?: unknown
  error?: string
}

export async function writeTrace(trace: TraceInput): Promise<void> {
  if (!isDbConfigured()) return
  await (await collection('traces')).insertOne({ ...trace, createdAt: new Date().toISOString() })
}

export async function timed<T>(
  base: Omit<TraceInput, 'ms' | 'output' | 'error'>,
  run: () => Promise<T>,
  summarize: (value: T) => unknown = (value) => value,
): Promise<T> {
  const started = Date.now()
  try {
    const value = await run()
    await writeTrace({ ...base, ms: Date.now() - started, output: summarize(value) })
    return value
  } catch (error) {
    await writeTrace({ ...base, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}
