# Code Review: CV Pipeline (M002/M003)

```yaml
---
status: issues_found
depth: deep
files_reviewed: 17
critical: 3
warning: 7
info: 5
total: 15
---
```

---

## worker/src/cv/pipeline.ts

### CR-1: Confidence score/tier mismatch in regression path (CRITICAL)
- **Line:** 127-130
- **Issue:** When regression refines a medium-confidence result, `finalConfidence.score` is set to `Math.max(confidence.score, regressionOutput.modelConfidence)` but `finalConfidence.tier` is set solely from `regressionOutput.modelConfidence >= 0.7 ? "high" : "medium"`. If the original CV confidence is 0.8 (high) but the regression model confidence is 0.5, the result is `score=0.8, tier="medium"` — a contradictory state where score suggests "high" but tier says "medium". Downstream consumers that check only tier or only score will reach opposite conclusions about reliability.
- **Fix:** Derive tier from `finalConfidence.score` after the max, using `EDGE_HIGH`/`EDGE_MEDIUM` thresholds from confidence.ts. Or keep tier = max of both sources. Either way, score and tier must be derived from the same logic path.

```ts
// Option A: re-derive tier from combined score
const combinedScore = Math.max(confidence.score, regressionOutput.modelConfidence);
const tier = combinedScore >= 0.7 ? "high" : combinedScore >= 0.3 ? "medium" : "low";

// Option B: keep tier as max of both sources
const tier = confidence.tier === "high" || regressionOutput.modelConfidence >= 0.7 ? "high" : "medium";
```

### WR-1: Misleading contour-stage confidence logged before scoring (WARNING)
- **Line:** 83
- **Issue:** `logStage("contour", ..., contourResult.found ? 0.8 : 0, ...)` passes a hardcoded `0.8` as the confidence value for the contour stage. This is not the actual confidence — it's a placeholder that will appear in structured logs as if contour detection reported 80% confidence. Contradicts the principle that confidence comes from the `confidence` stage.
- **Fix:** Pass `contourResult.edgeStrength` (unbounded) or omit confidence for this log entry (use `scoreConfidence` result, or log edgeStrength separately).

### WR-2: Regression tier clobbers original high-confidence tier (WARNING)
- **Line:** 116, 128
- **Issue:** The regression stage only fires for `confidence.tier === "medium"`, but after regression the tier can only be `"high"` or `"medium"` — there's no "regression couldn't improve it, but it's still medium" signaling. Worse, if the original CV confidence was already high (edge case: race or concurrent modification), invoking regression would downgrade it to medium.
- **Fix:** Guard the regression block with an explicit check: `confidence.tier === "medium"` is already there. Ensure tier transitions are monotonic: never downgrade.

---

## worker/src/cv/logger.ts

### CR-2: Module-level mutable state with cross-request race condition (CRITICAL)
- **Line:** 9, 21-22
- **Issue:** `const logs: StageLog[] = []` is module-level state shared across all requests in a Cloudflare Worker isolate. Cloudflare Workers handle multiple concurrent requests (event-loop concurrency). If two `runPipeline` calls overlap at async await points (e.g., LLM validation), `clearLogs()` in one call will erase the logs accumulated by the other in-flight call. `console.log` entries fire correctly (per-request), but `getLogs()` / `printSummary()` return corrupted interleaved data.
- **Fix:** Use an `AsyncLocalStorage`-based request context or return logs from `runPipeline` directly instead of storing in module state. If per-request isolation is required, wrap with `AsyncLocalStorage.run()`.

```ts
import { AsyncLocalStorage } from "node:async_hooks";
const logStorage = new AsyncLocalStorage<StageLog[]>();

export function logStage(...) {
  const logs = logStorage.getStore();
  if (logs) logs.push(entry);
  console.log(JSON.stringify({ event: "cv_pipeline_stage", ...entry }));
}
```

---

## worker/src/cv/contour.ts

