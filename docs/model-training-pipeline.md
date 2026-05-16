# Model Training Pipeline

## Overview

The regression model refines CV contour detection output in medium-confidence cases. Training is done offline (Python), inference runs on Workers via ONNX Runtime WASM.

## Training Data

**Source:** Existing probe set fixtures + augmented variants
**Target:** ~100 labeled images
**Label:** Meniscus Y-position (ground truth from human annotation)
**Split:** 60% train / 20% validation / 20% test

### Augmentation

| Technique | Range | Rationale |
|-----------|-------|-----------|
| Rotation | ±10° | Camera angle variance |
| Brightness | ±20% | Lighting variation |
| Contrast | ±15% | Different bottle/light combos |
| Gaussian noise | σ=5 | Sensor noise |
| Horizontal flip | 50% | Mirror images |

## Model Architecture

- **Input:** 64×64 grayscale crop centered on estimated meniscus
- **Architecture:** Simple CNN (3 conv layers + 2 dense layers) or MobileNetV2 variant
- **Output:** Single float (refined Y-position in 0-1 range)
- **Loss:** MSE (mean squared error)
- **Framework:** PyTorch or TensorFlow (export to ONNX)

## Training Command

```bash
python train_regression.py \
  --data-dir ./training-data \
  --epochs 100 \
  --batch-size 16 \
  --lr 0.001 \
  --model-output ./model/meniscus-regression.onnx
```

## Export to ONNX

```python
import torch
model = MeniscusRegressor()
model.load_state_dict(torch.load("checkpoint.pt"))
model.eval()
dummy_input = torch.randn(1, 1, 64, 64)
torch.onnx.export(model, dummy_input, "meniscus-regression.onnx")
```

## Deploy to Workers

```bash
# Upload model to R2 bucket
npx wrangler r2 object put cv-models/meniscus-regression.onnx --file=./model/meniscus-regression.onnx

# Worker loads model at startup from R2 binding
```

## Worker Inference

```typescript
// In regression.ts:
const modelBytes = await env.MODEL_BUCKET.get("meniscus-regression.onnx");
const session = await ort.InferenceSession.create(await modelBytes.arrayBuffer());
const result = await session.run({ input: preprocessedTensor });
```

## Dependencies (Worker)

- `onnxruntime-web` or `@onnx/runtime-wasm` — ONNX WASM runtime
- Model stored in R2 bucket with binding `MODEL_BUCKET`

## Model Versioning

- Models stored in R2 at `cv-models/{name}-v{version}.onnx`
- `cv-models/latest` symlink points to current model
- Worker reads `latest` at startup
- Rollback: update `latest` symlink to previous version
