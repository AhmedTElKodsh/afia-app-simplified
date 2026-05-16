# S05: Spike + CV Pipeline Base — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Mode:** Auto-generated from M002 research and BMad party mode findings

## Domain

S05 is the foundation slice. It must validate the core technical assumption: whether OpenCV contour detection can run on Cloudflare Workers (via WASM) and detect the oil-air meniscus with sufficient accuracy to make the rest of the pipeline viable.

## Implementation Decisions

### OpenCV on Workers
The primary risk. Workers don't ship OpenCV bindings. Options:
1. **OpenCV WASM** (~4MB) — cold start concern, but most accurate contour detection
2. **Pure JS contour library** — lighter weight but less accurate
3. **Workers AI / separate inference endpoint** — for regression/ML only, not for CV

### Contour Detection Approach
- Grayscale → Gaussian blur → Canny edge detection → findContours
- Filter contours by size/position (expect largest = bottle body)
- Detect horizontal line within bottle = oil-air meniscus
- Map Y-position to fill ratio using 1.5L bottle geometry

### Confidence Derivation
- Edge clarity (Canny edge strength at meniscus)
- Contour aspect ratio (is it a horizontal line?)
- Contrast difference across boundary

## Existing Code Insights
- `worker/src/` — TypeScript, Cloudflare Worker runtime
- Existing eval runner at `worker/src/eval/run.ts` can be reused for CV eval
- `worker/test/fixtures/dev/probe-manifest.json` — 12 existing probe images
- No CV or image processing code exists yet

## Specific Ideas
1. Standalone Python prototype of contour detection (quick iteration)
2. WASM build of OpenCV for Worker deployment
3. Integration test against existing probe set

## Deferred Ideas
- Multi-model CV comparison — single approach for M002
- Bottle type classification — only 1.5L in scope
