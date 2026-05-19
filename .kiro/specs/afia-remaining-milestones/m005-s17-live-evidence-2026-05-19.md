# M005 S17 Live Evidence - 2026-05-19

## Scope

S17 target: prove the deployed Stage 1 Worker can serve the web app, accept a real 1.5L capture payload, run API analysis, persist to Supabase, and expose the new record to the admin correction queue.

## Verified

- Deployed Worker URL: `https://afia-stage1.savola.workers.dev`.
- Latest verified deploy version: `64ae7bcc-9e3f-448a-a5be-535436438f2a`.
- Worker bundle size after deploy fixes: `531.09 KiB` upload, `102.06 KiB` gzip.
- `GET /api/health` returned `{"ok":true}`.
- `GET /api/admin/analyses?limit=5` without admin credentials returned `401 Unauthorized`.
- A real local 1.5L raster frame, `oil-bottle-frames/1.5L_refs/750ml.jpg`, reached `/api/analyze`.
- The deployed LLM path now passes the Worker runtime boundary after replacing filesystem prompt loading with a bundled prompt fallback.
- The deployed LLM path now passes the provider boundary after moving Gemini calls to direct REST fetch.

## Fixed During S17

- `worker/src/prompt/load.ts` now falls back to bundled v1 prompt data when Worker filesystem access is unavailable.
- `worker/src/prompt/bundled.ts` carries the production v1 prompt and few-shot metadata with stable prompt hashes.
- `worker/src/llm/gemini.ts` uses direct Gemini REST calls instead of the Node SDK path for Worker compatibility.
- `worker/src/routes/analyze.ts` now returns sanitized failure details for LLM and persistence failures.
- `worker/test/analyze-route.test.ts` covers full Gemini key-pool retries and sanitized LLM/persistence diagnostics.

## Current Blocker

Persistence is blocked by the deployed Supabase service-role secret:

- After fixing the deployed `SUPABASE_URL` to `https://brmljayacipdhfgppuzk.supabase.co`, `/api/analyze` returns:
  - `Analysis persistence failed`
  - detail: `Supabase image upload failed: signature verification failed`
- This means the live `SUPABASE_SERVICE_ROLE_KEY` binding is wrong, stale, or from a different Supabase project.
- Local repo env files do not contain `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.
- `supabase.cmd projects list` is blocked because `SUPABASE_ACCESS_TOKEN` is not configured.

## Verification Commands

- `pnpm.cmd --filter worker build`
- `pnpm.cmd --filter worker test test/analyze-route.test.ts test/stage1-flow.test.ts test/admin-route.test.ts test/supabase-storage.test.ts`
- `npm.cmd exec --yes --package wrangler@latest -- wrangler deploy`
- `curl.exe -sS https://afia-stage1.savola.workers.dev/api/health`
- `curl.exe -sS -D - -o NUL https://afia-stage1.savola.workers.dev/api/admin/analyses?limit=5`
- `curl.exe -sS -X POST https://afia-stage1.savola.workers.dev/api/analyze -H "content-type: application/json" --data-binary @<local-payload>`

## Remaining S17 Gate

To finish S17:

1. Refresh `SUPABASE_SERVICE_ROLE_KEY` for project `brmljayacipdhfgppuzk`.
2. Re-run the same live `/api/analyze` raster probe.
3. Confirm response includes `analysisId`.
4. Use `ADMIN_TOKEN` to load `GET /api/admin/analyses`.
5. Patch that same `analysisId` with correction status, flag, corrected ml, and admin note.
