# Afia Stage 1 Remediation Plan

## Trigger
The first dev eval was stopped early after a poor partial sample:
- 4 fixtures processed
- exact (±55ml): 1/4
- close (±110ml): 1/4
- worst miss: 275ml predicted as 975ml

This indicates a prompt/measurement problem, not just an API quota problem.

## Root cause hypothesis
The old scoring contract trusted a model-generated `fillPercent`, then derived `remainingMl` from `fillPercent * 15`. That encouraged vague fullness guesses instead of visual boundary detection.

## Remediation objectives
1. Force the model to detect the visible oil-air boundary first.
2. Compute `remainingMl` in code from bottle geometry instead of trusting a guessed percentage.
3. Shorten iteration loops with a fixed 12-image probe set covering all dev strata.
4. Re-run full dev only after probe-set improvement.

## Implemented in this remediation pass
- Rewrote the v1 prompt around meniscus-first boundary detection.
- Removed `fillPercent` from the model output schema.
- Updated parser to derive `remainingMl` from `oilSurfaceYRatio` and fixed 1.5L bottle geometry.
- Added a committed 12-image probe manifest at `worker/test/fixtures/dev/probe-manifest.json`.

## Probe set design
The probe set contains one fixture per dev stratum (12 total):
- aug:empty-low:aug
- aug:high:aug
- aug:mid-high:aug
- aug:mid-low:aug
- real:empty-low:early
- real:empty-low:late
- real:high:early
- real:high:late
- real:mid-high:early
- real:mid-high:late
- real:mid-low:early
- real:mid-low:late

It intentionally includes the hard failures from the stopped dev run so prompt revisions are tested against known problem cases immediately.

## Next recommended steps
1. Add runner support for `probe-manifest.json` as a first-class eval target.
2. Run the 12-image probe set with the new prompt.
3. Inspect worst misses and raw outputs.
4. Expand few-shot anchors if the probe set still collapses toward mid-range values.
5. Only then rerun the full 60-image dev eval.

## Non-goals
- No holdout changes.
- No comparator changes.
- No UX/deployment work.
- No threshold weakening.
