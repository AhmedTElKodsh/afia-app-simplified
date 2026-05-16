---
id: T01
parent: S13
milestone: M004
key_files:
  - worker/test/cv-errors.test.ts
completed_at: 2026-05-13
verification_result: passed
---

# T01: PipelineError shape tests

Added 7 test cases covering all 6 error factory functions plus a shape contract test. All errors have stage, code, message, and recoverable fields. Specific tests for each error's unique properties (ratio in message, recoverable flags, error messages).
