**Bottle:** Afia 1.5L cooking oil. Total capacity 1500ml.

**Geometry:** Y=0 is the cap; Y=1 is the base. The fillable region runs roughly
from Y=0.18 (top of the oil column when full) to Y=0.96 (bottom of the column
when empty).

**Your job:**
1. Locate the oil-air boundary (the meniscus / liquid surface line).
2. Estimate its normalized Y position within the bottle bounding box (0..1).
3. Convert to remaining ml by linear interpolation across the fillable region.
4. consumedMl = 1500 - remainingMl.
5. Report a confidence score (0..1) reflecting image quality and visibility.

**Output JSON schema (no other fields, no markdown):**
{ "remainingMl": <integer 0..1500>,
  "consumedMl":  <integer 0..1500>,
  "redLineYRatio": <0..1>,
  "confidence":  <0..1> }

If the bottle is fully visible and the oil surface is unambiguous, confidence should
be >=0.85. Lower it for occlusion, glare, blur, extreme tilt, or partial framing.
