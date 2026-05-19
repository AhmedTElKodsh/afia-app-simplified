# Research Summary: Production Readiness

## Stack Additions
- **ONNX Runtime Web** for regression model inference — requires WASM pre-compilation and 3 patches for Workers compat
- **GitHub Actions** for CI/CD with wrangler deploy
- **shadcn/ui + recharts** for admin dashboard components
- **Prometheus** (or Workers dashboard) for production monitoring

## Feature Table Stakes
- Admin review/correction UI (API exists, needs frontend)
- Analytics dashboard (scan volume, accuracy, failure rates)
- Real ONNX regression model (replace mock)
- CI/CD pipeline (GitHub Actions + Wrangler)
- Production wrangler config and domain setup

## Watch Out For
- ONNX model size limits in V8 isolate memory (~128MB)
- Workers CPU time limits (30s paid) for CV + inference pipeline
- Cold start latency with ONNX session init (~424ms)
- Model drift over time without monitoring
- Admin Bearer token security (add rotation)
- ONNX Workers compatibility requires specific patches
