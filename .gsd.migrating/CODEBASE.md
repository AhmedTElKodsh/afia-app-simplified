# Codebase Map

Generated: 2026-05-12T16:13:43Z | Files: 57 | Described: 0/57
<!-- gsd:codebase-meta {"generatedAt":"2026-05-12T16:13:43Z","fingerprint":"97c0fcfd64e569e702c8ab008a7a457b45c58e8f","fileCount":57,"truncated":false} -->

### (root)/
- `.gitignore`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`

### packages/shared/
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`

### packages/shared/src/
- `packages/shared/src/bottle.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/types.ts`

### runs/
- `runs/.gitkeep`
- `runs/signoffs.jsonl`

### web/
- `web/index.html`
- `web/package.json`
- `web/postcss.config.js`
- `web/tailwind.config.ts`
- `web/tsconfig.json`
- `web/vite.config.ts`
- `web/vitest.config.ts`

### web/src/
- `web/src/App.tsx`
- `web/src/i18n.tsx`
- `web/src/index.css`
- `web/src/main.tsx`
- `web/src/theme.tsx`

### web/src/components/
- `web/src/components/FloatingControls.tsx`

### web/src/test/
- `web/src/test/setup.ts`

### web/test/
- `web/test/FloatingControls.test.tsx`

### worker/
- `worker/package.json`
- `worker/tsconfig.json`
- `worker/vitest.config.ts`
- `worker/wrangler.jsonc`

### worker/src/
- `worker/src/env.ts`
- `worker/src/index.ts`

### worker/src/eval/
- `worker/src/eval/build-manifest.ts`
- `worker/src/eval/compare.ts`
- `worker/src/eval/jsonl.ts`
- `worker/src/eval/manifest.ts`
- `worker/src/eval/parse-response.ts`
- `worker/src/eval/run.ts`
- `worker/src/eval/signoff.ts`

### worker/src/llm/
- `worker/src/llm/analyze.ts`
- `worker/src/llm/gemini.ts`

### worker/src/prompt/
- `worker/src/prompt/load.ts`

### worker/src/prompt/v1/
- `worker/src/prompt/v1/bottle-reference.md`
- `worker/src/prompt/v1/system.md`

### worker/src/prompt/v1/few-shots/
- `worker/src/prompt/v1/few-shots/empty.json`
- `worker/src/prompt/v1/few-shots/full-1500.json`
- `worker/src/prompt/v1/few-shots/mid-770.json`

### worker/test/
- `worker/test/compare.test.ts`
- `worker/test/gemini.test.ts`
- `worker/test/jsonl.test.ts`
- `worker/test/manifest.test.ts`
- `worker/test/parse-response.test.ts`
- `worker/test/prompt-load.test.ts`
- `worker/test/smoke.test.ts`

### worker/test/fixtures/dev/
- `worker/test/fixtures/dev/manifest.json`

### worker/test/fixtures/holdout/
- `worker/test/fixtures/holdout/manifest.json`
