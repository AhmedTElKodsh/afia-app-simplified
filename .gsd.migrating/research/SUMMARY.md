# Stage 2 Research: OpenCV + Regression Pipeline

**Date:** 2026-05-13
**Domain:** Computer vision fill-level measurement for translucent bottles

## Stack

- **OpenCV** (cv2) — contour detection, edge detection (Canny), Hough line transform, perspective correction
- **ONNX Runtime** or **TensorFlow Lite** — lightweight regression model inference
- **Python** for pipeline development, or **ONNX.js** for browser/Worker inference
- Key OpenCV functions: `cvtColor`, `Canny`, `findContours`, `HoughLinesP`, `warpPerspective`, `threshold`

## Approach: Hybrid CV + Regression

### Step 1: Image Preprocessing
- Convert to grayscale, apply Gaussian blur
- Perspective correction using bottle edges
- Normalize for lighting differences (histogram equalization, CLAHE)

### Step 2: OpenCV Contour Detection
- Canny edge detection → findContours
- Identify bottle body region (largest vertical contour)
- Detect oil-air meniscus (horizontal line within bottle body)
- Map meniscus Y-position to fill ratio using known bottle geometry (1.5L dimensions)

### Step 3: Regression Refinement
- For ambiguous cases (glare, label overlap, shadows): crop region around estimated meniscus, pass to lightweight regression model
- Output: refined fill ratio + confidence score
- Training data: ~100 labeled images from existing probe set + augmented variants

### Step 4: LLM Validation (Optional)
- Only if CV confidence is low: pass cropped region + measurement to LLM for sanity check
- LLM output doesn't override CV — only flags "uncertain" cases for admin review

## Key Challenges

- **Glare/reflections** on bottle surface can mask the meniscus
- **Label artwork** overlaps the measurement region on some bottles
- **Lighting variability** across real-world photos
- **Perspective distortion** from handheld phone photos

## Advantages Over Stage 1

- Deterministic measurement (contour detection is repeatable)
- No API costs (local inference)
- ±50ml achievable with proper calibration
- Training data from M001 can be reused

## Build Order

1. OpenCV contour detection prototype (Python or TypeScript)
2. Calibration against existing probe set (12 images + augmented set)
3. Regression head training (if contour-only accuracy < target)
4. LLM validation layer (if desired)
5. Integration with existing Worker API
