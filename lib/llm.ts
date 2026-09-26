import type { z } from 'zod'
import { readEnv } from './env'

const BASE_URL = 'https://openrouter.ai/api/v1'

export function isLlmConfigured(): boolean {
  return Boolean(readEnv().OPENROUTER_API_KEY)
}

function apiKey(): string {
  const key = readEnv().OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')
  return key
}

// OpenRouter model ids are `provider/model`; older harness configs store bare OpenAI ids.
export function openRouterModel(model: string): string {
  return model.includes('/') ? model : `openai/${model}`
}

const RATE_LIMIT_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 30_000)
  return Math.min(2 ** attempt * 3000, 30_000)
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  for (let attempt = 0; ; attempt++) {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
        'X-Title': 'ProjectBrain',
      },
      body: JSON.stringify(body),
    })
    if (response.status !== 429 || attempt >= RATE_LIMIT_RETRIES) break
    await sleep(retryDelayMs(response, attempt))
  }
  if (!response.ok) {
    throw new Error(`OpenRouter ${path} failed: ${response.status} ${(await response.text()).slice(0, 300)}`)
  }
  return (await response.json()) as T
}

export function parseJsonObject(content: string): unknown {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error(`Model did not return JSON: ${content.slice(0, 200)}`)
  return JSON.parse(content.slice(start, end + 1))
}

export async function chatText(model: string, system: string, user: string): Promise<string> {
  const data = await post<{ choices?: Array<{ message?: { content?: string } }> }>('/chat/completions', {
    model: openRouterModel(model),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

export async function chatJson<T>(model: string, system: string, user: string, schema: z.ZodType<T>): Promise<T> {
  const instructions = `${system}\n\nReply with a single JSON object and nothing else.`
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await chatText(model, instructions, user)
      return schema.parse(parseJsonObject(content))
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

const embeddingCache = new Map<string, number[]>()

export async function embed(texts: string[], model = 'text-embedding-3-small'): Promise<number[][]> {
  const id = openRouterModel(model)
  const missing = [...new Set(texts.filter((text) => !embeddingCache.has(`${id}:${text}`)))]
  if (missing.length) {
    const data = await post<{ data: Array<{ index: number; embedding: number[] }> }>('/embeddings', { model: id, input: missing })
    for (const row of data.data) embeddingCache.set(`${id}:${missing[row.index]}`, row.embedding)
  }
  return texts.map((text) => embeddingCache.get(`${id}:${text}`) as number[])
}

export async function embedOne(text: string, model?: string): Promise<number[]> {
  return (await embed([text], model))[0]
}
