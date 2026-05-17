# Afia Oil Level Scanner - Stage 1

A Cloudflare-deployed web application that enables consumers to scan QR codes on Afia cooking oil bottles, capture photos, and receive LLM-analyzed oil level measurements.

## Architecture

- **Monorepo**: pnpm workspace with three packages
- **Worker**: Cloudflare Worker (Hono + Static Assets)
- **Web**: React SPA (Vite + Tailwind CSS)
- **Shared**: Common types and constants

## Prerequisites

- Node.js 18+ and pnpm
- Cloudflare account with Workers access
- Gemini API key
- Grok API key

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure secrets** (for deployment):
   ```bash
   cd worker
   wrangler secret put GEMINI_API_KEY
   wrangler secret put GROK_API_KEY
   wrangler secret put ADMIN_TOKEN
   ```

## Development

- **Start web dev server**:
  ```bash
  pnpm dev:web
  ```

- **Start worker dev server**:
  ```bash
  pnpm dev:worker
  ```

## Testing

- **Run all tests**:
  ```bash
  pnpm test
  ```

- **Run tests for specific package**:
  ```bash
  pnpm --filter @afia/shared test
  pnpm --filter worker test
  pnpm --filter web test
  ```

## Building

- **Build all packages**:
  ```bash
  pnpm build
  ```

## Deployment

1. **Build and deploy**:
   ```bash
   pnpm deploy
   ```

This will:
- Build the shared package
- Build the web SPA
- Build the worker
- Deploy to Cloudflare Workers

## Project Structure

```
afia-app-simplified/
├── worker/                    # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── routes/           # API endpoints
│   │   ├── llm/              # LLM clients
│   │   └── prompt/           # Prompt engineering
│   └── wrangler.jsonc        # Worker config
├── web/                       # React SPA
│   ├── src/
│   │   ├── main.tsx          # Entry point
│   │   ├── pages/            # Route components
│   │   ├── components/       # UI components
│   │   └── lib/              # Utilities
│   └── vite.config.ts        # Vite config
└── packages/shared/           # Shared code
    └── src/
        ├── types.ts          # TypeScript types
        └── bottle.ts         # Constants
```

## Current Scope

The repository currently combines two Stage 1 workstreams:

- **Consumer validation app:** 1.5L-only QR/capture/result/admin shells backed by Cloudflare Worker routes and shared result schemas.
- **Research/evaluation track:** Gemini eval runner, CV pipeline, heuristic scoring, ONNX feasibility spike, and regression guardrails.

Current boundaries:

- ✅ 1.5L bottle analysis is the only supported analysis path.
- ✅ Gemini remains the API-first LLM target, with multi-key rotation and Grok fallback support in Worker code.
- ✅ Manual capture and correction workflows are part of the validation loop.
- ✅ Supabase is the target persistence/storage path for accepted/corrected records and future training data.
- ✅ CV/heuristic/ONNX experiments exist to support future accuracy improvements.
- ❌ 2.5L analysis, local-only inference, and production local-model training remain out of scope until evidence gates justify them.

## Evaluation and Guardrails

Useful commands:

```bash
pnpm test
pnpm --filter worker eval:dev-quick
pnpm --filter worker eval:cv
pnpm --filter worker gate:rss
```

Notes:

- `eval:dev-quick` is the fast Gemini regression probe using the 12-fixture manifest.
- Gemini evals are rate-limit sensitive; preserve the branch's 13-second inter-call delay when running API-backed evaluation.
- CV/ONNX evidence and historical results are documented under `docs/phase-02-summary.md`, `docs/decision-gate-onnx.md`, and `runs/`.

## Project Documentation

Start with:

- `docs/project-context.md` - concise LLM/project state and BMad routing context.
- `docs/COMPREHENSIVE-DOCUMENTATION.md` - detailed architecture, runbooks, contracts, and directory map.
- `docs/cv-pipeline-architecture.md` - CV pipeline design.
- `docs/phase-02-summary.md` and `docs/decision-gate-onnx.md` - heuristic/ONNX feasibility outcomes.
