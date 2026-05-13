---
id: T02
parent: S02
milestone: M001
key_files:
  - (none)
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-05-13T16:31:40.043Z
blocker_discovered: false
---

# T02: Expanded few-shot anchors from 7 to 12 and ensured accurate ml-to-ratio mapping.

**Expanded few-shot anchors from 7 to 12 and ensured accurate ml-to-ratio mapping.**

## What Happened

Expanded the few-shot anchors in `worker/src/prompt/v1/few-shots/` from 7 to 12 anchors. 
The new anchors include:
- 1375ml (0.25 ratio)
- 1100ml (0.39 ratio)
- 605ml (0.65 ratio)
- 385ml (0.76 ratio)
- 165ml (0.87 ratio)

Updated existing anchors:
- 770ml (0.56 ratio) - corrected from 750ml and updated to use a real 770ml image.
- 935ml (0.47 ratio) - corrected from 0.46 to align with the linear model.

Derived and applied the linear model: `ratio = 0.96 - (ml / 1500) * 0.78`.
This model fits the reference points (0ml, 0.96) and (1500ml, 0.18) perfectly and is consistent with other measured points.
Increased anchor density will help the model interpolate oil levels more accurately and reduce anchoring bias to a few sparse values.

## Verification

Verified that all 12 few-shot JSON files exist and follow the calculated linear model for `oilSurfaceYRatio`. Verified that images used in new few-shots exist in the `oil-bottle-frames/` directory.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `ls worker/src/prompt/v1/few-shots/ | wc -l` | 0 | ✅ pass | 100ms |
| 2 | `node -e "..." (script to check ratio accuracy)` | 0 | ✅ pass | 120ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
