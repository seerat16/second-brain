import { z } from 'zod'

const optional = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined))

const schema = z.object({
  MONGODB_URI: optional,
  MONGODB_DB: optional,
  OPENAI_API_KEY: optional,
  OPENROUTER_API_KEY: optional,
  SLACK_SIGNING_SECRET: optional,
  SLACK_BOT_TOKEN: optional,
  AWS_REGION: optional,
  EVIDENCE_BUCKET: optional,
})

export type Env = z.infer<typeof schema>
export type EnvKey = keyof Env

export const REQUIRED_FOR_READY: EnvKey[] = ['MONGODB_URI']

export const REQUIRED_BY_FEATURE: Record<string, EnvKey[]> = {
  'f-a-01': ['OPENROUTER_API_KEY'],
  'f-a-02': ['OPENROUTER_API_KEY'],
  'f-a-06': ['SLACK_SIGNING_SECRET'],
  'f-a-08': ['AWS_REGION', 'EVIDENCE_BUCKET'],
  'f-b-01': ['OPENROUTER_API_KEY'],
  'f-b-05': ['SLACK_BOT_TOKEN'],
}

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return schema.parse(source)
}

export function missingKeys(keys: EnvKey[], env: Env = readEnv()): EnvKey[] {
  return keys.filter((key) => !env[key])
}

export function dbName(env: Env = readEnv()): string {
  return env.MONGODB_DB ?? 'projectbrain'
}
