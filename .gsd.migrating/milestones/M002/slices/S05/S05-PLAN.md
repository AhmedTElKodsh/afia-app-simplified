# S05: Edge-case Corpus & Model Versioning (Phase 2-01)

**Goal:** Expand edge-case corpus and define model versioning.
**Demo:** 30-image edge-case corpus and model version schema.

## Must-Haves

- Complete the planned slice outcomes.

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: Edge-case Corpus Expansion** `est:1h`
  Run coverage-gap analysis and expand manifest to 30 images.
  - Files: `worker/src/eval/coverage-gap.ts`, `worker/test/fixtures/cv-edge-eval/manifest.json`
  - Verify: ls worker/test/fixtures/cv-edge-eval/manifest.json

- [x] **T02: Model Version Tracking** `est:30m`
  Define model version tracking schema and add validation tests.
  - Files: `worker/src/eval/model-version.ts`, `worker/test/model-version.test.ts`
  - Verify: pnpm --filter worker test -- model-version

## Files Likely Touched

- worker/src/eval/coverage-gap.ts
- worker/test/fixtures/cv-edge-eval/manifest.json
- worker/src/eval/model-version.ts
- worker/test/model-version.test.ts
