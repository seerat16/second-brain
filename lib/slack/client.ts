import { readEnv } from '../env'

export interface SlackPost {
  channel: string
  thread_ts: string
  text: string
  blocks?: unknown[]
}

export interface SlackClient {
  postMessage(message: SlackPost): Promise<{ ok: boolean; ts?: string; error?: string }>
}

export function createSlackClient(token = readEnv().SLACK_BOT_TOKEN): SlackClient | undefined {
  if (!token) return undefined
  return {
    async postMessage(message) {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(message),
      })
      return (await response.json()) as { ok: boolean; ts?: string; error?: string }
    },
  }
}
