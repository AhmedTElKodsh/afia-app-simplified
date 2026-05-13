---
id: T04
parent: S02
milestone: M001
key_files:
  - (none)
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-05-13T18:48:08.033Z
blocker_discovered: false
---

# T04: Ran Probe Eval (v2); accuracy worsened (MAE 427ml vs 390ml), indicating few-shot saturation or model limitations.

**Ran Probe Eval (v2); accuracy worsened (MAE 427ml vs 390ml), indicating few-shot saturation or model limitations.**

## What Happened

Ran the Probe Eval (v2) with 12 few-shot anchors and refined prompts. 

Results:
- **MAE v2 (12 shots):** 427.25 ml
- **MAE v1 (7 shots):** 390.83 ml
- The absolute error actually **increased** by ~36ml.
- The model is still heavily anchored to the center of the bottle (ratios 0.48 - 0.68), which corresponds to the label area. 
- It is frequently predicting ~538ml or ~692ml regardless of the ground truth oil level.
- The instruction to "interpolate" resulted in some unique values (0.605, 0.48) but they were not more accurate.
- Increasing few-shot density from 7 to 12 seems to have added noise or confusion rather than clarity, possibly exceeding the effective context or attention span of the `gemini-2.5-flash` model for visual comparison tasks.

The hypothesis that "more anchors = better accuracy" is rejected for this model/prompt configuration. 
The model appears to be "tuning out" the reference images and defaulting to a safe-looking guess in the label region.

## Verification

Compared metrics of the latest run with the previous baseline using a custom script. Results confirmed higher MAE.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node scripts/compare-mae.js` | 0 | ✅ pass (metrics generated) | 160ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
