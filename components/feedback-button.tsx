'use client'

import { useState } from 'react'

export function FeedbackButton({ targetId, kind = 'warning' }: { targetId: string; kind?: 'warning' | 'answer' | 'check' }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function send() {
    setState('sending')
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: { kind, id: targetId }, verdict: 'not_relevant' }),
    }).catch(() => undefined)
    setState(response?.ok ? 'sent' : 'error')
  }

  if (state === 'sent') return <p className="text-sm text-muted-foreground">Noted as not relevant. Reflection will use this.</p>
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={send}
        disabled={state === 'sending'}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-index disabled:opacity-60"
      >
        {state === 'sending' ? 'Saving' : 'Not relevant'}
      </button>
      {state === 'error' ? <span className="text-sm text-dead-end">Could not save. Try again.</span> : null}
    </div>
  )
}
