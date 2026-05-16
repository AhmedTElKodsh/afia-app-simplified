# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 | Phase 2 completion | architecture | Heuristic tuning outcome and ONNX feasibility verdict (Phase 2) | Staged ONNX feasibility (constant -> identity -> regression) and CLAHE 3.0 pre-processing. | Heuristic tuning (CLAHE 3.0) only provided marginal gains (+2.5pp); target accuracy (ACCR-02) was not met. ONNX feasibility benchmarks passed all performance/size thresholds, making it the required path for Stage 1.5 readiness. | Yes | collaborative |
