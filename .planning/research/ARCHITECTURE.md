# Architecture Research: Production Readiness

## CI/CD Pipeline
```
Git push → GitHub Actions → lint → test → build → deploy staging → integration tests → deploy production
```

- Use wrangler versions for gradual deployment
- Separate staging/production environments in wrangler config
- Secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID in GitHub Actions secrets
- Worker-specific secrets (GEMINI_API_KEY, etc.) via wrangler secret put

## ONNX Model Integration
- Regression model trained offline → exported to ONNX → bundled with Worker or loaded from R2
- For Workers: use onnxruntime-web with WASM backend
- Alternative: use Workers AI if models are available in catalog

## Admin Dashboard
- React SPA pages under existing `/admin` route
- Reuse existing AdminShell component
- New components: AnalyticsDashboard, AnalysisDetail, DataTable
- API already has listAnalyses, patchAnalysis endpoints

## Supabase Integration (Existing)
- Analyses table for scan records
- Storage bucket for images
- Analytics queries run directly on Supabase
- Production hardening: row-level security, connection pooling
