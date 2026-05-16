# M004: Validation & Test Coverage

**Vision:** Close validation gaps identified in M002/M003 audit. Add unit tests for CV pipeline stages, run integration tests, and verify error paths.

## Slices

- [x] **S12: CV Unit Tests** `risk:low` `depends:[]`
  > After this: geometry(9) + confidence(10) + scoring(6) + errors(7) = 32 tests. contour scoring extracted to pure function. 3/3 tasks.

- [x] **S13: Integration + Error Tests** `risk:low` `depends:[S12]`
  > After this: cv-analyze input validation(13) + PipelineError(7) = 20 tests. 2/2 tasks. 45 total tests, all passing.

## Boundary Map

- **In scope:** Unit tests for confidence scoring, contour detection, geometry calibration. Integration tests for Worker endpoint. Error path validation.
- **Out of scope:** E2E eval improvements (already covered). Performance testing. CI/CD pipeline.
