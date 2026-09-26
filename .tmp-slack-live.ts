import { closeDb, collection } from './lib/db'
import { signSlackRequest } from './lib/slack/verify'

const base = 'http://localhost:3100'
const secret = 'test-signing-secret'
const ts = `${Math.floor(Date.now() / 1000)}.000100`

async function send(path: string, body: string, contentType: string, signatureOverride?: string) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'content-type': contentType,
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signatureOverride ?? signSlackRequest(secret, timestamp, body),
    },
    body,
  })
  return { status: response.status, body: await response.text() }
}

const event = JSON.stringify({
  type: 'event_callback',
  event: { type: 'message', user: 'U_TEST', channel: 'C_TEST', ts, text: 'Going to add socket.io WebSockets to our serverless functions for live board updates.' },
})

console.log('first', await send('/api/slack/events', event, 'application/json'))
console.log('replay', await send('/api/slack/events', event, 'application/json'))
console.log('bad signature', await send('/api/slack/events', event, 'application/json', 'v0=deadbeef'))

await new Promise((resolve) => setTimeout(resolve, 20000))
const stored = await (await collection('messages')).countDocuments({ source: 'slack', sourceId: `C_TEST:${ts}` })
console.log('stored messages for event', stored)

const warningId = `warn-live-${ts}`
const payload = new URLSearchParams({ payload: JSON.stringify({ user: { id: 'U_TEST' }, actions: [{ action_id: 'not_relevant', value: warningId }] }) }).toString()
console.log('not relevant click', await send('/api/slack/interactions', payload, 'application/x-www-form-urlencoded'))
const feedback = await (await collection('feedback')).findOne({ 'target.id': warningId })
console.log('feedback read back', JSON.stringify({ verdict: feedback?.verdict, target: feedback?.target, note: feedback?.note }))

await (await collection('messages')).deleteMany({ sourceId: `C_TEST:${ts}` })
await (await collection('feedback')).deleteMany({ 'target.id': warningId })
await closeDb()
