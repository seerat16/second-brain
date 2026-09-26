import { CaptureForm } from '@/components/capture-form'
import { PageHeader } from '@/components/states'

export default function Page() {
  return (
    <>
      <PageHeader title="Capture" description="Post what the team is trying or deciding. ProjectBrain labels it, extracts attempts and decisions, and updates the graph." />
      <CaptureForm />
    </>
  )
}
