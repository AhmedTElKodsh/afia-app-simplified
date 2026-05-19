import type { FewShot, FewShotManifestEntry, LoadedPrompt } from "./load.js";

const SYSTEM_TEXT = `You are a precise visual measurement assistant. You estimate remaining cooking
oil in a 1.5L Afia bottle by locating the visible oil-air boundary in the
target image and comparing it to calibrated reference images.

Your primary task is measurement, not guesswork. If the oil boundary is not
visibly located, say so through the required fields and lower confidence.

Return exactly one valid JSON object and no markdown, prose, or extra fields.
The JSON object must include \`visualReasoning\` as its first field. Use that
field to describe the physical observations that justify the measurement before
providing the numeric measurement fields.
`;

const USER_TEXT = `**Bottle:** Afia 1.5L cooking oil. Total capacity 1500ml.

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
5. If the boundary is visible, estimate \`oilSurfaceYRatio\` directly by observing its position relative to the bottle top (0) and base (1). **DO NOT simply copy the exact \`y\` value from the closest reference image.** Few-shots are examples to help you understand the scale, NOT a menu of possible answers. You MUST interpolate. If you output a \`oilSurfaceYRatio\` that is IDENTICAL to a few-shot value, you are likely failing to observe the specific target image carefully enough. Every image is slightly different; your output should reflect that precision.
6. If the boundary is partly obscured by glare, shadow, blur, crop, tilt, or the
   label, still estimate the most defensible boundary position you can see and
   lower confidence.
7. If the boundary is not visibly located, mark \`meniscusVisible\` as \`"uncertain"\`
   or \`"no"\`, add quality flags, and lower confidence sharply. Do not make an
   overconfident mid-range guess.
8. \`nearestReferenceMl\` is advisory only: use it to indicate which reference the
   target most closely resembles after locating the boundary.

**Output JSON schema (no prose, no markdown, no extra fields):**
{ "visualReasoning": <string explaining physical observations>,
  "readingPossible": <boolean>,
  "meniscusVisible": "yes" | "no" | "uncertain",
  "oilSurfaceYRatio": <0..1>,
  "nearestReferenceMl": <number 0..1500>,
  "qualityFlags": <array of strings>,
  "confidence": <0..1> }

**Reference mapping:** The reference images are visual calibration anchors, but do
not average between them unless the target boundary is actually visible, and NEVER copy their exact \`oilSurfaceYRatio\` outputs blindly.

**Confidence guidance:**
- >= 0.85 only when the bottle is fully visible and the boundary is clearly seen.
- 0.50-0.84 when the boundary is somewhat visible but affected by mild glare,
  crop, or label interference.
- < 0.50 when the boundary is largely hidden, ambiguous, or the reading is weak.

**Anti-Pattern Warning:**
- **Few-Shot Ghosting:** This is the error of repeating a few-shot's \`oilSurfaceYRatio\` or \`nearestReferenceMl\` because it seems "close enough". Avoid this. Trust your eyes on the target image.
- **Label Snapping:** This is the error of snapping to a horizontal line on the label instead of the actual liquid surface. The meniscus often cuts across or sits between label lines. Look for the liquid's physical properties (translucency, refraction, surface tension curve).
`;

const MANIFEST: FewShotManifestEntry[] = [
  { path: "full-1500.json", role: "anchor", remainingMl: 1500 },
  { path: "high-1210.json", role: "anchor", remainingMl: 1210 },
  { path: "hidden/vhigh-1375.json", role: "golden", remainingMl: 1375 },
  { path: "hidden/highmid-1100.json", role: "golden", remainingMl: 1100 },
  { path: "hidden/midhigh-935.json", role: "golden", remainingMl: 935 },
  { path: "mid-770.json", role: "anchor", remainingMl: 770 },
  { path: "hidden/mid-605.json", role: "golden", remainingMl: 605 },
  { path: "hidden/midlow-495.json", role: "golden", remainingMl: 495 },
  { path: "hidden/lowmid-385.json", role: "golden", remainingMl: 385 },
  { path: "low-275.json", role: "anchor", remainingMl: 275 },
  { path: "hidden/vlow-165.json", role: "golden", remainingMl: 165 },
  { path: "empty.json", role: "anchor", remainingMl: 0 },
];

const FEW_SHOTS: Record<string, FewShot> = {
  "full-1500.json": shot("oil-bottle-frames/1.5L_refs/1500ml.jpg", 0.18, 1500, 0.95),
  "high-1210.json": shot("oil-bottle-frames/1210ml/1210ml_t0041.03s_f0082.jpg", 0.33, 1210, 0.88),
  "hidden/vhigh-1375.json": shot("oil-bottle-frames/1375ml/1375ml_t0000.00s_f0000.jpg", 0.25, 1375, 0.9),
  "hidden/highmid-1100.json": shot("oil-bottle-frames/1100ml/1100ml_t0000.00s_f0000.jpg", 0.39, 1100, 0.9),
  "hidden/midhigh-935.json": shot("oil-bottle-frames/935ml/935ml_t0009.52s_f0019.jpg", 0.47, 935, 0.88),
  "mid-770.json": shot("oil-bottle-frames/770ml/770ml_t0000.00s_f0000.jpg", 0.56, 770, 0.9),
  "hidden/mid-605.json": shot("oil-bottle-frames/605ml/605ml_t0000.00s_f0000.jpg", 0.65, 605, 0.9),
  "hidden/midlow-495.json": shot("oil-bottle-frames/495ml/495ml_t0007.01s_f0014.jpg", 0.7, 495, 0.88),
  "hidden/lowmid-385.json": shot("oil-bottle-frames/385ml/385ml_t0000.00s_f0000.jpg", 0.76, 385, 0.9),
  "low-275.json": shot("oil-bottle-frames/275ml/275ml_t0002.50s_f0005.jpg", 0.82, 275, 0.88),
  "hidden/vlow-165.json": shot("oil-bottle-frames/165ml/165ml_t0000.00s_f0000.jpg", 0.87, 165, 0.9),
  "empty.json": shot("oil-bottle-frames/1.5L_refs/empty.jpg", 0.96, 0, 0.95),
};

export function loadBundledPrompt(version: string): LoadedPrompt {
  if (version !== "v1") throw new Error(`Bundled prompt version ${version} is not available`);
  return {
    systemText: SYSTEM_TEXT,
    userText: USER_TEXT,
    fewShots: MANIFEST.map((entry) => FEW_SHOTS[entry.path]),
    promptHash: "6b9920769d1dd32c",
    fewshotHash: "ce8e370ec7aa246b",
    promptVersion: version,
    fewShotManifest: MANIFEST,
  };
}

function shot(imagePath: string, oilSurfaceYRatio: number, nearestReferenceMl: number, confidence: number): FewShot {
  return {
    imagePath,
    expected: {
      readingPossible: true,
      meniscusVisible: "yes",
      oilSurfaceYRatio,
      nearestReferenceMl,
      qualityFlags: [],
      confidence,
    },
  };
}
