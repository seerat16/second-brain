import { CheckForm } from '@/components/check-form'
import { PageHeader } from '@/components/states'

export default function Page() {
  return (
    <>
      <PageHeader title="Check an idea" description="Paste a plan and see whether the team already hit a dead end with it." />
      <CheckForm />
    </>
  )
}
