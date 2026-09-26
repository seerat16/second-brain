import { EmptyState, PageHeader, RecordCard, StatusLegend } from '@/components/states'
import { DEFAULT_PROJECT_ID, loadMemory } from '@/lib/memory'

export const dynamic = 'force-dynamic'

export default async function GraphPage() {
  const memory = await loadMemory(DEFAULT_PROJECT_ID)
  if (!memory) return <EmptyState title="No project memory yet" />
  const names = new Map<string, string>([
    ...memory.attempts.map((a) => [a._id, a.approach] as const),
    ...memory.decisions.map((d) => [d._id, d.title] as const),
    ...memory.entities.map((e) => [e._id, e.name] as const),
  ])
  const byKind = Object.groupBy(memory.edges, (edge) => edge.kind)

  return (
    <>
      <PageHeader title="Graph" description="How attempts, decisions, and components connect. Superseded chains and unblocked dead ends show here first." />
      <StatusLegend marks={['dead-end', 'revisitable', 'current', 'superseded']} />
      {Object.entries(byKind).map(([kind, edges]) => (
        <section key={kind} aria-labelledby={`edge-${kind}`} className="flex flex-col gap-3">
          <h2 id={`edge-${kind}`} className="font-serif text-2xl">
            {kind.replaceAll('_', ' ')} <span className="text-base text-muted-foreground">({edges?.length})</span>
          </h2>
          <RecordCard>
            <ul className="flex flex-col gap-2">
              {edges?.map((edge) => (
                <li key={edge._id} className="flex flex-wrap items-center gap-2 leading-relaxed">
                  <span>{names.get(edge.from.id) ?? edge.from.id}</span>
                  <span aria-hidden="true" className="text-muted-foreground">
                    {'→'}
                  </span>
                  <span className="sr-only">{kind}</span>
                  <span>{names.get(edge.to.id) ?? edge.to.id}</span>
                </li>
              ))}
            </ul>
          </RecordCard>
        </section>
      ))}
    </>
  )
}
