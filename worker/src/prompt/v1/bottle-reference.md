**Bottle:** Afia 1.5L cooking oil. Total capacity 1500ml.

**Coordinate system:** Return all `bottleBox` and `liquidLine.points` coordinates
on the image's normalized 0..1000 coordinate plane. X=0 is the left image edge,
X=1000 is the right image edge, Y=0 is the top image edge, and Y=1000 is the
bottom image edge.

**Measurement rules:**
1. Inspect the reference images first. They are calibrated anchors for known
   remaining-ml levels.
2. Inspect the target image last.
3. Your first task is to locate the visible oil-air boundary (meniscus / liquid
   surface line). **Look for the specific visual curve where the liquid meets the air; this "meniscus" often has a distinct dark or light edge, a slight upward or downward curve at the bottle edges, or a subtle change in translucency.**
4. Use only visible boundary evidence. Do **not** infer oil level from label
   artwork, brand colors, expected packaging appearance, or generic bottle tint. **Be especially careful not to let the horizontal lines of the label mislead you into seeing a boundary where none exists. The physical meniscus is your ONLY ground truth.**
5. If the boundary is visible, return a `liquidLine` with 1-3 points that sit on
   the visible oil-air boundary. Use normalized image coordinates, not bottle
   relative ratios.
6. If the boundary is partly obscured by glare, shadow, blur, crop, tilt, or the
   label, still estimate the most defensible boundary position you can see and
   lower confidence.
7. If the boundary is not visibly located, set `liquidBoundaryVisible` to false,
   set `liquidLine` to null, add quality flags, and lower confidence sharply.
   Do not make an overconfident mid-range guess.
8. If the image is not clearly an Afia 1.5L bottle, set `bottleType` to
   `"unknown"` or `"afia_2_5l"` and do not invent a measurement.

**Output JSON schema (no prose, no markdown, no extra fields):**
{ "schemaVersion": "afia_visual_evidence_v1",
  "bottleDetected": <boolean>,
  "bottleType": "afia_1_5l" | "afia_2_5l" | "unknown",
  "bottleTypeConfidence": <0..1>,
  "topVisible": <boolean>,
  "bottomVisible": <boolean>,
  "frontLabelVisible": <boolean>,
  "liquidBoundaryVisible": <boolean>,
  "bottleBox": { "yMin": <0..1000>, "xMin": <0..1000>, "yMax": <0..1000>, "xMax": <0..1000> } | null,
  "liquidLine": { "kind": "line", "points": [{ "x": <0..1000>, "y": <0..1000> }] } | null,
  "qualityFlags": <array of strings>,
  "evidenceConfidence": <0..1>,
  "refusalReason": <string or null> }

**Reference mapping:** The reference images are visual calibration anchors, but do
not average between them unless the target boundary is actually visible, and NEVER copy their exact boundary positions blindly.

**Confidence guidance:**
- >= 0.85 only when the bottle is fully visible and the boundary is clearly seen.
- 0.50-0.84 when the boundary is somewhat visible but affected by mild glare,
  crop, or label interference.
- < 0.50 when the boundary is largely hidden, ambiguous, or the reading is weak.

**Anti-Pattern Warning:**
- **Few-Shot Ghosting:** This is the error of repeating a few-shot's boundary
  position because it seems "close enough". Avoid this. Trust your eyes on the
  target image.
- **Label Snapping:** This is the error of snapping to a horizontal line on the label instead of the actual liquid surface. The meniscus often cuts across or sits between label lines. Look for the liquid's physical properties (translucency, refraction, surface tension curve).
