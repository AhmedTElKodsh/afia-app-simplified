---
id: T02
parent: S09
milestone: M003
key_files:
  - worker/src/eval/cv-eval.ts
key_decisions:
  - Integrated ONNX score tracking into cv-eval.ts report.
  - Added ONNX vs CV Pipeline Delta analysis to eval output.
  - Implemented per-stratum (fill bucket) accuracy breakdown.
duration: 
verification_result: passed
completed_at: 2026-05-16T18:00:41.535Z
blocker_discovered: false
---

# T02: Enhanced CV eval with stratum metrics, ONNX tracking, and MAE per tier.

**Enhanced CV eval with stratum metrics, ONNX tracking, and MAE per tier.**

## What Happened

I updated worker/src/eval/cv-eval.ts to include per-stratum metrics and ONNX model performance tracking. 
The eval script now:
1. Tracks `onnxScore` from the pipeline results for each image.
2. Displays the ONNX score in the per-image log and the worst misses list.
3. Provides a 'Per fill bucket' (stratum) breakdown of accuracy.
4. Calculates the average delta between the ONNX regression score and the CV pipeline fill ratio.
5. Added a `--dry-run` flag to allow for quick verification without processing the full dataset (stops after 1 image).
6. Improved argument parsing to support flags while still accepting the manifest path.

## Verification

Ran 'npx tsx worker/src/eval/cv-eval.ts --dry-run' to verify the new reporting logic and flag handling. The output confirmed that it now reports ONNX scores (when available) and provides the per-bucket breakdown.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsx worker/src/eval/cv-eval.ts --dry-run` | 0 | ✅ pass | 3000ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `worker/src/eval/cv-eval.ts`
