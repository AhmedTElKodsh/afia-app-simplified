# Stage 1 Consumer UX Requirements

## Purpose

This spec defines the consumer-facing Stage 1 experience for a fresh reviewer or implementer. After reading it, they should be able to validate whether the QR-to-camera-to-result flow matches the intended product workflow.

## UX Scope

Stage 1 supports the 1.5L Afia bottle as the only analysis-enabled product. The 2.5L bottle must have a distinct QR/product identity, but it remains pending for analysis until 1.5L succeeds end to end.

## Required Flow

1. The user scans a product barcode or mock QR.
2. The deployed scan link opens with bottle identity preserved.
3. A supported 1.5L link requests camera access and opens the environment-facing camera when available.
4. The capture screen asks for the front side of the bottle, not the back or side views.
5. A transparent 1.5L outline appears without blocking instructions, language/theme controls, status text, or the capture button.
6. The guide tells the user when to move closer, move farther, align the bottle, or adjust the phone angle.
7. The guide transitions through red, orange, and green states and may auto-capture only after a stable green lock.
8. Manual capture remains available as a fallback.
9. Basic quality checks reject clearly unusable captures before API analysis when frame data is available.
10. The result screen shows the actual captured image with a fixed detected red line.
11. The left vertical slider starts at the detected estimate and moves in 55ml steps.
12. The cup counter below the slider updates in quarter-cup increments.
13. Accepting or submitting a correction stores reviewable evidence when the result has a persisted analysis id.

## Capture Guidance Requirements

- The bottle guide stays upright.
- The visual goal is a full, smaller bottle with margin around it, created by distance and a slight downward phone angle.
- Guidance must not imply that the user should rotate the bottle sideways.
- Red/orange/green must be paired with readable text so the user is not relying on color alone.
- Auto-capture must not fire while the guide is unstable or still searching.
- Manual capture and retake paths must remain clear.

## Quality Feedback Requirements

The capture screen should reject or warn on:

- Very low resolution.
- Very dark frames.
- Overexposed or glare-heavy frames.
- Very blurry or visually flat frames.
- Wrong side, partial bottle, poor framing, unsupported product, or uncertain label when these are detected by API/model/diagnostic paths.

Rejected and uncertain captures may be useful diagnostics, but they must not silently become trusted training labels.

## Result Requirements

- The displayed image must be the real captured raster image.
- Placeholder SVGs or synthetic images must not be treated as analyzed captures.
- The detected red line is the model/API estimate and remains fixed.
- The slider is a correction control; moving it changes the correction candidate, not the evidence line.
- Slider movement snaps to 55ml because 55ml equals one quarter cup.
- If the remaining oil is below the next full 55ml step, the slider clamps to the last full step.
- Cup labels must cover quarter, half, three-quarter, full, and mixed whole-plus-quarter states.

## Phone Readiness Gate

The UX is demo-ready only after a deployed smoke proves:

- At least one Android and one iOS path, or a documented equivalent if devices are unavailable.
- Camera permission allowed, denied, retry, and manual fallback states.
- Overlay layout on small screens.
- Stable guide behavior under normal lighting and common glare/background conditions.
- Auto-capture does not surprise the user.
- Result image, red line, slider, cup counter, and correction submission all work from a real capture.
