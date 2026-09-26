import Link from 'next/link'
import { EmptyState, PageHeader, RecordCard } from '@/components/states'
import { DEFAULT_PROJECT_ID, loadImpact } from '@/lib/memory'

export const dynamic = 'force-dynamic'

export default async function ImpactPage() {
  const impact = await loadImpact(DEFAULT_PROJECT_ID)
  return (
    <>
      <PageHeader title="Impact" description="Warnings ProjectBrain raised, the hours they could save, and whether the harness is getting more precise." />
      <RecordCard>
        <p className="text-sm text-muted-foreground">Hours saved by warnings not marked irrelevant</p>
        <p className="font-serif text-5xl">{impact.hoursSaved}</p>
      </RecordCard>

      <section aria-labelledby="trend" className="flex flex-col gap-3">
        <h2 id="trend" className="font-serif text-2xl">
          Precision by eval run
        </h2>
        {impact.precisionTrend.length ? (
          <ol className="flex flex-col gap-2">
            {impact.precisionTrend.map((point) => (
              <li key={point.createdAt} className="flex items-center gap-3 text-sm">
                <span className="w-12 font-mono">v{point.version}</span>
                <span className="h-2 rounded-full bg-live" style={{ width: `${Math.max(4, point.precision * 60)}%` }} aria-hidden="true" />
                <span className="font-mono">{Math.round(point.precision * 100)}%</span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No eval runs yet">Run reflection in the lab or pnpm eval.</EmptyState>
        )}
      </section>

      <section aria-labelledby="warnings" className="flex flex-col gap-3">
        <h2 id="warnings" className="font-serif text-2xl">
          Warnings
        </h2>
        {impact.warnings.length ? (
          <ul className="flex flex-col gap-2">
            {impact.warnings.map((warning) => (
              <li key={warning._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm">
                <Link href={`/dead-ends/${warning.attemptId}`} className="underline underline-offset-4">
                  {warning.attemptId}
                </Link>
                <span className="text-muted-foreground">
                  {warning.channel} · {warning.hoursSaved}h · {Math.round(warning.confidence * 100)}%{warning.notRelevant ? ' · not relevant' : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No warnings yet">Check an idea or post in Slack to raise one.</EmptyState>
        )}
      </section>
    </>
  )
}
