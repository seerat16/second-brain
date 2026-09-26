import { AskForm } from '@/components/ask-form'
import { PageHeader } from '@/components/states'

export default function Page() {
  return (
    <>
      <PageHeader title="Ask the brain" description="Ask why something is the way it is. Every answer cites the records it came from." />
      <AskForm />
    </>
  )
}
