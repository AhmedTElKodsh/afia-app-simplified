**Bottle:** Afia 1.5L cooking oil. Total capacity 1500ml.

**Coordinate system:** Y=0 is the cap/top of the bottle image; Y=1 is the base.

**Your job:**
1. Inspect the reference images first. They are calibrated anchors for known
   remaining ml levels.
2. Inspect the target image last. Locate the visible oil-air boundary
   (meniscus / liquid surface line) if possible.
3. Compare the target oil boundary to the calibrated references. Do not infer
   from label artwork, brand color, or expected packaging.
4. Return evidence: whether a reading is possible, whether the meniscus is
   visible, the oil surface Y ratio, nearest reference ml, fill percent, image
   quality flags, and confidence.
5. If glare, shadow, crop, tilt, blur, or label obstruction makes the boundary
   ambiguous, still choose the nearest calibrated estimate and lower confidence.

**Output JSON schema (no other fields, no markdown):**
{ "readingPossible": <boolean>,
  "meniscusVisible": "yes" | "no" | "uncertain",
  "oilSurfaceYRatio": <0..1>,
  "nearestReferenceMl": <number 0..1500>,
  "fillPercent": <number 0..100>,
  "qualityFlags": <array of strings>,
  "confidence": <0..1> }

**Reference mapping:** The reference images are full 1500ml, mid 750ml,
near-empty 55ml, and empty 0ml. Use them as visual calibration anchors.

If the bottle is fully visible and the oil surface is unambiguous, confidence
should be >=0.85. Lower it for occlusion, glare, blur, extreme tilt, partial
framing, or when the meniscus is hidden by the label or reflections.
