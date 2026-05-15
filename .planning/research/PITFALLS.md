# Pitfalls Research: Production Readiness

## Known Risks
1. **ONNX model memory limits** — V8 isolate heap limited (~128MB). Large regression models may not fit. Mitigation: quantize model, use R2 for model storage, lazy load.
2. **Cold start latency** — ONNX session init ~424ms. Mitigation: keep model in Durable Object or warm with scheduled requests.
3. **Workers CPU time limits** — Paid plan: 30s CPU per request. Complex CV pipeline + ONNX inference may approach this. Monitor in production.
4. **Model drift** — CV pipeline accuracy degrades over time as bottle designs/labels change. Mitigation: track eval metrics over time, alert on drift.

## Integration Risks
5. **Supabase quota exhaustion** — Image storage and database reads scale with usage. Set up monitoring and alerts.
6. **Admin token exposure** — Bearer token auth is simple but has no rotation/expiry. Mitigation: add token rotation, consider OAuth for production.
7. **ONNX Workers compatibility** — Requires specific patches (pre-compiled WASM, no dynamic imports). Test thoroughly in wrangler dev before deploying.

## Mitigation Strategy
- Phase 1: Train regression model, integrate with Workers using ONNX Runtime Web
- Phase 2: Admin dashboard (no ONNX dependency — can parallel-track)
- Phase 3: CI/CD, monitoring, ops hardening
