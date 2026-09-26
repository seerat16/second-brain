# Agent Progress — ProjectBrain

## Verified state

The shared foundation is scaffolded: Next.js 16 app shell, shared types (`lib/types.ts`), MongoDB client, placeholder contracts (`lib/contracts/`), the Orbit fixture, db setup and fixture scripts, and `/api/health` and `/api/ready`.

The product contract is `docs/plans/2026-09-26-002-feat-projectbrain-dead-end-memory-plan.md`. Work is split into three lanes (see `docs/README.md`): shared `f-sh-01..05`, Capture `f-a-01..09`, and Recall `f-b-01..09`. That makes 23 features. `f-sh-04` is `passing`, `f-sh-01` is `in_progress`, and the rest are `not_started`.

Stack this repo is held to:

- Frontend: Next.js
- Backend: Node.js
- Database: MongoDB
- Cloud: AWS

OpenAI and OpenRouter are model providers called by the API. They are not a second system of record.

Confirmed product direction:

- ProjectBrain remembers what a team decided, what failed, and why.
- Dead-End Memory is the demo: warn with proof, answer with citations, reopen a dead end when conditions change, and promote a harness version only when evals improve.
- The seeded story is Orbit, a team task app, ingested through the real pipeline.
- The memory graph and the nightly AWS reflection job are registered after the demo path.

## Next best action

Finish `f-sh-05` (app shell and design tokens, checked in a browser). That closes Checkpoint 0, and then the Capture (`f-a-01`) and Recall (`f-b-01`) lanes start in parallel.

Before `f-a-01`/`f-b-01` can call models, add `OPENAI_API_KEY` (embeddings) and `OPENROUTER_API_KEY` (classify, judge) to the project vars. `/api/ready` lists which features each missing key blocks.

## In progress

- None. `f-sh-01`, `f-sh-02`, `f-sh-03`, and `f-sh-04` are `passing`; `f-sh-05` is `not_started`.

## Known risks

- The Atlas dev database `projectbrain` is live with the Orbit fixture loaded. Fixture attempts and decisions have no `embedding` yet, so real `$vectorSearch` on them returns nothing until `f-a-02` (embeddings) runs.
- The v0 dev preview failed to start on a sandbox-injected adapter. The production build succeeds.
- OpenAI, OpenRouter, Slack, and AWS credentials are not configured yet.
- `checkDeadEnds`, `checkConditions`, and `ingestMessage` are placeholders (keyword and fixture based). Their owning features (`f-b-01`, `f-a-07`, `f-a-03`) replace the bodies without changing the signatures.
- The retired collaboration-suite plan and its screen images are no longer requirements. Do not restore them as product scope.
- Graph view, pull-request comments, voice transcription, and nightly reflection are later than the demo path. Starting them first would skip the warning, the citation, and the measured harness change.

## Session log

### 2026-09-26 — Shared tasks 1-3 verified on Atlas

- Ran `pnpm db:setup` and `pnpm db:fixtures` against the connected Atlas cluster; all three search indexes reached READY.
- `f-sh-01`: `/api/ready` 200 with MongoDB reachable, 503 naming `MONGODB_URI` when unset.
- `f-sh-02`: project-filtered `$vectorSearch` excludes another project's identical attempt; setup rerun is clean.
- `f-sh-03`: `getActiveHarness('orbit')` reads v1 from Atlas; a second active version is rejected by the `one_active` unique index.
- Marked `f-sh-01`, `f-sh-02`, `f-sh-03` `passing` with evidence in `feature_list.json`.

### 2026-09-26 — Parallel lanes and shared foundation

- Rewrote `docs/` into three lanes: shared (`f-sh-01..05`), Capture (`f-a-01..09`), and Recall (`f-b-01..09`). Added `docs/README.md` with checkpoints and contracts, plus `docs/setup.md`.
- `AGENTS.md`, `init.sh`, and the clean-state checklist now allow one `in_progress` feature per lane.
- Redrew the check-match and Slack warning designs, and added `design/10-capture.png`.
- Scaffolded the shared foundation code.
- Evidence: `tsc --noEmit` exit 0; `vitest run` 14/14 passed; `next build` succeeded; `./init.sh` reports `init ok`.
- `f-sh-04` is `passing`. `f-sh-01` is `in_progress`, pending a live Atlas `/api/ready` check.

### 2026-09-26 — ProjectBrain screen designs

- Added nine desktop references in `design/` for the lab-notebook UI: timeline, dead-end detail, ask, check, graph, harness lab, impact, and the Slack warning.
- Indexed them in `design/screens.md`.
- No feature was marked `in_progress`. No application code was written.

### 2026-09-26 — ProjectBrain replaces the previous product plan

- Retired the collaboration-suite contract, its eleven feature specs, and the generated screen images.
- Added the ProjectBrain Dead-End Memory contract.
- Registered fourteen features, from platform foundation through nightly reflection. None is `in_progress`.
- No application code was implemented.

### 2026-09-26 — Product UI reference screens

- Generated desktop screen images for the retired product direction.
- Those images were removed when the product contract changed.

### 2026-09-26 — Harness skeleton

- Added `AGENTS.md`, `init.sh`, `agent-progress.md`, `feature_list.json`, `docs/`, and `clean-state-checklist.md`.
- No feature is `in_progress`.
