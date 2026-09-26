import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AttemptSummary } from '@/components/attempt-summary'
import { RecordCard, StatusMark, markFor } from '@/components/states'
import { DEFAULT_PROJECT_ID, loadAttempt } from '@/lib/memory'

export const dynamic = 'force-dynamic'

export default async function DeadEndPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await loadAttempt(DEFAULT_PROJECT_ID, id)
  if (!found) notFound()
  const { attempt, related, sourceMessages } = found

  return (
    <>
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        {'← Timeline'}
      </Link>
      <RecordCard>
        <AttemptSummary attempt={attempt} link={false} />
      </RecordCard>

      <section aria-labelledby="conditions" className="flex flex-col gap-3">
        <h2 id="conditions" className="font-serif text-2xl">
          Would work again if
        </h2>
        {attempt.conditions.length ? (
          <ul className="flex flex-col gap-2">
            {attempt.conditions.map((condition) => (
              <li key={condition.description} className="flex items-start gap-3 leading-relaxed">
                <StatusMark mark={condition.met ? 'revisitable' : 'dead-end'} label={condition.met ? 'Met' : 'Not met'} />
                <span>{condition.description}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No conditions recorded — treat as a permanent dead end.</p>
        )}
      </section>

      <section aria-labelledby="evidence" className="flex flex-col gap-3">
        <h2 id="evidence" className="font-serif text-2xl">
          Evidence
        </h2>
        <ul className="flex flex-col gap-2">
          {attempt.evidence.map((item) => (
            <li key={item.summary} className="leading-relaxed">
              <span className="font-mono text-sm text-muted-foreground">{item.kind}</span> {item.summary}
            </li>
          ))}
        </ul>
      </section>

      {related.length ? (
        <section aria-labelledby="related" className="flex flex-col gap-3">
          <h2 id="related" className="font-serif text-2xl">
            Related decisions
          </h2>
          <ul className="flex flex-col gap-2">
            {related.map(({ edge, decision }) =>
              decision ? (
                <li key={edge._id} className="flex flex-wrap items-center gap-3">
                  <StatusMark mark={markFor({ kind: 'decision', status: decision.status })} />
                  <span className="font-mono text-sm text-muted-foreground">{edge.kind}</span>
                  <span>{decision.title}</span>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      {sourceMessages.length ? (
        <section aria-labelledby="sources" className="flex flex-col gap-3">
          <h2 id="sources" className="font-serif text-2xl">
            Source messages
          </h2>
          <ul className="flex flex-col gap-2">
            {sourceMessages.map((message) => (
              <li key={message._id} className="border-l-2 border-border pl-4 leading-relaxed">
                <p>{message.text}</p>
                <p className="text-sm text-muted-foreground">
                  {message.author} · {new Date(message.postedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
