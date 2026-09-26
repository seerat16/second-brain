import Link from 'next/link'
import { EmptyState, PageHeader, RecordCard, StatusLegend, StatusMark, markFor } from '@/components/states'
import { DEFAULT_PROJECT_ID, loadMemory } from '@/lib/memory'

export const dynamic = 'force-dynamic'

type Row = { id: string; when: string; title: string; detail: string; kind: 'attempt' | 'decision'; status: string; href?: string }

export default async function TimelinePage() {
  const memory = await loadMemory(DEFAULT_PROJECT_ID)
  if (!memory) return <EmptyState title="No project memory yet">Seed Orbit with pnpm db:seed.</EmptyState>

  const rows: Row[] = [
    ...memory.attempts.map((a) => ({
      id: a._id,
      when: a.startedAt,
      title: a.approach,
      detail: `${a.hoursSpent} hours${a.alternative ? ` · instead: ${a.alternative}` : ''}`,
      kind: 'attempt' as const,
      status: a.status,
      href: `/dead-ends/${a._id}`,
    })),
    ...memory.decisions.map((d) => ({
      id: d._id,
      when: d.decidedAt,
      title: d.title,
      detail: d.rationale,
      kind: 'decision' as const,
      status: d.status,
    })),
  ].sort((a, b) => b.when.localeCompare(a.when))

  return (
    <>
      <PageHeader title="Timeline" description={`${memory.project.name}: every decision and every attempt, newest first. Failed attempts link to their full record.`} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <StatusLegend marks={['dead-end', 'revisitable', 'current', 'superseded']} />
        <span className="text-sm text-muted-foreground">Source: {memory.source === 'atlas' ? 'MongoDB Atlas' : 'fixture (Atlas empty)'}</span>
      </div>
      <ol className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id}>
            <RecordCard>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusMark mark={markFor({ kind: row.kind, status: row.status as never })} />
                <time dateTime={row.when} className="text-sm text-muted-foreground">
                  {new Date(row.when).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </time>
              </div>
              <p className="font-medium">
                {row.href ? (
                  <Link href={row.href} className="underline decoration-border underline-offset-4 hover:decoration-foreground">
                    {row.title}
                  </Link>
                ) : (
                  row.title
                )}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{row.detail}</p>
            </RecordCard>
          </li>
        ))}
      </ol>
    </>
  )
}
