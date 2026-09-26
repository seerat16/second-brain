'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ErrorState, LoadingState } from './states'

export function ReflectButton() {
  const router = useRouter()
  const [state, setState] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; message?: string }>({ status: 'idle' })

  async function run() {
    setState({ status: 'running' })
    const response = await fetch('/api/harness/reflect', { method: 'POST' }).catch(() => undefined)
    const data = await response?.json().catch(() => ({}))
    if (!response?.ok) return setState({ status: 'error', message: data?.error ?? 'Reflection failed.' })
    setState({ status: 'done', message: `${data.promoted ? 'Promoted' : 'Rejected'} v${data.version}: ${data.reason}` })
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={run}
        disabled={state.status === 'running'}
        className="self-start rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
      >
        Run reflection
      </button>
      <div aria-live="polite">
        {state.status === 'running' ? <LoadingState label="Scoring the active harness and one candidate (about two minutes)" /> : null}
        {state.status === 'done' ? <p className="leading-relaxed">{state.message}</p> : null}
        {state.status === 'error' ? <ErrorState title="Reflection failed">{state.message}</ErrorState> : null}
      </div>
    </div>
  )
}