### CR-3: Fallback contour transfer — potential OpenCV.js use-after-free via MatVector (CRITICAL)
- **Line:** 29, 51, 58-59, 64
- **Issue:** Primary `cv.findContours(edges, contours, hierarchy, ...)` writes to `contours` (MatVector) and `hierarchy` (Mat). Fallback `cv.findContours(thresh, fallbackContours, hierarchy, ...)` reuses the same `hierarchy` Mat, then transfers contour handles to `contours` with `contours.push_back(fallbackContours.get(i))`. When `fallbackContours.delete()` is called, OpenCV.js's `MatVector.delete()` frees the `std::vector<cv::Mat>` container and calls destructors on its elements. This decrements the OpenCV ref count for each Mat. However, OpenCV.js's JS→WASM binding may not properly track these ref counts — if the WASM `vector<Mat>` destructor frees the underlying `Mat` data (not just the wrapper), the pointers remaining in `contours` become dangling. This was the class of bug fixed in the known triple-Canny issue.
- **Fix:** Avoid transferring Mats between vectors. Instead of `push_back(get(i))`, clone each fallback contour: `const clone = new cv.Mat(); fallbackContours.get(i).copyTo(clone); contours.push_back(clone); clone.delete();` Or use a dedicated fallback contours vector and process separately.

### WR-3: Unused `gradX` Mat allocated in findHorizontalEdges (WARNING)
- **Line:** 190
- **Issue:** `const gradX = new cv.Mat()` is created but never used. Only `gradY` and `absGradY` are needed for Y-gradient (horizontal edge) detection. This allocates WASM memory for nothing. While deleted in the finally block (no leak), it's wasteful and could contribute to memory pressure in 128MB Worker limit.
- **Fix:** Remove the `gradX` declaration and its deletion in the finally block.

### WR-4: Pixel-walk bottleneck after vectorized Sobel (WARNING)
- **Line:** 203-213
- **Issue:** After the efficient `cv.Sobel()` (WASM-accelerated), the function iterates every pixel with a nested `for (let y...) { for (let x...) { strength += absGradY.ucharPtr(y, x)[0]; } }` loop. For a 1920×1080 ROI, this is ~2M iterations in JS — on the main thread, blocking the event loop for potentially 100-300ms. This negates the benefit of WASM for the gradient computation.
- **Fix:** Replace the pixel walk with `cv.reduce()` to compute row sums, then iterate rows only:
```ts
const rowSums = new cv.Mat();
cv.reduce(absGradY, rowSums, 1, cv.REDUCE_SUM, cv.CV_32S);
// Now iterate rowSums rows (rows × 1 matrix)
for (let y = 0; y < rowSums.rows; y++) {
  const strength = rowSums.intAt(y, 0);
  if (strength > 100) edges.push({ y, strength });
}
rowSums.delete();
```

---

## worker/src/cv/preprocess.ts

