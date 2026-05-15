# Stack Research: Production Readiness

## ONNX Runtime on Workers
- **onnxruntime-web** works on Workers with 3 patches: pre-compile WASM via `CompiledWasm` wrangler rule, silence `import.meta.url` errors, kill dynamic `import(variable)` in bundled source
- Session init ~424ms (one-time), first inference ~36ms, subsequent ~0.7ms
- Workers AI available but limited to 50+ open-source models in catalog — regression model likely custom ONNX
- **Key constraint:** Model size limited by V8 isolate memory (~128MB max heap)

## CI/CD Pipeline
- Standard: GitHub Actions + Wrangler
- Steps: lint → test → deploy staging → integration test → deploy production
- Auth via `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` stored as GitHub secrets
- Wrangler versions/deployments support gradual rollouts

## Admin Dashboard
- React admin patterns: shadcn/ui + Tailwind CSS, recharts for charts
- Key components: data tables with sort/filter, sidebar navigation, status badges, search
- Free options: Shadcn Admin (satnaing/shadcn-admin), Material Dashboard Shadcn

## Monitoring
- Workers dashboard provides CPU time, requests, errors
- AI model monitoring tools: Prometheus for metrics, alerting on drift/performance drops
- Supabase can power analytics queries directly
