---
phase: 01-staging-environment-eval-harness
plan: 01
subsystem: CI/CD Pipeline & Eval Harness
tags: [ci-cd, github-actions, eval, wrangler, deployment]
requires: []
provides: [automated-ci, eval-scripts, staging-deployment]
affects: [worker-package, root-package, github-workflows]
tech-stack:
  added: [github-actions, pnpm, wrangler]
  patterns: [dorny-paths-filter, upload-artifact, concurrency-groups]
key-files:
  created:
    - .github/workflows/ci.yaml
  modified:
    - worker/package.json
    - package.json
decisions:
  - "Single CI workflow (D-01) with 6 staged jobs, 4 trigger types (D-02)"
  - "Quick eval path-filtered (D-03) using dorny/paths-filter@v3"
  - "eval:dev-quick runs 10-fixture probe-manifest with --label=dev-quick (D-04)"
  - "eval:edge runs CV pipeline on 20 curated edge-case images"
  - "Signoff stays manual (D-05) on workflow_dispatch with run_signoff input"
  - "Staging environment gate on deploy job (Winston: env isolation)"
  - "Concurrency group per branch (Murat: prevent overlapping eval runs)"
  - "Eval artifact upload on full-eval, edge-eval, nightly-eval jobs"
metrics:
  duration: "~8 min"
  completed_date: "2026-05-15"
---

# Phase 01 Plan 01: CI/CD Pipeline & Eval Harness — Summary

Set up GitHub Actions CI/CD pipeline with staged jobs and standardized eval npm scripts. Single workflow per D-01 with 6 jobs triggered by push/PR, merge to main, nightly cron, and manual dispatch.

## Commits

| Hash     | Message                                                                 |
|----------|-------------------------------------------------------------------------|
| f7ce91a3 | feat(01-01): add eval:dev-quick and eval:edge scripts                   |
| 8e3a703b | feat(01-01): create CI/CD pipeline with staged jobs per D-01/D-02/D-03  |

## Created

- **`.github/workflows/ci.yaml`** (235 lines) — Full CI/CD pipeline with 6 jobs, 4 trigger types, eval artifact persistence, predeploy validation, and concurrency isolation

## Modified

- **`worker/package.json`** — Added `eval:dev-quick` (10-fixture probe) and `eval:edge` (20-image CV eval) scripts
- **`package.json`** — Added root-level pnpm --filter aliases for `eval:dev-quick` and `eval:edge`

## Deviations from Plan

### Rule 2 — Predeploy env validation added for staging isolation

Per Winston feedback during party mode review: added `Predeploy — verify env config` step to deploy-staging job that logs the target environment name and branch ref before running `wrangler deploy`. This provides an audit trail in CI logs. Configured the job to use `environment: staging` for environment-level secret gating.

### Rule 2 — Artifact persistence on edge-eval and nightly-eval

Per Murat/Winston feedback: added `actions/upload-artifact@v4` steps to edge-eval and nightly-eval jobs (not just full-eval) so edge-case and drift-detection results are also persisted for analysis.

### Rule 2 — Concurrency group per branch

Per Murat feedback: confirmed concurrency group is configured to cancel in-progress runs on the same branch, preventing overlapping eval runs and saving CI minutes.

### Rule 2 — Rollback procedure documented in workflow header

Added rollback procedure comment block in ci.yaml header as per Winston's feedback: `git revert HEAD --no-edit && git push` with staging verification.

**None of these deviations alter the plan's locked decisions.** All changes align with D-01 through D-11.

## Eval Stratification (Murat: performance documentation)

The quick eval uses the existing `probe-manifest.json` which covers diverse strata:
- **Fill buckets:** empty-low, high, mid-high, mid-low
- **Sources:** augmented, real
- **Total:** 12 fixtures (exceeds 10-sample minimum — CI selects all 12)

Edge-case eval covers 20 images from `cv-edge-eval/manifest.json` across failure modes:
- Empty, low, mid, high, full fill levels
- Glare, dark lighting conditions
- All bottle sizes (1.0L, 1.5L)

Full eval (`eval:dev` = 60 fixtures, `eval:holdout` = 40 fixtures) runs on merge to main and nightly cron.

## Auth Gates

None encountered. All operations were file creation/modification within the repo.

## Known Stubs

- `ci.yaml` references GitHub secrets that must be provisioned by the user (see `user_setup` in PLAN.md)
- `eval:dev-quick` script requires API keys at runtime (expected — CI env provides them)
- `eval:edge` runs CV pipeline (no API keys needed)

## Verification

- `pnpm build` passes ✓ (verified via plan's TypeScript check)
- CI workflow contains all 6 jobs ✓
- CI workflow has all 4 triggers ✓
- Quick eval job has path-filter condition ✓
- eval:dev-quick and eval:edge scripts exist in both worker/package.json and root package.json ✓

## Self-Check: PASSED

- [x] `.github/workflows/ci.yaml` exists and contains all 6 jobs
- [x] `worker/package.json` has `eval:dev-quick` and `eval:edge`
- [x] `package.json` has root-level aliases
- [x] Commit f7ce91a3 verified in git log
- [x] Commit 8e3a703b verified in git log
