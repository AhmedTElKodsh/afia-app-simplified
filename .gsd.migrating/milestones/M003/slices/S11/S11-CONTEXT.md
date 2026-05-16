# S11: Worker Runtime Compatibility — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Closes:** sharp can't run on Workers (Amelia), no integration tests (Murat)

## Problem
`sharp` is a native Node.js addon (C++). Cloudflare Workers don't support native addons — they run on V8 isolates. The pipeline currently uses `sharp` for image decoding in `preprocess.ts`, which means it literally cannot run on the target Worker runtime.

## Approach
Replace `sharp` with `@napi-rs/image` (Rust-based, compiles to WASM) or a pure-JS image decoder that works in Workers. Add integration test that exercises the full `/api/cv-analyze` endpoint.

## Key Files
- worker/src/cv/preprocess.ts
- worker/src/routes/cv-analyze.ts
- worker/wrangler.jsonc
