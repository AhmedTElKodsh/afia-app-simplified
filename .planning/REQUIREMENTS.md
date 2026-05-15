# Requirements: Afia Oil Level Scanner

**Defined:** 2026-05-15 (updated after agent review)
**Core Value:** Accurate oil level estimation for Afia bottles that users and admins can trust.

## v1 Requirements

Requirements for v1.0 Production Readiness. Each maps to roadmap phases.

**Build order:** Phase 1: Heuristic improvements + ONNX spike + eval hardening → Phase 2: ONNX integration + accuracy gate → Phase 3: Staging env (needed by ONNX) → Phase 4: Full ops + infrastructure hardening.

### Accuracy Pipeline

- [ ] **ACCR-01**: Prove ONNX Runtime works on Workers via feasibility spike — deploy tiny ONNX model, measure memory/cold-start under load
- [ ] **ACCR-02**: Improve heuristic scoring — ≤1 false full/empty classification per 10 holdout images; reduce empty→full and full→empty confusion
- [ ] **ACCR-03**: Train and integrate ONNX regression model replacing current mock/placeholder
- [ ] **ACCR-04**: Achieve MAE < ±45ml and RMSE < ±70ml on sealed holdout set (3 consecutive runs)
- [ ] **ACCR-05**: Add edge-case image corpus (20-30 images: glare, extreme rotation, low contrast, partial occlusion) with labelled eval script
- [ ] **ACCR-06**: Define model version tracking (ONNX model hash, feature extractor version, prompt hash, eval summary per version)
- [ ] **ACCR-07**: Add ONNX integration test — feed pre-extracted feature vectors through ONNX runtime, compare against known ground truth
- [ ] **ACCR-08**: Validate holdout set diversity — ensure representation across lighting conditions, phone cameras, bottle orientations

### Operations

- [ ] **OPS-01**: GitHub Actions CI/CD pipeline runs vitest + eval:dev + signoff gate on every push/deploy
- [ ] **OPS-02**: Production wrangler configuration with staging/production environments (needed for ONNX validation)
- [ ] **OPS-03**: Production domain setup with custom domain on Cloudflare
- [ ] **OPS-04**: Error monitoring and alerting for production Workers
- [ ] **OPS-05**: Supabase hardening — split anon key (public routes with RLS) from service_role key (admin routes only)
- [ ] **OPS-06**: All secrets managed via wrangler secrets; remove env key logging from startup (`worker/src/env.ts:30`)
- [ ] **OPS-07**: Provider circuit breaker with KV-backed health status per LLM provider; ordered fallback chain
- [ ] **OPS-08**: Structured logging with trace IDs (`worker/src/observability/logger.ts`) and typed event emission

### User Experience

- [ ] **UX-01**: Graceful fallback UX when inference fails — clear error message, retry path, degraded-mode response
- [ ] **UX-02**: Define launch sign-off gate with documented criteria and owner sign-off before production deploy

### Test Infrastructure

- [ ] **TEST-01**: CI pipeline runs `vitest run` + `eval:dev` (60 images) on every push for fast feedback
- [ ] **TEST-02**: ONNX model loading test — verify model file loads in Workers runtime without errors
- [ ] **TEST-03**: Edge-case fixture eval runs 20-30 labelled edge-case images as separate eval script
- [ ] **TEST-04**: Provider exhaustion inject test — all 3 Gemini keys exhausted → Grok fallback → Grok fails → 503
- [ ] **TEST-05**: Admin correction flow test — verify corrected values bypass re-evaluation against 55ml tolerance

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Admin Dashboard

- **ADMN-01**: Full admin review/correction UI with analysis list, detail view, correction form
- **ADMN-02**: Analytics dashboard with charts (scan volume, accuracy distribution, failure rates)
- **ADMN-03**: Side-by-side CV vs LLM vs correction comparison view

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native apps | Web-first; PWA considered later |
| Auto-capture (scan-on-sight) | Requires additional hardware integration; not core |
| Multi-language beyond current i18n | Current i18n sufficient for initial production |
| Full 870-image dataset training | Offline session; production model uses offline-trained weights |
| Admin dashboard UI | Deferred to v2 milestone; API endpoints already exist |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACCR-02 | Phase 1 | Pending |
| ACCR-01 | Phase 1 | Pending |
| ACCR-05 | Phase 1 | Pending |
| ACCR-06 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| UX-01 | Phase 1 | Pending |
| ACCR-03 | Phase 2 | Pending |
| ACCR-07 | Phase 2 | Pending |
| ACCR-08 | Phase 2 | Pending |
| ACCR-04 | Phase 2 | Pending |
| OPS-02 | Phase 3 | Pending |
| OPS-01 | Phase 3 | Pending |
| TEST-01 | Phase 3 | Pending |
| TEST-03 | Phase 3 | Pending |
| OPS-03 | Phase 4 | Pending |
| OPS-04 | Phase 4 | Pending |
| OPS-05 | Phase 4 | Pending |
| OPS-06 | Phase 4 | Pending |
| OPS-07 | Phase 4 | Pending |
| OPS-08 | Phase 4 | Pending |
| TEST-04 | Phase 4 | Pending |
| TEST-05 | Phase 4 | Pending |
| UX-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-15*
*Last updated: 2026-05-15 after agent review*
