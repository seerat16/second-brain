'use client'

import { useState } from 'react'
import type { Attempt } from '@/lib/types'
import { AttemptSummary } from './attempt-summary'
import { FeedbackButton } from './feedback-button'
import { EmptyState, ErrorState, LoadingState, RecordCard } from './states'

type Match = { attempt: Attempt; confidence: number; reason: string; hoursSaved: number; warningId: string }
type State = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; matches: Match[] }

export function CheckForm() {
  const [plan, setPlan] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setState({ status: 'loading' })
    const response = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    }).catch(() => undefined)
    const data = await response?.json().catch(() => ({}))
    if (!response?.ok) return setState({ status: 'error', message: data?.error ?? 'The check could not run.' })
    setState({ status: 'done', matches: data.matches })
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="plan" className="font-medium">
          What are you about to try?
        </label>
        <textarea
          id="plan"
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          rows={4}
          placeholder="e.g. Add live board updates with socket.io in our serverless functions"
          className="rounded-md border border-border bg-background p-3 leading-relaxed"
        />
        <button
          type="submit"
          disabled={plan.trim().length < 8 || state.status === 'loading'}
          className="self-start rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
        >
          Check memory
        </button>
      </form>
      <div aria-live="polite" className="flex flex-col gap-4">
        {state.status === 'loading' ? <LoadingState label="Searching past attempts" /> : null}
        {state.status === 'error' ? <ErrorState title="Check failed">{state.message}</ErrorState> : null}
        {state.status === 'done' && !state.matches.length ? (
          <EmptyState title="No dead end found">Nothing in memory says this has failed before.</EmptyState>
        ) : null}
        {state.status === 'done'
          ? state.matches.map((match) => (
              <RecordCard key={match.warningId}>
                <p className="text-sm font-medium text-dead-end">
                  Already tried · {Math.round(match.confidence * 100)}% match · could save {match.hoursSaved} hours
                </p>
                <AttemptSummary attempt={match.attempt} />
                <p className="text-sm leading-relaxed text-muted-foreground">{match.reason}</p>
                <FeedbackButton targetId={match.warningId} />
              </RecordCard>
            ))
          : null}
      </div>
    </>
  )
}
