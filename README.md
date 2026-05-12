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

## Stage 1 Scope

- ✅ 1.5L bottle support only
- ✅ Single Gemini API key with Grok fallback
- ✅ In-memory results (no persistence)
- ✅ Manual capture (no auto-capture)
- ❌ No image storage
- ❌ No admin corrections
- ❌ No local model support

## Next Steps

See `.kiro/specs/afia-oil-scanner-stage1/tasks.md` for the complete implementation plan.
