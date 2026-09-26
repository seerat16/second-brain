import type { AttemptStatus, DecisionStatus } from '@/lib/types'

export type Mark = 'dead-end' | 'revisitable' | 'current' | 'superseded'

const MARK_STYLES: Record<Mark, { dot: string; text: string; label: string }> = {
  'dead-end': { dot: 'bg-dead-end', text: 'text-dead-end', label: 'Dead end' },
  revisitable: { dot: 'bg-revisitable', text: 'text-revisitable', label: 'Revisitable' },
  current: { dot: 'bg-live', text: 'text-live', label: 'Current' },
  superseded: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'Superseded' },
}

export function markFor(record: { status: AttemptStatus | DecisionStatus; kind: 'attempt' | 'decision' }): Mark {
  if (record.kind === 'decision') return record.status === 'superseded' ? 'superseded' : 'current'
  return record.status === 'revisitable' ? 'revisitable' : 'dead-end'
}

export function StatusMark({ mark, label }: { mark: Mark; label?: string }) {
  const style = MARK_STYLES[mark]
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${style.text}`}>
      <span aria-hidden="true" className={`size-2.5 rounded-full ${style.dot}`} />
      {label ?? style.label}
    </span>
  )
}

export function StatusLegend({ marks = ['dead-end', 'revisitable', 'current'] }: { marks?: Mark[] }) {
  return (
    <ul aria-label="Status legend" className="flex flex-wrap gap-x-6 gap-y-2">
      {marks.map((mark) => (
        <li key={mark}>
          <StatusMark mark={mark} label={mark === 'dead-end' ? 'Failed' : undefined} />
        </li>
      ))}
    </ul>
  )
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="font-serif text-4xl text-balance md:text-5xl">{title}</h1>
      {description ? <p className="max-w-prose leading-relaxed text-muted-foreground text-pretty">{description}</p> : null}
    </header>
  )
}

export function RecordCard({ children }: { children: React.ReactNode }) {
  return <article className="flex flex-col gap-3 rounded-md border border-border bg-background p-5">{children}</article>
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-6">
      <p className="font-medium">{title}</p>
      {children ? <div className="leading-relaxed text-muted-foreground">{children}</div> : null}
    </div>
  )
}

export function ErrorState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md border border-dead-end/40 p-6">
      <p className="font-medium text-dead-end">{title}</p>
      {children ? <div className="leading-relaxed text-muted-foreground">{children}</div> : null}
    </div>
  )
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-muted-foreground">
      <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-muted-foreground" />
      {label}
    </div>
  )
}
