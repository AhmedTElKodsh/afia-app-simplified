# S06: Regression Pipeline — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

## Domain

S06 builds the lightweight regression model that refines meniscus position when the CV contour detection has medium confidence (0.4-0.7). The model takes a cropped region around the estimated meniscus and outputs a refined fill ratio.

## Implementation Decisions

### Model Architecture
- Simple CNN or MobileNet variant for on-device inference
- Input: 64×64 grayscale crop centered on estimated meniscus
- Output: refined Y-position (regression, single float)

### Deployment
- ONNX Runtime WASM for Worker inference (no Python runtime needed)
- Model stored in R2 bucket, loaded at Worker startup
- Cold start loads model, warm requests reuse it

### Training
- Python script (offline, not in Worker)
- Uses existing probe set + augmented variants (~100 images)
- Labels from contour-detected meniscus positions
- Train/val/test split: 60/20/20

## Existing Code Insights
- S05 built: `worker/src/cv/contour.ts`, `worker/src/cv/pipeline.ts`
- Existing probe manifest with 12 images
- No ML inference infrastructure exists yet

## Specific Ideas
1. Create ONNX inference wrapper for Workers
2. Build mock model for integration testing
3. Document training pipeline for offline execution
4. Add structured logging to pipeline stages

## Deferred
- Model training (offline, separate session)
- Hyperparameter tuning
