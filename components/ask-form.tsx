'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Attempt, Decision } from '@/lib/types'
import { EmptyState, ErrorState, LoadingState, RecordCard, StatusMark, markFor } from './states'

type Citation = { kind: 'attempt'; record: Attempt } | { kind: 'decision'; record: Decision }
type Result = { answer: string; citations: Citation[]; supported: boolean }
type State = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; result: Result }

export function AskForm() {
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setState({ status: 'loading' })
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }).catch(() => undefined)
    const data = await response?.json().catch(() => ({}))
    if (!response?.ok) return setState({ status: 'error', message: data?.error ?? 'No answer.' })
    setState({ status: 'done', result: data })
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-3 md:flex-row">
        <label htmlFor="question" className="sr-only">
          Question
        </label>
        <input
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Why don't we use Postgres for search?"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2"
        />
        <button
          type="submit"
          disabled={question.trim().length < 3 || state.status === 'loading'}
          className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
        >
          Ask
        </button>
      </form>
      <div aria-live="polite" className="flex flex-col gap-4">
        {state.status === 'loading' ? <LoadingState label="Reading memory" /> : null}
        {state.status === 'error' ? <ErrorState title="Ask failed">{state.message}</ErrorState> : null}
        {state.status === 'done' && !state.result.supported ? <EmptyState title="Not in memory">{state.result.answer}</EmptyState> : null}
        {state.status === 'done' && state.result.supported ? (
          <RecordCard>
            <p className="font-serif text-xl leading-relaxed text-pretty">{state.result.answer}</p>
            <h2 className="text-sm font-medium text-muted-foreground">Sources</h2>
            <ul className="flex flex-col gap-2">
              {state.result.citations.map((citation) => (
                <li key={citation.record._id} className="flex flex-wrap items-center gap-3">
                  <StatusMark mark={markFor({ kind: citation.kind, status: citation.record.status })} />
                  {citation.kind === 'attempt' ? (
                    <Link href={`/dead-ends/${citation.record._id}`} className="underline underline-offset-4">
                      {citation.record.approach}
                    </Link>
                  ) : (
                    <span>{citation.record.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </RecordCard>
        ) : null}
      </div>
    </>
  )
}
