# Requirements: M002 — Stage 2: Computer Vision Pipeline

**Defined:** 2026-05-13
**Core Value:** Achieve ±50ml measurement accuracy on 1.5L Afia oil bottles

## M002 Requirements

### Technical Spike

- [ ] **SPK-01**: Feasibility spike — OpenCV WASM on Cloudflare Workers (cold start, latency, accuracy)
- [ ] **SPK-02**: Regression model deployment strategy (ONNX WASM / Workers AI / separate endpoint)

### CV Pipeline Base

- [ ] **CV-01**: OpenCV contour detection identifies oil-air meniscus in bottle image
- [ ] **CV-02**: Image preprocessing normalizes lighting, corrects perspective, removes glare
- [ ] **CV-03**: Contour-to-fill-ratio mapping calibrated for 1.5L bottle geometry
- [ ] **CV-04**: Failure detection — if contour detection yields 0 or implausible contours, return error with diagnostic

### Regression Refinement

- [ ] **REG-01**: Training pipeline assembled (data split 60/20/20, augmentation, model versioning)
- [ ] **REG-02**: Labeled dataset (~100 images) with inter-rater reliability protocol and annotation guidelines
- [ ] **REG-03**: Data diversity — training set includes varied lighting, bottle angles, glare levels, label occlusion
- [ ] **REG-04**: Lightweight regression model refines meniscus in ambiguous cases (trained, versioned, stored in R2)
- [ ] **REG-05**: Inference < 500ms on Worker (excluding cold start)
- [ ] **REG-06**: Regression validation — held-out test set (not overlapping eval probe set)

### Confidence & Gating

- [ ] **GATE-01**: Confidence score derivation from contour output (edge clarity, meniscus contrast, bottle alignment)
- [ ] **GATE-02**: Confidence threshold calibrated against probe set with known-good + ambiguous cases
- [ ] **GATE-03**: Gating function documented: which stage executes based on confidence tiers

### LLM Validation

- [ ] **LLM-01**: LLM validates CV + regression measurement when confidence is low
- [ ] **LLM-02**: LLM flags "uncertain" results for review — does NOT override or reject measurement
- [ ] **LLM-03**: LLM call has timeout (2s max) — if exceeded, measurement proceeds with low-confidence flag
- [ ] **LLM-04**: LLM validation result returned as separate `llmValidation` field in response

### Evaluation

- [ ] **EVA-01**: Stratified probe set — 12+ images covering pristine, glare, label-overlap, shadow, off-angle, low-light
- [ ] **EVA-02**: Evaluation reports MAE + confidence intervals (not just point estimates)
- [ ] **EVA-03**: Held-out test set for regression model (no overlap with training data)
- [ ] **EVA-04**: MAE < ±50ml on probe set
- [ ] **EVA-05**: Comparison report vs M001 Gemini baseline (same 12-image split)
- [ ] **EVA-06**: Kill threshold — if MAE > ±100ml after tuning, pipeline fails milestone

### Integration

- [ ] **INT-01**: Pipeline integrates with existing Worker API (`POST /api/analyze`)
- [ ] **INT-02**: Pipeline returns same result contract (`remainingMl`, `confidence`, `warnings`) + new `llmValidation` field
- [ ] **INT-03**: Error handling contract per pipeline stage — defines shape of failure for CV / REG / LLM / timeout cases

### Observability

- [ ] **OBS-01**: Structured logging per pipeline stage (CV → REG → LLM): latency, confidence, stage executed, error if any
- [ ] **OBS-02**: Input image + all intermediate outputs logged for production debugging

### Bottle Geometry

- [ ] **GEO-01**: Calibration supports 1.5L bottles (hard constraint for M002)
- [ ] **GEO-02**: Non-1.5L bottles return "unsupported bottle size" with clear message

## Out of Scope

| Feature | Reason |
|---------|--------|
| Local model training UI | Stage 3+ concern |
| Mobile app changes | API-only in Stage 2 |
| Non-1.5L bottle support | Deferred — calibrate for primary form factor first |
| Real-time video analysis | Not required for Stage 2 |
| Multiple OpenCV model variants | Single pipeline, iterate if MAE target missed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SPK-01 | Phase 5 | Pending |
| SPK-02 | Phase 5 | Pending |
| CV-01 | Phase 5 | Pending |
| CV-02 | Phase 5 | Pending |
| CV-03 | Phase 5 | Pending |
| CV-04 | Phase 5 | Pending |
| REG-01 | Phase 6 | Pending |
| REG-02 | Phase 6 | Pending |
| REG-03 | Phase 6 | Pending |
| REG-04 | Phase 6 | Pending |
| REG-05 | Phase 6 | Pending |
| REG-06 | Phase 6 | Pending |
| GATE-01 | Phase 5 | Pending |
| GATE-02 | Phase 5 | Pending |
| GATE-03 | Phase 5 | Pending |
| LLM-01 | Phase 7 | Pending |
| LLM-02 | Phase 7 | Pending |
| LLM-03 | Phase 7 | Pending |
| LLM-04 | Phase 7 | Pending |
| EVA-01 | Phase 8 | Pending |
| EVA-02 | Phase 8 | Pending |
| EVA-03 | Phase 8 | Pending |
| EVA-04 | Phase 8 | Pending |
| EVA-05 | Phase 8 | Pending |
| EVA-06 | Phase 8 | Pending |
| INT-01 | Phase 8 | Pending |
| INT-02 | Phase 8 | Pending |
| INT-03 | Phase 8 | Pending |
| OBS-01 | Phase 6 | Pending |
| OBS-02 | Phase 6 | Pending |
| GEO-01 | Phase 5 | Pending |
| GEO-02 | Phase 5 | Pending |

**Coverage:**
- M002 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-13*
*Last updated: 2026-05-13 after BMad party mode gap review*
