# S13: Integration + Error Tests

**Goal:** Run integration tests, validate error paths.
**Closes:** 4 missing gaps (error path tests, integration test execution).

## Tasks

- [ ] **T01: PipelineError shape tests** `est:15m`
  Test each error factory function returns correct `stage`, `code`, `message`, `recoverable` shape.
  - File: `worker/test/cv-errors.test.ts`
  - Verify: contourNotFound, implausibleRatio, perspectiveFailed, internalError all return typed PipelineError.

- [ ] **T02: Run cv-analyze integration tests** `est:30m`
  Execute existing `worker/test/cv-analyze.test.ts` against dev Worker. Fix any failures. Add missing test cases for error contract shape in HTTP response.
  - File: `worker/test/cv-analyze.test.ts`
  - Verify: All tests pass. Error responses contain `stage`, `code`, `message`, `recoverable`.
