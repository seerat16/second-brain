import type { Attempt, Decision } from './types'

export function attemptText(attempt: Pick<Attempt, 'goal' | 'approach' | 'blockers' | 'alternative'>): string {
  const blockers = attempt.blockers.map((blocker) => `${blocker.type}: ${blocker.detail}`).join('; ')
  return [`Goal: ${attempt.goal}`, `Approach: ${attempt.approach}`, blockers && `Blockers: ${blockers}`, attempt.alternative && `Instead: ${attempt.alternative}`]
    .filter(Boolean)
    .join('\n')
}

export function decisionText(decision: Pick<Decision, 'title' | 'rationale'>): string {
  return `Decision: ${decision.title}\nWhy: ${decision.rationale}`
}
