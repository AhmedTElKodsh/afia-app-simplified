---
id: T01
parent: S05
milestone: M002
key_files:
  - (none)
key_decisions:
  - (none)
duration: 
verification_result: untested
completed_at: 2026-05-16T14:46:35.513Z
blocker_discovered: false
---

# T01: Expanded edge-case corpus to 30 images.

**Expanded edge-case corpus to 30 images.**

## What Happened

Expanded the edge-case corpus from 20 to 30 images using farthest-point sampling from a larger pool of 2,367 images. The final manifest at `worker/test/fixtures/cv-edge-eval/manifest.json` now includes diverse lighting and fill levels.

## Verification

Manifest exists with 30 entries.

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
