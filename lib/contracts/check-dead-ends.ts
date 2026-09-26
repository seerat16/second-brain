import { findDeadEnds, tokenize } from '../recall/dead-ends'
import type { DeadEndMatch } from '../types'
import { getActiveHarness } from './get-active-harness'

export { tokenize }

// Owner: Recall lane (f-b-01). Vector search over dead ends, then a judge model.
export async function checkDeadEnds(projectId: string, text: string): Promise<DeadEndMatch[]> {
  const harness = await getActiveHarness(projectId).catch(() => undefined)
  return harness ? findDeadEnds(projectId, text, harness) : []
}
