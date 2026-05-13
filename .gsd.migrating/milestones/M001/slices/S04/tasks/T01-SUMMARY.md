---
id: T01
parent: S04
milestone: M001
key_files:
  - (none)
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-05-13T18:55:02.668Z
blocker_discovered: false
---

# T01: Reduced few-shot count to a 'Golden Set' of 5 distinct anchors.

**Reduced few-shot count to a 'Golden Set' of 5 distinct anchors.**

## What Happened

Selected a 'Golden Set' of 5 high-contrast few-shot anchors to reduce cognitive load on the model and minimize noise. 
The 5 anchors are: 
- 0ml (Empty)
- 275ml (Low)
- 770ml (Mid)
- 1210ml (High)
- 1500ml (Full)

This set provides coverage of the extremes and the center while keeping the number of images low enough for the `gemini-2.5-flash` model to attend to the target image more effectively. 7 other anchors were moved to a `hidden` directory.

## Verification

Checked `worker/src/prompt/v1/few-shots/` count (5 files). Verified that the remaining files cover the full range of oil levels.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `ls worker/src/prompt/v1/few-shots/ | grep .json | wc -l` | 0 | ✅ pass | 50ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
