import { FixtureSummary } from '@/components/fixture-summary'
import { EmptyState, PageHeader, StatusLegend } from '@/components/states'
import { getFixture } from '@/lib/fixtures'

export default function TimelinePage() {
  const orbit = getFixture('orbit')
  return (
    <>
      <PageHeader
        title="Timeline"
        description="Orbit's decisions and attempts over six weeks. The full timeline is built in f-b-04; until then, this page shows the shared fixture both lanes build against."
      />
      {orbit ? <FixtureSummary fixture={orbit} /> : <EmptyState title="No Orbit fixture found" />}
      <StatusLegend />
    </>
  )
}
