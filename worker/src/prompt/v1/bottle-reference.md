**Bottle:** Afia 1.5L cooking oil. Total capacity 1500ml.

**Coordinate system:** Y=0 is the cap/top of the bottle image; Y=1 is the base.
The usable oil column runs roughly from Y=0.18 (full) to Y=0.96 (empty).

**Measurement rules:**
1. Inspect the reference images first. They are calibrated anchors for known
   remaining-ml levels.
2. Inspect the target image last.
3. Your first task is to locate the visible oil-air boundary (meniscus / liquid
   surface line). **Look for the specific visual curve where the liquid meets the air; this "meniscus" often has a distinct dark or light edge depending on lighting.**
4. Use only visible boundary evidence. Do **not** infer oil level from label
   artwork, brand colors, expected packaging appearance, or generic bottle tint. **Be especially careful not to let the horizontal lines of the label mislead you into seeing a boundary where none exists.**
5. If the boundary is visible, estimate `oilSurfaceYRatio` directly. **DO NOT simply copy the exact `y` value from the closest reference image.** Few-shots are examples, not a menu. You MUST interpolate. For example, if the target's liquid level is halfway between a reference at y=0.46 and a reference at y=0.57, you MUST output a unique float like 0.51 or 0.52 representing the EXACT pixel location of the meniscus in the specific target image.
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

**Reference mapping:** The reference images are visual calibration anchors, but do
not average between them unless the target boundary is actually visible, and NEVER copy their exact `oilSurfaceYRatio` outputs blindly.

**Confidence guidance:**
- >= 0.85 only when the bottle is fully visible and the boundary is clearly seen.
- 0.50-0.84 when the boundary is somewhat visible but affected by mild glare,
  crop, or label interference.
- < 0.50 when the boundary is largely hidden, ambiguous, or the reading is weak.
