# S11: Worker Runtime Compatibility

**Goal:** Pipeline deployable to Cloudflare Workers. No Node-only dependencies.
**Demo:** `pnpm build` succeeds without sharp. Integration tests pass against running Worker.

## Tasks

- [ ] **T01: Replace sharp with WASM-compatible decoder** `est:1h`
  Install `@napi-rs/image` or pure-JS decoder. Update `preprocess.ts` to use it instead of sharp. Verify build succeeds without native addon warnings.
  - Files: `worker/src/cv/preprocess.ts`, `worker/package.json`
  - Verify: `pnpm build` passes. Image decoding produces same output.

- [ ] **T02: Add Worker integration tests** `est:1h`
  Create vitest tests for `/api/cv-analyze` endpoint: valid image, missing image, unsupported format, oversize image, unsupported bottle size.
  - Files: `worker/test/cv-analyze.test.ts`
  - Verify: All 5 test cases pass.

- [ ] **T03: Verify pipeline runs on Worker** `est:0.5h`
  Run `pnpm build` and verify the output works with wrangler dev or build check.
  - Files: `worker/wrangler.jsonc`
  - Verify: Build succeeds with no Node-specific imports.
