**Bottle:** Afia 1.5L cooking oil. Total capacity 1500ml.

**Coordinate system:** Y=0 is the cap/top of the bottle image; Y=1 is the base.
The usable oil column runs roughly from Y=0.18 (full) to Y=0.96 (empty).

**Measurement rules:**
1. Inspect the reference images first. They are calibrated anchors for known
   remaining-ml levels.
2. Inspect the target image last.
3. Your first task is to locate the visible oil-air boundary (meniscus / liquid
   surface line). **Look for the specific visual curve where the liquid meets the air; this "meniscus" often has a distinct dark or light edge, a slight upward or downward curve at the bottle edges, or a subtle change in translucency.**
4. Use only visible boundary evidence. Do **not** infer oil level from label
   artwork, brand colors, expected packaging appearance, or generic bottle tint. **Be especially careful not to let the horizontal lines of the label mislead you into seeing a boundary where none exists. The physical meniscus is your ONLY ground truth.**
5. If the boundary is visible, estimate `oilSurfaceYRatio` directly by observing its position relative to the bottle top (0) and base (1). **DO NOT simply copy the exact `y` value from the closest reference image.** Few-shots are examples to help you understand the scale, NOT a menu of possible answers. You MUST interpolate. If you output a `oilSurfaceYRatio` that is IDENTICAL to a few-shot value, you are likely failing to observe the specific target image carefully enough. Every image is slightly different; your output should reflect that precision.
6. If the boundary is partly obscured by glare, shadow, blur, crop, tilt, or the
   label, still estimate the most defensible boundary position you can see and
   lower confidence.
7. If the boundary is not visibly located, mark `meniscusVisible` as `"uncertain"`
   or `"no"`, add quality flags, and lower confidence sharply. Do not make an
   overconfident mid-range guess.
8. `nearestReferenceMl` is advisory only: use it to indicate which reference the
   target most closely resembles after locating the boundary.

**Output JSON schema (no other fields, no markdown):**
{ "visualReasoning": <string explaining physical observations>,
  "readingPossible": <boolean>,
  "meniscusVisible": "yes" | "no" | "uncertain",
  "oilSurfaceYRatio": <0..1>,
  "nearestReferenceMl": <number 0..1500>,
  "qualityFlags": <array of strings>,
  "confidence": <0..1> }

**Reference mapping:** The reference images are visual calibration anchors, but do
not average between them unless the target boundary is actually visible, and NEVER copy their exact `oilSurfaceYRatio` outputs blindly.

**Confidence guidance:**
- >= 0.85 only when the bottle is fully visible and the boundary is clearly seen.
- 0.50-0.84 when the boundary is somewhat visible but affected by mild glare,
  crop, or label interference.
- < 0.50 when the boundary is largely hidden, ambiguous, or the reading is weak.

**Anti-Pattern Warning:**
- **Few-Shot Ghosting:** This is the error of repeating a few-shot's `oilSurfaceYRatio` or `nearestReferenceMl` because it seems "close enough". Avoid this. Trust your eyes on the target image.
- **Label Snapping:** This is the error of snapping to a horizontal line on the label instead of the actual liquid surface. The meniscus often cuts across or sits between label lines. Look for the liquid's physical properties (translucency, refraction, surface tension curve).
