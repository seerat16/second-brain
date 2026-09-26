import Link from 'next/link'
import type { Attempt } from '@/lib/types'
import { StatusMark, markFor } from './states'

export function AttemptSummary({ attempt, link = true }: { attempt: Attempt; link?: boolean }) {
  const blocker = attempt.blockers[0]
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusMark mark={markFor({ kind: 'attempt', status: attempt.status })} />
        <span className="text-sm text-muted-foreground">{attempt.hoursSpent} hours spent</span>
      </div>
      <p className="font-serif text-xl text-balance">
        {link ? (
          <Link href={`/dead-ends/${attempt._id}`} className="underline decoration-border underline-offset-4 hover:decoration-foreground">
            {attempt.approach}
          </Link>
        ) : (
          attempt.approach
        )}
      </p>
      <dl className="grid gap-2 text-sm leading-relaxed md:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">Goal</dt>
        <dd>{attempt.goal}</dd>
        {blocker ? (
          <>
            <dt className="text-muted-foreground">Blocker</dt>
            <dd>{blocker.detail}</dd>
          </>
        ) : null}
        {attempt.alternative ? (
          <>
            <dt className="text-muted-foreground">Instead</dt>
            <dd>{attempt.alternative}</dd>
          </>
        ) : null}
      </dl>
    </div>
  )
}
