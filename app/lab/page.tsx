import { ReflectButton } from '@/components/reflect-button'
import { PageHeader, RecordCard, StatusMark } from '@/components/states'
import { DEFAULT_PROJECT_ID, listHarnessVersions } from '@/lib/memory'

export const dynamic = 'force-dynamic'

const pct = (value?: number) => (value === undefined ? '—' : `${Math.round(value * 100)}%`)

export default async function LabPage() {
  const versions = (await listHarnessVersions(DEFAULT_PROJECT_ID)).toReversed()
  return (
    <>
      <PageHeader
        title="Harness lab"
        description="Every harness version, its eval scores, and why it was kept or rejected. A candidate is only promoted if precision holds and the overall score improves."
      />
      <ReflectButton />
      <ol className="flex flex-col gap-3">
        {versions.map((version) => (
          <li key={version._id}>
            <RecordCard>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-serif text-xl">Version {version.version}</p>
                {version.active ? (
                  <StatusMark mark="current" label="Active" />
                ) : version.rejectedReason ? (
                  <StatusMark mark="dead-end" label="Rejected" />
                ) : (
                  <StatusMark mark="superseded" label="Retired" />
                )}
              </div>
              <p className="leading-relaxed">{version.change ?? 'Initial harness.'}</p>
              {version.rejectedReason ? <p className="text-sm leading-relaxed text-dead-end">{version.rejectedReason}</p> : null}
              <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                {(
                  [
                    ['Precision', version.scores?.deadEndPrecision],
                    ['Recall', version.scores?.deadEndRecall],
                    ['Citations', version.scores?.citationAccuracy],
                    ['Freshness', version.scores?.staleness],
                    ['Overall', version.scores?.overall],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex flex-col">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-mono text-base">{pct(value)}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-muted-foreground">
                k={version.retrieval.k} · minScore={version.retrieval.minScore}
              </p>
            </RecordCard>
          </li>
        ))}
      </ol>
    </>
  )
}
