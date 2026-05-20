# Afia Oil Level Scanner - Stage 1

A Cloudflare-deployed web application that enables consumers to scan product QR/barcode links on Afia cooking oil bottles, capture a front-side bottle photo, and receive API-analyzed oil level measurements.

## Architecture

- Monorepo: pnpm workspace with Worker, Web, and Shared packages.
- Worker: Cloudflare Worker using Hono and Static Assets.
- Web: React SPA using Vite and Tailwind CSS.
- Shared: common bottle constants, schemas, and product link helpers.
- Persistence: Supabase PostgreSQL and Storage.
- LLM route: Gemini primary with key rotation and Grok fallback.

## Prerequisites

- Node.js 18+ and pnpm.
- Cloudflare account with Workers access.
- Gemini API key.
- Grok API key, when fallback is enabled.
- Supabase project and service-role configuration for persistence.

## Setup

Install dependencies:

```bash
pnpm install
```

Configure deployment secrets from the Worker directory:

```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put GROK_API_KEY
wrangler secret put ADMIN_TOKEN
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Keep secrets out of prompts, logs, commits, and docs.

## Development

Start the web dev server:

```bash
pnpm dev:web
```

Start the Worker dev server:

```bash
pnpm dev:worker
```

## Testing

Run all tests:

```bash
pnpm test
```

Run package-specific tests:

```bash
pnpm --filter @afia/shared test
pnpm --filter worker test
pnpm --filter web test
```

Current review note: shared, web, and full Worker tests pass locally. CV/ONNX production endpoints intentionally return `501`; their diagnostics are exercised through local test routes. Stage 1.5 sign-off still returns a NO-GO accuracy verdict, so working screens are not an accuracy claim.

## Build

```bash
pnpm build
```

## Deployment

Use the explicit Windows-safe deploy sequence:

```powershell
pnpm.cmd --filter web build
pnpm.cmd --filter worker build
npm.cmd exec --yes --package wrangler@latest -- wrangler deploy --config worker\wrangler.jsonc
```

There is currently no root `pnpm deploy` script.

## Project Structure

```text
afia-app-simplified/
├── .kiro/specs/               # Canonical planning, requirements, and project reference
├── worker/                    # Cloudflare Worker API and static asset server
│   ├── src/
│   │   ├── index.ts           # Hono app entry
│   │   ├── routes/            # API endpoints
│   │   ├── llm/               # Gemini/Grok clients and orchestration
│   │   ├── prompt/            # Prompt assets and bundled Worker fallback
│   │   ├── storage/           # Supabase persistence
│   │   ├── cv/                # Local diagnostic CV pipeline
│   │   └── onnx/              # Local/future-model diagnostics
│   └── wrangler.jsonc         # Worker config
├── web/                       # React SPA
│   ├── src/
│   │   ├── main.tsx           # Entry point
│   │   ├── components/        # Scan, capture, result, admin, controls
│   │   ├── storage/           # Browser state helpers
│   │   └── errors.ts          # Error code definitions
│   └── vite.config.ts         # Vite config
├── packages/shared/           # Shared code, schemas, product links, bottle constants
├── scripts/                   # Operational scripts
├── runs/                      # Local eval/signoff outputs, ignored except durable signoffs
└── oil-bottle-frames/         # Small tracked outline asset only; full datasets stay local/ignored
```

## Current Scope

The repository currently combines two Stage 1 workstreams:

- Consumer validation app: 1.5L-only QR/capture/result/admin shells backed by Cloudflare Worker routes and shared result schemas.
- Research/evaluation track: Gemini eval runner, CV pipeline, heuristic scoring, ONNX feasibility spike, and regression guardrails.

Current boundaries:

- 1.5L bottle analysis is the only supported analysis path.
- Gemini remains the API-first LLM target, with multi-key rotation and Grok fallback support in Worker code.
- Manual capture and correction workflows are part of the validation loop.
- Supabase is the target persistence/storage path for accepted/corrected records and future training data.
- CV/heuristic/ONNX experiments exist to support future accuracy improvements.
- 2.5L analysis, local-only inference, and production local-model training remain out of scope until evidence gates justify them.

Workflow commitments:

- `/mock-qr` provides a scan link for 1.5L and a 2.5L mock identity card only; Stage 1 analyzes only 1.5L.
- `/scan?size=1.5L` opens the camera, guides the user to photograph the front side, overlays a functional 1.5L bottle outline, gives closer/farther/angle guidance, turns green on a stable match, auto-captures, and runs basic image-quality checks before API analysis.
- `/result` shows the real captured image, fixed detected red line, remaining/consumed ml, a 55ml-step correction slider, and quarter-cup counter.
- Result corrections and admin/manual uploads are persisted for review, with an admin dataset export that keeps training-ready labels separate from diagnostic records.
- Stage 2 promotes a local browser/mobile model only after M006 data readiness and M007 accuracy gates pass; Gemini/Grok remains the fallback path.

## Evaluation And Guardrails

Useful commands:

```bash
pnpm test
pnpm --filter worker eval:dev-quick
pnpm --filter worker eval:cv
pnpm --filter worker gate:rss
```

Notes:

- `eval:dev-quick` is the fast Gemini regression probe using the fixture manifest.
- Gemini evals are rate-limit sensitive; preserve the branch's 13-second inter-call delay when running API-backed evaluation.
- CV/ONNX evidence and historical results are consolidated under `.kiro/specs/afia-project-reference/technical-reference.md` and `.kiro/specs/afia-project-reference/legacy-planning-archive.md`; new raw local outputs can be regenerated under ignored `runs/` folders.

## Project Documentation

Start with:

- `.kiro/specs/afia-roadmap/overview.md` - canonical roadmap and workflow target.
- `.kiro/specs/afia-remaining-milestones/remaining-milestones-plan.md` - active continuation plan.
- `.kiro/specs/afia-project-reference/project-context.md` - consolidated project context and boundaries.
- `.kiro/specs/afia-project-reference/technical-reference.md` - consolidated architecture, runbook, CV/ONNX, eval, deploy, and cleanup reference.
- `.kiro/specs/afia-project-reference/legacy-planning-archive.md` - record of merged `.planning` and old `docs` decisions.
