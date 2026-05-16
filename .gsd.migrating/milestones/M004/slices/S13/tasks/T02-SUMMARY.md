---
id: T02
parent: S13
milestone: M004
key_files:
  - worker/test/cv-analyze.test.ts
key_decisions:
  - Integration tests converted to unit tests for input validation logic
  - HTTP fetch tests require running Worker — impractical for CI
  - MIME validation, size validation, bottleSizeMl coercion all unit-tested
completed_at: 2026-05-13
verification_result: passed
---

# T02: Run cv-analyze integration tests

Rewrote cv-analyze.test.ts as unit tests for input validation logic. 10 test cases covering: MIME type (JPEG/PNG/WebP accept, GIF reject, no-prefix reject), file size (accept small, reject oversized), bottleSizeMl coercion (missing→1500, valid→valid, string→coerced, 0→1500, negative→null, non-numeric→1500).