### WR-5: WebP detection too broad — matches any RIFF file (WARNING)
- **Line:** 16-17
- **Issue:** `mimeType()` checks for bytes `[0x52, 0x49]` ("RIFF") to identify WebP. RIFF is the Resource Interchange File Format container used by WAV, AVI, and other formats — not just WebP. A `.wav` audio file or `.avi` video uploaded as an image would pass this check, then fail downstream decode since `decodeImage` falls through to the JPEG fallback for WebP (line 38: "try JPEG"), producing garbled data.
- **Fix:** Check the full RIFF type: `buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50` — the 4th-7th bytes are file size, and bytes 8-11 are "WEBP" for WebP files. Alternatively, simply remove WebP detection since the fallback path tries JPEG anyway (which won't decode WebP correctly); jpeg-js would fail gracefully on WebP data.

### WR-6: OpenCV Mat leak on preprocessing exception (WARNING)
- **Line:** 59-69
- **Issue:** The `try` block creates `gray`, `blurred`, `equalized` Mats before line 59, but the `finally` block only deletes `src`. If `cv.cvtColor(src, gray, ...)` (line 60), `cv.GaussianBlur(...)` (line 62), or `clahe.apply(...)` (line 64) throws, these three Mats leak WASM memory. In a 128MB Worker, repeated leaks from failed images could exhaust memory.
- **Fix:** Move Mat creation inside the try block, or extend the finally to delete them:
```ts
const src = cv.matFromImageData(imageDataObj);
const gray = new cv.Mat();
const blurred = new cv.Mat();
const equalized = new cv.Mat();
try {
  ...
} finally {
  src.delete();
  if (!returned) { gray.delete(); blurred.delete(); equalized.delete(); }
}
```

---

## worker/src/routes/cv-analyze.ts

### WR-7: No type validation on `bottleSizeMl` (WARNING)
- **Line:** 32
- **Issue:** `body.bottleSizeMl ?? 1500` passes user input directly to `validateBottle`. If a client sends `"bottleSizeMl": "1500"` (string), `validateBottle` checks `SUPPORTED_SIZES.has("1500")` — but the Set contains `1500` (number), so strict-equality fails. The user gets an "Unsupported bottle size" error even though they sent a valid value in the wrong type. Also, if `bottleSizeMl` is `0`, the `??` operator treats `0` as non-nullish, so `validateBottle(0)` is called, which returns `supported: false`.
- **Fix:** Coerce to number and validate:
```ts
const bottleSizeMl = Number(body.bottleSizeMl) || 1500;
if (!Number.isFinite(bottleSizeMl) || bottleSizeMl <= 0) {
  return c.json({ error: "Invalid bottleSizeMl" }, 400);
}
```

---

## worker/src/cv/index.ts

### IR-1: ensureCv() does not verify OpenCV.js initialized (INFO)
- **Line:** 6-9
- **Issue:** `ensureCv()` sets `cvReady = true` unconditionally without checking that `@techstark/opencv-js` actually loaded. If the WASM binary fails to compile or the package throws during import, `cv` would be undefined, and the first `cv.cvtColor()` call in `preprocess.ts` would throw a cryptic TypeError.
- **Fix:** Verify `cv.Mat` is constructable after setting the flag:
```ts
if (typeof cv?.Mat !== "function") throw new Error("OpenCV.js failed to initialize");
```

---

## worker/src/cv/config.ts

### IR-2: Dead export — never imported (INFO)
- **Line:** 1-5
- **Issue:** `CONFIDENCE_THRESHOLDS` is exported from `config.ts` but never imported anywhere in the codebase. `confidence.ts` uses inline constants (`EDGE_HIGH = 0.7`, `EDGE_MEDIUM = 0.3`). If thresholds change, they must be updated in two places.
- **Fix:** Import from config.ts in confidence.ts, or remove config.ts.

---

## worker/src/cv/regression.ts

### IR-3: Dynamic import on every call (INFO)
- **Line:** 27
- **Issue:** `await import("./regression-mock.js")` triggers a dynamic import on every pipeline invocation. While the JS runtime caches the module after the first load, the `import()` call still goes through the promise resolution machinery each time. Negligible overhead (~0.1ms) but unnecessary.
- **Fix:** Use static import: `import { mockRegression } from "./regression-mock.js"`.

---

## worker/src/cv/template.ts

### WR-8: Array.from() creates unnecessary copy of template pixel buffer (WARNING)
- **Line:** 45
- **Issue:** `Array.from(pixels)` converts a `Buffer` (Uint8Array of ~25KB per template) into a regular JS array before passing to `cv.matFromArray()`. This doubles memory per template and stalls GC. For templates loaded at startup (not on every request), this is a one-time cost, but it wastes Worker memory.
- **Fix:** Use `cv.matFromArray` with the TypedArray directly if the binding supports it, or use `cv.matFromImageData` with an ImageData-like object:
```ts
const mat = new cv.Mat(height, width, cv.CV_8UC1);
mat.data.set(pixels);
```
Then apply CLAHE as before.

### IR-4: Not wired into pipeline, uses Node.js APIs incompatible with Workers (INFO)
- **Line:** 1-3, 28
- **Issue:** Imports `node:fs/promises`, `node:path`, `node:url` — none of which exist in Cloudflare Workers. If wired into the pipeline (`worker/src/cv/pipeline.ts`), it would crash with import errors. Marked as "reference only" but the import incompatibility is a landmine.
- **Fix:** If this is ever wired, rewrite to use Workers-compatible file access (e.g., R2 bucket or KV for template storage).

---

## worker/src/eval/cv-eval.ts

### WR-9: LLM validation stage never exercised in eval (WARNING)
- **Line:** 47-50
- **Issue:** `runPipeline` is called without `geminiApiKey`, so `pipeline.ts` line 141 (`if (input.geminiApiKey)`) always skips the LLM validation stage. If the regression and LLM paths have bugs, the eval won't detect them. The eval only tests the validate→preprocess→contour→confidence→regression chain.
- **Fix:** Accept a `GEMINI_API_KEY` env var in the eval script and pass it:
```ts
const result = await runPipeline({
  imageData: ...,
  imageBase64: dataUrl,
  geminiApiKey: process.env.GEMINI_API_KEY,
});
```

### IR-5: Double filter computation (INFO)
- **Line:** 93
- **Issue:** `results.filter(r => r.contourFound)` is computed twice in the same template string, iterating the full results array twice. Minor overhead for typical eval sizes (50-200 images), but unnecessary.
- **Fix:** Compute once:
```ts
const contourFoundCount = results.filter(r => r.contourFound).length;
console.log(`contour found: ${contourFoundCount}/${n} = ${(100 * contourFoundCount / n).toFixed(1)}%`);
```

---

## docs/cv-pipeline-architecture.md

### CR-4: Documentation thresholds contradict code (CRITICAL) [doc vs code mismatch]
- **Line:** 33-34
- **Issue:** Architecture doc states "Medium (≥0.4)" and "Low (<0.4)" for the decision gate, but `config.ts` and `confidence.ts` define `high ≥ 0.7`, `medium ≥ 0.3`, `low < 0.3`. The doc also says "Medium (≥0.4)" but pipeline.ts fires regression for medium and LLM for low — this logic is correct, but the threshold value is wrong in the doc. A developer reading only the docs would calibrate expectations incorrectly (expecting fewer LLM escalations than actually occur).
- **Fix:** Update doc to match code:
```
├── High (≥0.7) ──► Direct output
├── Medium (≥0.3) ──► Run regression model
└── Low (<0.3) ──► LLM validation
```

---

## Summary

### Top 3 Risks

1. **Confidence score/tier inconsistency (CR-1)** — Regression path can produce `score=0.8, tier="medium"`, a logically contradictory state. Downstream consumers (UI, API callers, logging) cannot reliably use either field alone to determine confidence. This undermines the entire confidence calibration work from M003.

2. **Logger race condition (CR-2)** — Module-level mutable array shared across concurrent requests in Cloudflare Workers. Two in-flight pipelines will corrupt each other's structured logs via `clearLogs()`. This makes per-request diagnostics unreliable in production under load.

3. **MatVector use-after-free risk (CR-3)** — Fallback contour transfer pushes Mat handles from one vector to another, then deletes the source vector. While correct in standard OpenCV (ref-counted), OpenCV.js's WASM binding may not handle this correctly — the same class of bug as the known triple-Canny issue. Crashing or silently wrong meniscus detection under fallback conditions.

### Architecture Observations

- **Good separation of concerns**: Pipeline stages are cleanly isolated in individual files with clear interfaces. Errors flow through typed error objects. Memory ownership (who deletes the Mats) is well-documented in preprocess.ts's contract with `releasePreprocessed()`.
- **Correct M003 migration**: jpeg-js/pngjs replacements avoid sharp's Worker incompatibility. The CLAHE preprocessing and Sobel-based meniscus detection are architecturally sound.
- **Mock regression limits test coverage**: The eval only tests preprocess→contour→confidence. Regression and LLM paths are untested in the eval harness. The mock model also doesn't exercise ONNX loading or inference error paths.
- **Doc drift**: Architecture doc confidence thresholds don't match code (0.4 vs 0.3). This will cause confusion during maintenance.

### Recommended Fix Priority

| Priority | Issue | File | Effort | Impact |
|----------|-------|------|--------|--------|
| P0 | CR-1: Score/tier mismatch | pipeline.ts:127-130 | 5 min | Api contract correctness |
| P0 | CR-2: Logger race | logger.ts:9 | 30 min | Prod diagnostics reliability |
| P0 | CR-4: Doc thresholds | docs/cv-pipeline-architecture.md:33-34 | 2 min | Developer onboarding |
| P1 | CR-3: MatVector fallback | contour.ts:58-59 | 15 min | Correctness under fallback |
| P1 | WR-4: Pixel-walk perf | contour.ts:203-213 | 20 min | Pipeline latency |
| P1 | WR-6: Mat leak on exception | preprocess.ts:59-69 | 10 min | Memory safety |
| P2 | WR-5: WebP detection | preprocess.ts:16 | 5 min | Input validation |
| P2 | WR-7: bottleSizeMl type | cv-analyze.ts:32 | 5 min | Api robustness |
| P3 | WR-1: Misleading log | pipeline.ts:83 | 2 min | Log accuracy |
| P3 | WR-3: Unused gradX | contour.ts:190 | 2 min | Code cleanliness |
| P3 | WR-8: Array.from copy | template.ts:45 | 5 min | Worker memory |
| P3 | WR-9: Eval gaps | cv-eval.ts:47-50 | 10 min | Test coverage |
| P4 | IR-1 to IR-5 | Various | Various | Code quality |
