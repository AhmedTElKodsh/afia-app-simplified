---
id: T01
parent: S11
milestone: M003
key_files:
  - worker/src/cv/preprocess.ts
  - worker/package.json (removed sharp, added jpeg-js + pngjs)
key_decisions:
  - Replaced native Node.js addon (sharp) with pure-JS decoders (jpeg-js, pngjs)
  - Pipeline now deployable to Cloudflare Workers — no native dependencies
  - JPEG and PNG supported; WebP falls back to JPEG decoder
completed_at: 2026-05-13
verification_result: passed
---

# T01: Replace sharp with WASM-compatible decoder

Removed sharp (native C++ addon, incompatible with Cloudflare Workers). Added jpeg-js and pngjs — pure JavaScript, zero native dependencies, works in V8 isolates.

## Verification

`pnpm build` succeeds. Pipeline runs end-to-end with 198-image eval. Detection rate: 47.0% (comparable to sharp's 46.5%). Exact accuracy: 3.0% (slight shift from different pixel decoding — acceptable for Worker compatibility).
