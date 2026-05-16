---
id: T03
parent: S12
milestone: M004
key_files:
  - worker/src/cv/scoring.ts
  - worker/test/cv-contour.test.ts
key_decisions:
  - scoreContours extracted to scoring.ts (pure function, no OpenCV dependency)
  - 6 test cases cover: empty list, tall vs short, score threshold <0.3 rejection, center position, aspect ratio preference, size score
completed_at: 2026-05-13
verification_result: passed
---

# T03: contour.ts scoring test

Extracted heuristic scoring into `worker/src/cv/scoring.ts` — a pure TypeScript function with no OpenCV dependency. Added 6 unit tests covering the scoring logic. The OpenCV-dependent parts of contour.ts remain tested through the end-to-end eval runner.
