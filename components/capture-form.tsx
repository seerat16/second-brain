'use client'

import { useState } from 'react'
import type { Attempt, ConditionTransition, Decision, MessageLabel } from '@/lib/types'
import { AttemptSummary } from './attempt-summary'
import { ErrorState, LoadingState, RecordCard, StatusMark } from './states'

type Result = {
  label: MessageLabel
  duplicate: boolean
  threadId: string
  attempts: Attempt[]
  decisions: Decision[]
  transitions: ConditionTransition[]
}
type State = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; result: Result }

export function CaptureForm() {
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')
  const [threadId, setThreadId] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setState({ status: 'loading' })
    const response = await fetch('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, author: author || undefined, threadId: threadId || undefined, sourceId: crypto.randomUUID() }),
    }).catch(() => undefined)
    const data = await response?.json().catch(() => ({}))
    if (!response?.ok) return setState({ status: 'error', message: data?.error ?? 'Capture failed.' })
    setThreadId(data.threadId)
    setText('')
    setState({ status: 'done', result: data })
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Author</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="maya" className="rounded-md border border-border bg-background px-3 py-2" />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Thread (blank starts a new one)</span>
            <input value={threadId} onChange={(e) => setThreadId(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 font-mono" />
          </label>
        </div>
        <label htmlFor="capture-text" className="font-medium">
          Message
        </label>
        <textarea
          id="capture-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="We tried PDF export with the AGPL library; legal blocked it after 5 hours. Going with server-side HTML to PDF."
          className="rounded-md border border-border bg-background p-3 leading-relaxed"
        />
        <button
          type="submit"
          disabled={!text.trim() || state.status === 'loading'}
          className="self-start rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
        >
          Capture
        </button>
      </form>
      <div aria-live="polite" className="flex flex-col gap-4">
        {state.status === 'loading' ? <LoadingState label="Classifying and extracting" /> : null}
        {state.status === 'error' ? <ErrorState title="Capture failed">{state.message}</ErrorState> : null}
        {state.status === 'done' ? (
          <>
            <p className="text-sm text-muted-foreground">
              Labelled <span className="font-mono text-foreground">{state.result.label}</span>
              {state.result.duplicate ? ' · already captured' : ''} · thread <span className="font-mono">{state.result.threadId}</span>
            </p>
            {state.result.attempts.map((attempt) => (
              <RecordCard key={attempt._id}>
                <AttemptSummary attempt={attempt} />
              </RecordCard>
            ))}
            {state.result.decisions.map((decision) => (
              <RecordCard key={decision._id}>
                <StatusMark mark={decision.status === 'superseded' ? 'superseded' : 'current'} label="Decision" />
                <p className="font-medium">{decision.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{decision.rationale}</p>
              </RecordCard>
            ))}
            {state.result.transitions.map((transition) => (
              <RecordCard key={transition.attemptId}>
                <StatusMark mark="revisitable" label="Now revisitable" />
                <p className="leading-relaxed">{transition.explanation}</p>
              </RecordCard>
            ))}
          </>
        ) : null}
      </div>
    </>
  )
}
