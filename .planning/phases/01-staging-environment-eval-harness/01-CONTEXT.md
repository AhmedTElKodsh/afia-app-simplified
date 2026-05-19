# Phase 1: Staging Environment & Eval Harness — Context

**Gathered:** 2026-05-15 (with BMAD agent team review)
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish staging Worker environment and automated CI pipeline before any accuracy tuning begins. This phase creates the infrastructure foundation that Phases 2-5 depend on. No accuracy work, no model training, no production domain.

Requirements: OPS-01, OPS-02, TEST-01, TEST-03, UX-01
</domain>

<decisions>
## Implementation Decisions

### CI/CD Pipeline Structure

- **D-01**: Single GitHub Actions workflow with staged jobs (`ci.yaml`). One file, conditional execution per trigger.
- **D-02**: Trigger matrix:
  - Push/PR → lint + vitest + tsc build + eval:dev-quick (10 samples)
  - Merge to main → full eval:dev (40 samples) + eval:holdout (36 samples) + deploy staging
  - Nightly cron → full eval:dev + eval:holdout for regression drift detection
  - Manual → signoff (human reviews staging JSONL output)
- **D-03**: Quick eval path-filtered — only fires on `worker/src/` or `evals/` changes (not README, docs, etc.)
- **D-04**: Quick eval limited to 10 fixture samples (~10 min, ~$0.50). Full eval ~30 min, ~$5 per run.
- **D-05**: Signoff gate stays manual (human judgment on OCR/parsing quality). Do NOT automate the signoff decision.

### Wrangler Environment Strategy

- **D-06**: Existing `worker/wrangler.jsonc` deploys to `afia-stage1.workers.dev` — that IS staging.
- **D-07**: No `--env` split until Phase 5. Single config, one deployment target for Phase 1-3.
- **D-08**: When Phase 5 arrives, add separate `wrangler.production.jsonc` for production config. Staging config stays as-is.

### Secrets Across Environments

- **D-09**: Shared Gemini/Grok/LLM API keys between local dev, staging Worker, and (future) production. CI eval runs against the same key pool.
- **D-10**: Separate Supabase instances for staging vs production. Staging gets its own Supabase project to prevent data pollution.
- **D-11**: Service role key scope fix (OPS-05) is deferred to Phase 4. Phase 1 uses existing pattern.

### Fallback UX

- **D-12**: Degraded results view on partial failure. If CV succeeded but LLM failed, show CV result with confidence warning. If both fail, show fatal error card.
- **D-13**: Fatal error card shows: error description, error code, retry button (navigates to `/scan`), contact support link.
- **D-14**: Implementation: `CaptureShell.tsx` persists structured `{ errors, tier, confidence, remainingMl }` to sessionStorage. `ResultShell.tsx` branches on `tier` + `errors.length`. ~40 lines of new component variants. No backend changes.

### OpenCode's Discretion

- Exact GitHub Actions YAML structure and job names
- Quick eval manifest composition (which 10 fixtures to select)
- Staging Supabase project provisioning
- CI runner OS, concurrency settings, cache strategy
- Error card visual design (colors, spacing, iconography)

</decisions>

<canonical_refs>
## Canonical References

### Pipeline
- `.planning/ROADMAP.md` §Phase 1 — Phase goal, success criteria, requirements list
- `.planning/REQUIREMENTS.md` §v1 — Full requirement definitions for OPS-01, OPS-02, TEST-01, TEST-03, UX-01
- `.planning/PROJECT.md` — Project context, constraints, validated capabilities

### Codebase
- `worker/wrangler.jsonc` — Current wrangler config (no staging split, single env)
- `worker/package.json` §scripts — Available eval commands (eval:dev, eval:holdout, signoff, eval:cv)
- `worker/src/env.ts` §8-27 — All environment variable bindings and their current sources
- `worker/src/eval/signoff.ts` §12-15 — Signoff gate thresholds (aggregate ≥90%, per-stratum ≥80%)
- `worker/src/eval/cv-eval.ts` §1-30 — CV eval runner entry point and fixture manifest loading
- `worker/src/eval/run.ts` §31-36 — Eval runner rate-limiting and fixture iteration
- `web/src/components/ResultShell.tsx` §34, §55-60 — Current fallback UX for missing results
- `web/src/components/CaptureShell.tsx` §82-88 — Current error handling (binary pass/fail)

### No external specs
All requirements for this phase are captured in the decisions above and the referenced planning documents.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worker/src/eval/cv-eval.ts` — CV pipeline eval harness (252 lines). Reads fixture manifest, runs pipeline, reports per-image and aggregate metrics. Already handles pass/fail/close buckets.
- `worker/src/eval/signoff.ts` — Human review gate (96 lines). Computes aggregate ≥90% and per-stratum ≥80% thresholds. Requires 3 holdout runs. Includes reviewer sign-off flow.
- `worker/src/eval/run.ts` — Generic eval runner with rate-limit handling. Supports `--set=dev|holdout|edge-case` flags.
- `worker/package.json` — Scripts: `test` (vitest), `eval:dev`, `eval:holdout`, `eval:cv`, `signoff`
- `web/src/components/ResultShell.tsx` — Existing result display. Has fallback for "no data" state. Oil level slider, cup counter, metric display components.

### Established Patterns
- tsx runtime scripts for eval (not vitest) — `worker/src/eval/*.ts` use `tsx` directly
- SessionStorage for capture/analysis state in web app
- Zod schemas for API contract validation in shared package
- Environment-specific env.ts with typed Env interface

### Integration Points
- GitHub Actions integration: no existing workflows; new `.github/workflows/ci.yaml` needs creation
- Staging Worker: current `afia-stage1` name; no changes needed for staging deployment
- Eval in CI: `pnpm eval:dev --manifest=...` — quick eval needs a `10-fixture` manifest
- Fallback UX: `CaptureShell.tsx:82` error handler → sessionStorage → `ResultShell.tsx:34` display

</code_context>

<specifics>
## Specific Ideas

- "Start simple, evolve later" — chosen for CI pipeline (single workflow now, split later if needed)
- Staging = current `afia-stage1.workers.dev` — no new URLs, no custom domain until Phase 5
- "Users who get a borderline LLM timeout still want *something*" — degraded results over empty error
- Quick eval should select diverse fixtures, not just first 10 — cover empty/partial/full buckets

</specifics>

<deferred>
## Deferred Ideas

- Splitting CI into separate CI + CD workflows — consider when production deploy is added in Phase 5
- Full production domain setup — Phase 5
- Supabase service role key split (anon vs service_role) — Phase 4 (OPS-05)
- Provider circuit breaker — Phase 5 (OPS-07)
- Admin dashboard UI — v2 milestone

</deferred>

---

*Phase: 01-staging-environment-eval-harness*
*Context gathered: 2026-05-15*
