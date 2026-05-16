---
id: T02
parent: S12
milestone: M004
key_files:
  - worker/test/cv-confidence.test.ts
key_decisions:
  - Edge strength / 2000 normalized to [0,1]
  - Extreme ratio penalty fires at <0.05 and >0.95 (0.2 penalty)
  - Tier boundaries: high≥0.7, medium≥0.3, low<0.3
completed_at: 2026-05-13
verification_result: passed
---

# T02: confidence.ts unit test

Added 10 test cases covering: not-found path, score range [0,1], edge strength monotonicity, noise penalty, extreme ratio penalty (both ends), mid-ratio no penalty, tier boundaries (high/medium/low).
