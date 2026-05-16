---
id: T01
parent: S12
milestone: M004
key_files:
  - worker/test/cv-geometry.test.ts
key_decisions:
  - calibrateFillRatio(-0.5) → 1.0 (clamped to 0, calibrates to empty)
  - calibrateFillRatio(1.5) → 0.0 (clamped to 1, calibrates to full)
completed_at: 2026-05-13
verification_result: passed
---

# T01: geometry.ts unit test

Added 8 test cases covering: input clamping, calibration at boundaries (empty/full), mid-range calibration, output clamping [0,1], supported/unsupported bottle sizes, isSupportedBottle.
