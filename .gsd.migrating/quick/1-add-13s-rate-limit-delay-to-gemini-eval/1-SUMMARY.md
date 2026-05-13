# Quick Task: "Add 13s rate limit delay to Gemini eval runner"

**Date:** 2026-05-12
**Branch:** gsd/quick/1-add-13s-rate-limit-delay-to-gemini-eval

## What Changed
- Added a 13-second delay between eval requests in `worker/src/eval/run.ts` to stay under Gemini free-tier request-per-minute limits.
- Added retry handling in `worker/src/llm/gemini.ts` for quota/rate-limit responses (429), honoring Gemini's provided retry delay before retrying.
- Wired eval analysis to rotate across multiple configured Gemini API keys when a key is quota-limited.
- Rewrote the v1 prompt around boundary detection instead of fullness guessing.
- Implemented Workstream 1 by removing `fillPercent` from the model output contract and deriving `remainingMl` from `oilSurfaceYRatio` in code using fixed 1.5L bottle geometry.
- Added a committed 12-image probe manifest to support faster Stage 1 prompt iteration.
- Wrote a durable remediation plan at `docs/superpowers/plans/2026-05-12-stage1-remediation-plan.md`.
- Expanded the few-shot anchors beyond 1500 / 750 / 0 to include 1210, 935, 495, and 275ml.
- Added richer diagnostics to `eval/run.ts` (confusion bands, avg confidence, per-source breakdown, worst misses).

## Files Modified
- `worker/src/env.ts`
- `worker/src/eval/run.ts`
- `worker/src/eval/parse-response.ts`
- `worker/src/eval/probe-gemini-frame.ts`
- `worker/src/llm/analyze.ts`
- `worker/src/llm/gemini.ts`
- `worker/src/prompt/load.ts`
- `worker/src/prompt/v1/system.md`
- `worker/src/prompt/v1/bottle-reference.md`
- `worker/src/prompt/v1/few-shots/*.json`
- `worker/src/routes/analyze.ts`
- `worker/test/parse-response.test.ts`
- `worker/test/analyze-route.test.ts`
- `worker/test/stage1-flow.test.ts`
- `worker/test/fixtures/dev/probe-manifest.json`
- `packages/shared/src/schemas.ts`
- `docs/superpowers/plans/2026-05-12-stage1-remediation-plan.md`
- `worker/package.json`

## Verification
- `pnpm --filter worker test`
- `pnpm --filter worker build`
- Ran probe eval which timed out but showed model repeating few-shot values verbatim.
