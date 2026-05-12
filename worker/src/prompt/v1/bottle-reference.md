**Bottle:** Afia 1.5L cooking oil. Total capacity 1500ml.

**Coordinate system:** Y=0 is the cap/top of the bottle image; Y=1 is the base.
The usable oil column runs roughly from Y=0.18 (full) to Y=0.96 (empty).

**Measurement rules:**
1. Inspect the reference images first. They are calibrated anchors for known
   remaining-ml levels.
2. Inspect the target image last.
3. Your first task is to locate the visible oil-air boundary (meniscus / liquid
   surface line).
4. Use only visible boundary evidence. Do **not** infer oil level from label
   artwork, brand colors, expected packaging appearance, or generic bottle tint.
5. If the boundary is visible, estimate `oilSurfaceYRatio` directly.
6. If the boundary is partly obscured by glare, shadow, blur, crop, tilt, or the
   label, still estimate the most defensible boundary position you can see and
   lower confidence.
7. If the boundary is not visibly located, mark `meniscusVisible` as `"uncertain"`
   or `"no"`, add quality flags, and lower confidence sharply. Do not make an
   overconfident mid-range guess.
8. `nearestReferenceMl` is advisory only: use it to indicate which reference the
   target most closely resembles after locating the boundary.

**Output JSON schema (no other fields, no markdown):**
{ "readingPossible": <boolean>,
  "meniscusVisible": "yes" | "no" | "uncertain",
  "oilSurfaceYRatio": <0..1>,
  "nearestReferenceMl": <number 0..1500>,
  "qualityFlags": <array of strings>,
  "confidence": <0..1> }

**Reference mapping:** The reference images are full 1500ml, mid 750ml,
near-empty 55ml, and empty 0ml. Use them as visual calibration anchors, but do
not average between them unless the target boundary is actually visible.

**Confidence guidance:**
- >= 0.85 only when the bottle is fully visible and the boundary is clearly seen.
- 0.50-0.84 when the boundary is somewhat visible but affected by mild glare,
  crop, or label interference.
- < 0.50 when the boundary is largely hidden, ambiguous, or the reading is weak.
