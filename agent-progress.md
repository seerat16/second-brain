# Agent Progress — ProjectBrain

## Verified state

The shared foundation is scaffolded: Next.js 16 app shell, shared types (`lib/types.ts`), MongoDB client, placeholder contracts (`lib/contracts/`), the Orbit fixture, db setup and fixture scripts, and `/api/health` and `/api/ready`.

The product contract is `docs/plans/2026-09-26-002-feat-projectbrain-dead-end-memory-plan.md`. Work is split into three lanes (see `docs/README.md`): shared `f-sh-01..05`, Capture `f-a-01..09`, and Recall `f-b-01..09`. That makes 23 features. All five shared features (`f-sh-01..05`) are `passing`, so Checkpoint 0 is closed.

Both lanes are now implemented on OpenRouter only: one key covers chat and 1536-dim embeddings, and OpenAI is not used. Status:

- **Passing:** `f-a-03`, `f-a-07`, `f-b-01`, `f-b-06`.
- **In progress:** `f-a-02` and `f-b-07`.
- **Built, not verified yet:** the rest have code and pages that return 200, but their spec verification steps haven't been run. `feature_list.json` evidence says which.
- **Not built:** `f-a-08` (S3 evidence storage) and `f-a-09` (AWS hosting and worker).

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

Finish the verification steps for `f-a-02` and `f-b-07`, then work through the built-but-unverified features, one per lane at a time. Slack features (`f-a-06`, `f-b-05`) need `SLACK_SIGNING_SECRET` and `SLACK_BOT_TOKEN`. `f-a-08` and `f-a-09` need AWS credentials.

## In progress

- `f-a-02` (ingest): Postgres LIKE 9-hour and auth-decision extraction checks remain.
- `f-b-07` (serve): v2 was promoted, raising overall from 0.9 to 0.95. A forced rejection check and a feedback-as-input check remain.

## Known risks

- The Atlas `projectbrain` database is seeded with Orbit plus OpenRouter embeddings (`pnpm db:seed`). Live checks also left some test captures and harness v2 in Atlas, so re-seed before a demo.
- OpenRouter limits new accounts to 20 requests per minute per model. `lib/llm.ts` retries 429s with backoff, but running the eval and reflection at the same time is slow.
- The v0 dev preview failed to start on a sandbox-injected adapter. The production build succeeds.
- Slack and AWS credentials are not configured.
- The retired collaboration-suite plan and its screen images are no longer requirements. Do not restore them as product scope.
- Graph view, pull-request comments, voice transcription, and nightly reflection are later than the demo path. Starting them first would skip the warning, the citation, and the measured harness change.

## Session log

### 2026-09-26 — Both lanes on OpenRouter

- Added `lib/llm.ts`: an OpenRouter-only client for chat, JSON output, and embeddings, with retry on 429. Removed `OPENAI_API_KEY` from the required env.
- Capture lane: classify, extract, the merge/ingest pipeline, idempotent `sourceId`, revisitable conditions, Slack events and interactions routes, `/api/capture`, and the Capture page.
- Recall lane: dead-end check, Ask with citations, eval set and runner, reflection and promotion, feedback, and the Timeline, dead-end detail, Check, Ask, Graph, Lab, and Impact pages.
- Evidence:
  - `tsc` clean, 14/14 tests, and the build passes.
  - `pnpm db:seed` loaded 6 messages, 4 attempts, 5 decisions, and 5 edges.
  - Duplicate capture is detected.
  - The App Runner decision reopens WebSockets.
  - `pnpm eval` on v1 scored overall 0.9.
  - Reflection promoted v2 (0.95).
  - All 8 pages return 200, and the dead-end detail page was checked in the browser.

### 2026-09-26 — f-sh-05 App Shell and Design Tokens

- Matched the shell to `design/01-timeline.png`: ProjectBrain brand row, ORBIT project label, serif nav with an underlined active item, thin red margin line, and a shared `StatusLegend`.
- Fixed a bug where the green `current` token collided with Tailwind's `currentColor` (the dot rendered black). Renamed it to `live`. Use `bg-live`/`text-live` for current decisions.
- Verified: tsc clean, vitest 14/14, `pnpm build` ok, and all 7 routes render in the shell with the correct `aria-current` in the browser at desktop and narrow widths.

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
