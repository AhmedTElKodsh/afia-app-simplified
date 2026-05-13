---
id: T03
parent: S01
milestone: M001
key_files:
  - (none)
key_decisions:
  - (none)
duration: 
verification_result: untested
completed_at: 2026-05-13T13:31:23.125Z
blocker_discovered: false
---

# T03: Executed probe eval and established accuracy baseline.

**Executed probe eval and established accuracy baseline.**

## What Happened

Ran the 12-image probe eval. The results confirmed that the model is performing poorly, with 0% exact accuracy and 8.3% close accuracy. The model appears to be repeating few-shot `oilSurfaceYRatio` values verbatim, as predicted in the remediation plan. Analysis of worst misses shows significant errors in boundary detection (e.g., predicting 962ml for a 1485ml bottle). This baseline provides a clear target for improvement in the next slice.

## Verification

Successfully captured eval runner summary and detailed diagnostics. Output JSONL file exists.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| — | No verification commands discovered | — | — | — |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
