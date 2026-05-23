# Technical Architecture Blueprint & Implementation Roadmap

This comprehensive blueprint outlines the end-to-end technical architecture, open-source integrations, and production-ready implementation patterns for the **Afia Oil Level Scanner Application**. This system is structured as a **pnpm TypeScript monorepo** targeting **Cloudflare Workers** for compute and **Supabase** for persistence.

The project is structured into two sequential delivery milestones:

* **Stage 1 (API-First Validation):** Direct-to-LLM Vision API orchestration with dynamic prompt tuning, failure modes, key rotation, and metadata capture.
* **Stage 2 (Local Edge Deployment):** Training and compiling a lightweight, in-browser object detection and instance segmentation model (YOLOv8/11-seg) compiled to WebAssembly/WebGL via `onnxruntime-web` to decouple runtime costs and offline limitations, using the Stage 1 database as a high-density training set.

---

## Technical Component Matrix

| Module | Architectural Role | Core Libraries & Repositories | Key Technical Mechanism |
| --- | --- | --- | --- |
| **Module 1** | Decoupled QR Engine & Routing | `mebjas/html5-qrcode`, `zxing-js/library` | Canvas-isolated video parsing with geometry-based path parameters (`/scan?size=1.5L`). |
| **Module 2** | Pre-Flight Image Quality Assurance | Custom WebGL/Canvas implementations, `thesimon82/Laplacian-Blur-Detector` | Client-side Variance of Laplacian kernel matrices and luminance checks to eliminate upstream tokens on garbage frames. |
| **Module 3** | Smart Overlay Alignment & UX | `opencv/opencv` (WebAssembly build), Custom SVG layout | Real-time structural guide overlays transitioning from manual capture to contour alignment (`matchShapes` / Hu Moments). |
| **Module 4** | Cloudflare Workers Vision Gateway | `@google/generative-ai`, `@supabase/supabase-js`, `base64-arraybuffer` | Provider-agnostic proxying with key rotation, Grok fallback, and binary-safe Supabase Storage integration via chunked `ArrayBuffer` streaming. |
| **Module 5** | Token Reduction & Prompt Engineering | Native HTML Canvas Stitching, JSON Schema Constraints | Image-grid stitching of few-shot references into a single visual canvas to prevent sub-image tile inflation. |
| **Module 6** | Stage 2 Browser Edge Inference | `microsoft/onnxruntime-web`, `ultralytics/ultralytics` | Client-side execution of a customized YOLO segmentation model compiled to ONNX, mapping output tensors to fluid volumes. |
| **Module 7** | Volumetric Gauge Slider UI | Framer Motion, Native SVG ClipPaths, Custom React Hooks | Double-bound interactive vertical slider computing exact 55ml steps linked to dynamic volumetric liquid wave SVGs. |

---

## Module 1: Decoupled QR Engine & Client-Side Routing

The application requires an efficient QR scanner initialized prior to full camera control activation. The scanner reads mock QR codes and parses parameters to determine the bottle volume (focusing strictly on the `1.5L` pipeline, while mapping the `2.5L` token path for future execution blocks).

### 1. Technical Implementation Patterns

* **Engine Isolation:** Initialize the QR scanner on a distinct canvas element. Once a valid URL containing target parameters (e.g., `https://afia.dev/scan?size=1.5L`) is resolved, unmount the scanner engine, release the media stream track locks, and trigger an internal state change or route push to the vision pipeline.
* **Handling Variations:** Use separate mock QR codes encoded with query parameters specifying product profiles:
* `1.5L Profile`: `{ "sku": "afia-1.5L", "geometry": "standard-1.5" }`
* `2.5L Profile`: `{ "sku": "afia-2.5L", "geometry": "wide-2.5" }` (Triggers an explicit system block in UI: "Analysis only supported for 1.5L bottles at this stage").



### 2. Open-Source Reference Libraries

* **`mebjas/html5-qrcode`:** Highly optimized end-to-end library utilizing native browser `BarcodeDetector` with a fallback to a built-in modified engine. Excellent abstraction for clean camera state cleanup (`scanner.clear()`).
* **`zxing-js/library`:** Low-level port of the ZXing library. Allows fine-grained control over raw canvas pixel buffers, minimizing garbage collection spikes on low-end hardware.

### 3. Production Code Snippet: Decoupled QR Scanner Component

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (profile: { size: string; sku: string }) => void;
  onScanError: (error: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onScanError }) => {
  const videoRegionId = 'qr-video-region';
  const qrEngineRef = useRef<Html5Qrcode | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    if (!isActive) return;

    const qrEngine = new Html5Qrcode(videoRegionId);
    qrEngineRef.current = qrEngine;

    qrEngine.start(
      { facingMode: 'environment' },
      {
        fps: 15,
        qrbox: (width, height) => ({ width: width * 0.7, height: height * 0.7 }),
      },
      (decodedText) => {
        try {
          const url = new URL(decodedText);
          const size = url.searchParams.get('size');
          const sku = url.searchParams.get('sku') || 'unknown';
          
          if (size) {
            // Terminate scanner tracks cleanly before moving downstream
            qrEngine.stop().then(() => {
              setIsActive(false);
              onScanSuccess({ size, sku });
            }).catch(err => console.error("Error stopping QR Engine:", err));
          }
        } catch (e) {
          // If not a valid URL, parse text as raw configuration token
          onScanError('Invalid QR Code Target');
        }
      },
      (errorMessage) => {
        // Soft error handling to prevent frame-by-frame UI crashing
      }
    ).catch((err) => {
      onScanError(`Initialization Failure: ${err.message}`);
    });

    return () => {
      if (qrEngineRef.current && qrEngineRef.current.isScanning) {
        qrEngineRef.current.stop().catch(err => console.error("Teardown catch:", err));
      }
    };
  }, [isActive, onScanSuccess, onScanError]);

  return (
    <div className="relative w-full h-full max-w-md mx-auto overflow-hidden rounded-xl bg-black">
      <div id={videoRegionId} className="w-full h-full object-cover" />
      <div className="absolute inset-0 border-2 border-dashed border-yellow-400 pointer-events-none opacity-60 m-12 rounded-lg" />
    </div>
  );
};

```

---

## Module 2: Pre-Flight Image Quality Assurance (Client-Side)

To minimize operational costs, edge compute requirements, and downstream failures caused by invalid payloads, the client application must evaluate incoming frames before transmission to the vision API.

### 1. Algorithm Explanations

* **Blur Detection (Variance of Laplacian):** Convolve the grayscale representation of the captured camera image with a standard $3 \times 3$ Laplacian kernel:

$$\Delta = \begin{bmatrix} 0 & 1 & 0 \\ 1 & -4 & 1 \\ 0 & 1 & 0 \end{bmatrix}$$



Compute the variance of the resulting matrix response. A variance below a predefined threshold (empirically derived, typically $\sigma^2 \le 100$) indicates an absence of high-frequency edges, designating the frame as blurry.
* **Exposure Evaluation (Luminance Histogram):** Parse pixel colors from an offscreen HTML5 canvas. Map individual $R, G, B$ bytes into standard CCIR 601 perceived luminance values:

$$Y = 0.299R + 0.587G + 0.114B$$



Calculate average luminance. If $Y < 40$, flag the image as severely under-exposed (poor lighting). If $Y > 240$, flag the image as over-exposed.

### 2. Open-Source Reference Libraries

* **`thesimon82/Laplacian-Blur-Detector`:** Compact pure JavaScript implementation of edge-variance analysis using standard imageData buffers.
* **`jsfeat` (JavaScript Computer Vision Library):** Provides high-performance image processing matrix primitives. Ideal for localized execution of structural kernels without loading a heavy runtime library.

### 3. Production Code Snippet: Client-Side Quality Gate

```typescript
export interface QualityReport {
  passed: boolean;
  blurScore: number;
  avgLuminance: number;
  reason?: 'POOR_LIGHTING' | 'BLURRY_IMAGE' | 'OVER_EXPOSED';
}

export function analyzeFrameQuality(canvas: HTMLCanvasElement, blurThreshold = 80): QualityReport {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not secure offscreen context canvas execution block');

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let totalLuminance = 0;
  const pixelCount = width * height;
  const grayscale = new Uint8ClampedArray(pixelCount);

  // Single-pass luminance map generation
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    
    totalLuminance += y;
    grayscale[i / 4] = y;
  }

  const avgLuminance = totalLuminance / pixelCount;

  // Out-of-bounds illumination checks
  if (avgLuminance < 35) return { passed: false, blurScore: 0, avgLuminance, reason: 'POOR_LIGHTING' };
  if (avgLuminance > 245) return { passed: false, blurScore: 0, avgLuminance, reason: 'OVER_EXPOSED' };

  // Discrete 2D Laplacian Variance calculation over grayscale map
  let laplacianSum = 0;
  let laplacianSqSum = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      // Kernel calculation
      const center = grayscale[idx];
      const north = grayscale[idx - width];
      const south = grayscale[idx + width];
      const east = grayscale[idx + 1];
      const west = grayscale[idx - 1];

      const laplacianResponse = (north + south + east + west) - (4 * center);
      laplacianSum += laplacianResponse;
      laplacianSqSum += laplacianResponse * laplacianResponse;
    }
  }

  const activePixels = (width - 2) * (height - 2);
  const mean = laplacianSum / activePixels;
  const variance = (laplacianSqSum / activePixels) - (mean * mean);

  if (variance < blurThreshold) {
    return { passed: false, blurScore: variance, avgLuminance, reason: 'BLURRY_IMAGE' };
  }

  return { passed: true, blurScore: variance, avgLuminance };
}

```

---

## Module 3: Smart Overlay Alignment & UX Integration

The UI must project a structural outline layout matching the exact geometry of the 1.5L Afia bottle. This layout should adjust to the display size of the mobile viewport while ensuring overlay elements (such as text warnings and language selection controls) remain clear and do not overlap.

```
+---------------------------------------------+
|  [ARABIC/EN]                  [THEME TOGGLE]| <-- Dynamic Flex Header
|                                             |
|        !! KEEP BOTTLE WITHIN GUIDE !!       | <-- Descriptive Notice Box
|                                             |
|                   +-----+                   |
|                   |     |                   | <-- Static/Dynamic SVG Outline
|                 .-'     '-.                 |     Red/Orange -> Green Transitions
|                 |         |                 |
|                 |         |                 |
|                 |  AFIA   |                 |
|                 |  1.5L   |                 |
|                 |         |                 |
|                 |         |                 |
|                 '-.......-'                 |
|                                             |
|                  [CAPTURE]                  | <-- Dedicated Floating Trigger Action
+---------------------------------------------+

```

### 1. Phased Roadmap

* **Phase 3.1 (Static UI Layout):** Pure responsive SVG layer configured via relative CSS viewports (`vh`/`vw`), centering an outer bottle matrix layout that remains clear of top actions or bottom capture targets.
* **Phase 3.2 (Computer Vision Driven Auto-Capture):** Load WebAssembly-compiled OpenCV routines on a web-worker thread. Continually downsample camera frames, run Canny Edge contours, filter contours by expected vertical-to-horizontal aspect-ratio boxes, and execute a shape comparison using Hu Moments structural invariants via `cv.matchShapes`. If the calculated metric drops below a specific tolerance, change the layout stroke from orange to green and trigger an automated snapshot.

### 2. Open-Source Reference Libraries

* **`opencv/opencv` (WebAssembly builds):** Highly recommended path to pipe raw browser camera frame array pointers directly into optimized native compilation blocks (`cv.findContours`, `cv.matchShapes`).

### 3. Production Code Snippet: OpenCV Shape Invariant Real-time Matcher

```typescript
// Assumes opencv.js (cv) is fully initialized and loaded on the global execution scope
declare const cv: any;

export function evaluateContourMatch(
  sourceCanvas: HTMLCanvasElement, 
  referenceContourMat: any
): { matchFound: boolean; distanceMetric: number } {
  let src = cv.imread(sourceCanvas);
  let dst = new cv.Mat();
  
  // Transform space to handle visual noise variations
  cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
  cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
  cv.Canny(dst, dst, 50, 150, 3, false);

  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let bestMatchDistance = 999.0;
  const toleranceThreshold = 0.22; // Lower represents exact invariant match structural alignment

  for (let i = 0; i < contours.size(); ++i) {
    let contour = contours.get(i);
    // Filter contours via bounding rect check to prevent evaluating arbitrary tiny micro-edges
    let rect = cv.boundingRect(contour);
    const aspect = rect.height / rect.width;
    
    // Afia 1.5L Bottle aspect-ratio constraint checks
    if (aspect > 2.0 && aspect < 4.5 && rect.height > (sourceCanvas.height * 0.4)) {
      // Metric 1 computes structural similarity using log-transformed Hu Moments
      let distance = cv.matchShapes(referenceContourMat, contour, cv.CONTOURS_MATCH_I1, 0);
      if (distance < bestMatchDistance) {
        bestMatchDistance = distance;
      }
    }
    contour.delete();
  }

  // Cleanup native linear memory structures safely
  src.delete(); dst.delete(); contours.delete(); hierarchy.delete();

  return {
    matchFound: bestMatchDistance < toleranceThreshold,
    distanceMetric: bestMatchDistance
  };
}

```

---

## Module 4: Cloudflare Workers Vision Gateway

The execution gateway acts as an API bridge running on Cloudflare edge worker infrastructure. It manages structural key rotation, implements fallback routes across diverse models (Gemini Pro Vision to Grok), logs input vectors, and resolves image upload signature validation logic to Supabase storage buckets.

### 1. Root Cause Resolution: Supabase Storage Signature Malfunctions

When executing within Cloudflare Worker V8 isolation runtimes, using native `btoa` strings or raw Node-based binary parsing parameters inside a multi-part form constructor can result in incorrect content-length calculations or invalid SHA256 signatures when interacting with Supabase Storage. This breaks AWS SigV4 implementation validation layers.

To resolve this, **convert the base64 input string directly into a pure binary standard `ArrayBuffer` typed array structure** using explicit helper utility structures. Avoid passing strings directly to the upload function, and explicitly provide a structured `contentType` parameter configuration.

```
+--------------------------+        +---------------------------+        +--------------------------+
| Cloudflare Worker Context|        | Supabase client-js Storage|        | Supabase Storage API     |
| (Base64 String Payload)  |------->| (Binary ArrayBuffer Data) |------->| (Valid Headers + Payload)|
+--------------------------+        +---------------------------+        +--------------------------+

```

### 2. Production Code Snippet: Cloudflare Worker Orchestrator

```typescript
import { createClient } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEYS: string; // Comma-delimited list of active keys
  GROK_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const payload: { imageBase64: string; targetSku: string; contextMetadata: any } = await request.json();
      const keys = env.GEMINI_API_KEYS.split(',');
      // Basic random key rotation strategy execution index
      const activeGeminiKey = keys[Math.floor(Math.random() * keys.length)];

      // Initialize isolated Supabase Client Engine
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

      // Resolve base64 string to native ArrayBuffer to fix signature verification issues
      const cleanBase64 = payload.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const binaryBuffer = decode(cleanBase64);
      const storageFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.png`;

      // Persist binary payload directly into Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bottle-images')
        .upload(storageFileName, binaryBuffer, {
          contentType: 'image/png',
          upsert: false
        });

      if (uploadError) {
        return new Response(JSON.stringify({ error: `Supabase Storage Malfunction: ${uploadError.message}` }), { status: 500 });
      }

      // Execute Vision Core Pipeline Analysis with Fallback Matrix
      let analysisResult = null;
      let usedFallback = false;

      try {
        analysisResult = await callGeminiVisionAPI(activeGeminiKey, cleanBase64, payload.targetSku);
      } catch (geminiError) {
        console.warn("Primary Gemini Route compromised, falling back onto Grok Vision Engine Platform...", geminiError);
        analysisResult = await callGrokVisionAPI(env.GROK_API_KEY, cleanBase64, payload.targetSku);
        usedFallback = true;
      }

      // Write parsed analytical provenance data back into Supabase PostgreSQL
      const { data: dbRow, error: dbError } = await supabase
        .from('scan_records')
        .insert([{
          image_path: storageFileName,
          detected_oil_level_percentage: analysisResult.oilLevelPercentage,
          remaining_volume_ml: analysisResult.remainingMl,
          consumed_volume_ml: analysisResult.consumedMl,
          model_provenance: usedFallback ? 'GROK_VISION' : 'GEMINI_PRO_VISION',
          raw_json_response: analysisResult,
          metadata: payload.contextMetadata
        }])
        .select()
        .single();

      if (dbError) {
        return new Response(JSON.stringify({ error: `Database Transaction Aborted: ${dbError.message}` }), { status: 500 });
      }

      return new Response(JSON.stringify({ success: true, record: dbRow }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (globalErr: any) {
      return new Response(JSON.stringify({ error: globalErr.message }), { status: 500 });
    }
  }
};

async function callGeminiVisionAPI(apiKey: string, base64Image: string, sku: string): Promise<any> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: `Analyze this image of an Afia 1.5L oil bottle. Return JSON format with fields: oilLevelPercentage (0-100), remainingMl, consumedMl. Determine exact fill line location accurately.` },
          { inlineData: { mimeType: "image/png", data: base64Image } }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  if (!response.ok) throw new Error(`Gemini remote returned bad status: ${response.status}`);
  const json: any = await response.json();
  return JSON.parse(json.candidates[0].content.parts[0].text);
}

async function callGrokVisionAPI(apiKey: string, base64Image: string, sku: string): Promise<any> {
  // Simulates downstream standard OpenAPI execution pattern architecture implementation for Grok Vision API
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "grok-vision-beta",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Return valid JSON containing keys: oilLevelPercentage, remainingMl, consumedMl for this Afia cooking oil bottle." },
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    })
  });
  
  if (!response.ok) throw new Error(`Grok API execution rejected: ${response.status}`);
  const resData: any = await response.json();
  return JSON.parse(resData.choices[0].message.content);
}

```

---

## Module 5: Token Optimization & Prompt Engineering

To maximize the visual performance of the Gemini model while minimizing token costs, input payloads must conform to the model's precise layout handling specifications.

### 1. Gemini Core Image Tiling Mechanism

Gemini vision systems parse images based on dimensions and resolution thresholds:

* Images that fit within a $384 \times 384$ pixel bounding canvas are processed natively using a base cost of **258 tokens**.
* Images exceeding those dimensions are downscaled or divided into non-overlapping $768 \times 768$ pixel patches. Each individual patch scales processing costs up by **258 tokens**, plus an addition of **106 tokens** for global layout context mapping.

```
+-----------------------+      +-----------+-----------+
|  Standard Small Image |      |  Tile 1   |  Tile 2   |
|     (<= 384x384)      |      | (768x768) | (768x768) |
|                       |      +-----------+-----------+
|      258 Tokens       |      |  Tile 3   |  Tile 4   |
+-----------------------+      | (768x768) | (768x768) |
                               +-----------+-----------+
                                Large High-Res Grid Matrix
                                (258 per tile) + 106 tokens

```

### 2. High-Efficiency Stitching System

Instead of presenting distinct multi-page example images during few-shot prompt construction (which scales the token count multi-linearly with each separate file added), **stitch few-shot baseline visual references and reference cross-sections into an isolated layout grid matrix on a single canvas element**. This ensures the combined assets are parsed as a single tiled object layout, reducing token consumption.

### 3. Structural Prompt System

The prompt system must enforce strict output constraints. It provides explicit structural metadata describing the physical proportions of the bottle, instructing the model to generate structured JSON output.

#### Production Optimization Prompt Definition

```
You are a high-precision computer vision analysis layer calibrated exclusively for Afia 1.5 Litre structural cooking oil bottles.
The total capacity is 1500ml. The height of the fluid payload chamber corresponds to specific vertical markers on the container.

CRITICAL INSTRUCTIONS:
1. Locate the physical boundary lines of the translucent plastic bottle. Disregard background elements or illumination reflections.
2. Determine the exact top boundary line of the current liquid payload. Identify the meniscus profile interface.
3. Compute the current volume level percentage from the absolute bottom base (0%) to the top structural fill neck line (100%).
4. Convert this percentage directly into operational volume parameters where:
   - Remaining Volume (ml) = 1500 * (percentage / 100)
   - Consumed Volume (ml) = 1500 - Remaining Volume (ml)

You must output a single, tightly-formed JSON document that matches this TypeScript definition format exactly, without markdown indicators or extra text wrappers:
{
  "oilLevelPercentage": number, // Continuous scale float value from 0.00 to 100.00
  "remainingMl": number,        // Scalar volume measurement rounded to the nearest integer
  "consumedMl": number,         // Scalar volume measurement rounded to the nearest integer
  "confidenceScore": number     // Internal estimation metric rating between 0.0 and 1.0
}

```

---

## Module 6: Stage 2 Browser Edge Inference (ONNX Transformation Framework)

To transition from costly server-side LLM dependencies (Stage 1) to direct execution on the client device (Stage 2), developers can build an on-device inference pipeline using **Ultralytics YOLOv8/v11 Instance Segmentation** compiled to an ONNX model file.

### 1. Training & Export Sequence

1. Assemble the Stage 1 database containing verified client image submissions and curated high-resolution video frames. Use automated tools to augment the data (applying random illumination variations, perspective rotations, and scale adjustments).
2. Segment the imagery dataset inside annotation tooling (such as Roboflow or CVAT), assigning two distinct target classes:
* Class `0`: `bottle_contour` (The outer structural boundary of the bottle).
* Class `1`: `oil_mass` (The actual mass volume profile of the internal fluid).


3. Train an Ultralytics segmentation model (`yolov8n-seg.pt` or `yolov11n-seg.pt`) using PyTorch framework execution targets.
4. Export the resulting model weights using the built-in export utility:
```python
from ultralytics import YOLO
model = YOLO("afia_segmentation_model.pt")
model.export(format="onnx", imgsz=[640, 640], optimize=True, int8=True)

```



### 2. Browser Execution Engine (`onnxruntime-web`)

The client application loads the compiled `model.onnx` file using `onnxruntime-web`. It processes frame tensors via WebGL execution textures or WebAssembly SIMD parameters, avoiding network latency or cloud processing costs.

```
+--------------------+      +-----------------------+      +-------------------------+
| Captured Video     |      | ONNX Runtime Web      |      | Post-Processing Block   |
| Frame Canvas Data  |----->| (YOLO Segmentation)   |----->| Intersect Column Pixels |
| (640x640 Tensor)   |      | WebGL / WASM SIMD     |      | Map Pixels to Volume    |
+--------------------+      +-----------------------+      +-------------------------+

```

### 3. Production Code Snippet: Client Edge ONNX Inference Framework

```typescript
import * as ort from 'onnxruntime-web';

export class EdgeInferenceEngine {
  private session: ort.InferenceSession | null = null;
  const modelImgSize = 640;

  async loadModel(modelUrl: string): Promise<void> {
    // Configured to initialize utilizing local hardware acceleration primitives
    this.session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['webgl', 'wasm'],
      graphOptimizationLevel: 'all'
    });
  }

  async predictLiquidLevel(canvasFrame: HTMLCanvasElement): Promise<{ oilPercentage: number }> {
    if (!this.session) throw new Error("Inference engine execution requested before model assembly completed.");

    // Resample viewport layout directly to 640x640x3 Float32 structured tensors
    const tensorInput = this.preprocessCanvasToTensor(canvasFrame);

    const feeds: Record<string, ort.Tensor> = {};
    feeds[this.session.inputNames[0]] = tensorInput;

    // Run inference inside the local engine environment
    const outputs = await this.session.run(feeds);
    
    // Outputs generally contain boxes matrix array along with calculated mask segmentations
    const outputTensor = outputs[this.session.outputNames[0]];
    
    return this.postProcessSegmentationMasks(outputTensor, canvasFrame.width, canvasFrame.height);
  }

  private preprocessCanvasToTensor(canvas: HTMLCanvasElement): ort.Tensor {
    const ctx = canvas.getContext('2d');
    const size = this.modelImgSize;
    
    // Create an offscreen buffer to normalize the input dimensions
    const offscreen = document.createElement('canvas');
    offscreen.width = size; offscreen.height = size;
    const oCtx = offscreen.getContext('2d');
    oCtx?.drawImage(canvas, 0, 0, size, size);

    const imgData = oCtx!.getImageData(0, 0, size, size);
    const data = imgData.data;

    const float32Buffer = new Float32Array(3 * size * size);

    // Channel-stride allocation optimization parsing blocks (RGB normalized formats)
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      const r = data[i] / 255.0;
      const g = data[i + 1] / 255.0;
      const b = data[i + 2] / 255.0;

      // Planar formatting extraction array maps [R, R, R... G, G, G... B, B, B]
      float32Buffer[idx] = r;
      float32Buffer[idx + (size * size)] = g;
      float32Buffer[idx + (2 * size * size)] = b;
    }

    return new ort.Tensor('float32', float32Buffer, [1, 3, size, size]);
  }

  private postProcessSegmentationMasks(outputTensor: ort.Tensor, origW: number, origH: number): { oilPercentage: number } {
    // Parsing operations vary depending on the specific output configuration of YOLOv8/v11-seg.
    // This template demonstrates calculating volume proportions by analyzing pixel ratios.
    
    // 1. Extract the binary masks for the bottle container and the fluid mass.
    // 2. Scan the central column coordinates of the mask matrices vertically.
    // 3. Compute the ratio of the fluid mask's vertical height to the overall container bounding box:
    //    Ratio = Fluid Height Pixels / Container Height Pixels
    
    let hypotheticalCalculatedPercentage = 74.5; 
    return { oilPercentage: hypotheticalCalculatedPercentage };
  }
}

```

---

## Module 7: Volumetric Gauge Slider UI & Animated Liquid Visualization

After processing the analysis payload, the system displays the image with an adjustable vertical slider superimposed on the container's left border. The slider's initial position snaps to the fluid fill-line returned by the model.

Users can manually refine this volume measurement using thumb adjustments. The slider increments in **55ml steps** (the volume of an average 1/4 tea cup).

```
          SLIDER UX STRUCTURE                 DYNAMIC VISUAL LIQUID FILL CUP
     +---------------------------+              +--------------------------+
     | Max Capacity (1500ml)     |              |                          |
     | [ ]  <- Upper Limit       |              |   ~~~~~~~~~~~~~~~~~~~~   | <-- SVG Wave
     |  |                        |              |   |                  |   |     Dynamic Height
     | [O]  <- Drag Thumb        | ------------>|   |    1 1/4 Cups    |   |     Linked via
     |  |      (55ml increments) |              |   \                  /   |     ClipPath State
     | [ ]  <- Lower Base        |              |    '................'    |
     +---------------------------+              +--------------------------+

```

### 1. UX State Machine Mapping

* **Total Capacity:** 1500ml.
* **Step Size Constraints:** Each physical incremental adjustment corresponds to 55ml.
* **Total Steps Matrix Calculation:** $1500 / 55 = 27.27$ discrete step adjustments.
* **Display Logic:** Adjust adjustments to match fractions of a standard tea cup. A remaining capacity of 110ml renders as exactly `1/2 Cup`. A volume measurement of 275ml maps directly to `1 1/4 Cups`. If the remaining volume falls below 55ml, the control handle snaps cleanly to the final baseline step indicator.

### 2. Open-Source Reference Libraries

* **`framer-motion`:** High-performance animation toolkit for React. Ideal for executing smooth, physics-based transitions on liquid container paths when steps change.
* **`react-use-gesture` / `@use-gesture/react`:** Standard unified gesture parsing hooks. Ensures consistent touch interaction and prevents thumb-sliding bugs on mobile web browsers.

### 3. Production Code Snippet: Unified Interactive Slider & Liquid Fluid Cup Gauge

```tsx
import React, { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface VolumetricGaugeProps {
  initialRemainingMl: number; // The initial value returned from the vision AI endpoint
  onCorrectionSubmit: (finalMl: number) => void;
}

export const VolumetricGauge: React.FC<VolumetricGaugeProps> = ({ initialRemainingMl, onCorrectionSubmit }) => {
  const TOTAL_CAPACITY = 1500;
  const ML_PER_STEP = 55;
  
  // Calculate nearest initial discrete step configuration metric
  const initialStep = Math.round(initialRemainingMl / ML_PER_STEP);
  const [currentStep, setCurrentStep] = useState<number>(initialStep);

  const currentVolumeMl = currentStep * ML_PER_STEP;
  const totalCupsDecimal = currentVolumeMl / (ML_PER_STEP * 4); // 4 steps make up 1 full functional cup element

  // Formats text indicators to match fractional cup specifications
  const formatCupText = (totalSteps: number): string => {
    const cupsCount = Math.floor(totalSteps / 4);
    const remainderStep = totalSteps % 4;
    
    let fractionStr = '';
    if (remainderStep === 1) fractionStr = '1/4';
    if (remainderStep === 2) fractionStr = '1/2';
    if (remainderStep === 3) fractionStr = '3/4';

    if (cupsCount === 0) {
      return fractionStr ? `${fractionStr} Cup` : '0 Cups (Empty)';
    }
    return fractionStr ? `${cupsCount} ${fractionStr} Cups` : `${cupsCount} ${cupsCount === 1 ? 'Cup' : 'Cups'}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentStep(Number(e.target.value));
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-around p-6 bg-slate-900 rounded-3xl shadow-xl max-w-xl mx-auto border border-slate-800">
      
      {/* Module Left: Interactive Vertical Core Input Component */}
      <div className="flex items-center gap-6 h-72">
        <span className="text-xs font-mono text-slate-400 tracking-wider transform -rotate-90 origin-left">VOLUME INPUT</span>
        <div className="relative h-full flex items-center">
          <input
            type="range"
            min="0"
            max={Math.floor(TOTAL_CAPACITY / ML_PER_STEP)}
            value={currentStep}
            onChange={handleSliderChange}
            className="vertical-slider appearance-none w-3 h-full bg-slate-800 rounded-full outline-none border border-slate-700 cursor-pointer"
            style={{ WebkitAppearance: 'slider-vertical', writingMode: 'bt-lr' } as any}
          />
        </div>
        <div className="flex flex-col justify-between h-full py-1 text-sm font-mono text-slate-300">
          <div>Max: {TOTAL_CAPACITY}ml</div>
          <div className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/50">
            Selected: {currentVolumeMl}ml
          </div>
          <div>Min: 0ml</div>
        </div>
      </div>

      {/* Module Right: Liquid Wave Render Area Visualizer Gauge */}
      <div className="flex flex-col items-center gap-4 mt-6 md:mt-0">
        <div className="relative w-36 h-48 bg-slate-800/50 border border-slate-700 rounded-b-3xl rounded-t-lg overflow-hidden shadow-inner">
          
          {/* Dynamic SVG Liquid Filling Layer Engine Mask */}
          <motion.div 
            className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-amber-600 to-yellow-400"
            initial={{ height: `${(initialStep * ML_PER_STEP / TOTAL_CAPACITY) * 100}%` }}
            animate={{ height: `${(currentVolumeMl / TOTAL_CAPACITY) * 100}%` }}
            transition={{ type: 'spring', stiffness: 70, damping: 15 }}
          >
            {/* Wave Overlay Design Component Using Pure Inline SVG Vectors */}
            <svg className="absolute -top-3 left-0 w-full h-4 fill-yellow-400 animate-pulse" viewBox="0 0 100 20" preserveAspectRatio="none">
              <path d="M0,10 C30,20 70,0 100,10 L100,20 L0,20 Z" />
            </svg>
          </motion.div>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 z-10 pointer-events-none">
            <span className="text-2xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {formatCupText(currentStep)}
            </span>
            <span className="text-xs font-medium text-slate-200 uppercase tracking-widest mt-1 drop-shadow">
              Consumed
            </span>
          </div>

        </div>

        <button 
          onClick={() => onCorrectionSubmit(currentVolumeMl)}
          className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg transform active:scale-95 transition-all text-sm tracking-wide"
        >
          Confirm Volume Level Record
        </button>
      </div>

    </div>
  );
};

```

---

## Complete Project Implementation Blueprint

This master roadmap outlines the structured transition from the Stage 1 architecture to the self-contained local deployment of Stage 2.

### Phase 1: Infrastructure Integration & Quality Gates (Weeks 1-2)

* Deploy the Cloudflare Workers proxy structure. Fix image signature bugs by parsing binary arrays with the `base64-arraybuffer` package.
* Integrate client-side pre-flight quality checks (`analyzeFrameQuality`) directly into the UI snapshot tool to ensure poor frames fail fast.
* Build the responsive SVG container target outline. Apply clean typography bounds to avoid overlapping language and theme configuration buttons.

### Phase 2: Live Core Optimization & Key Management (Weeks 3-4)

* Implement standard multi-key rotation structures for Gemini API endpoints on the worker proxy layer. Include automated fallback mechanisms that route directly to alternative vision systems (such as Grok) on exceptions.
* Optimize visual tokens. Consolidate example frames into a stitched offscreen layout grid before processing to reduce context token consumption.
* Launch the Admin Dashboard workspace. This interface enables real-time verification tracking, raw record reviews, manual telemetry entry updates, and precise performance metrics monitoring.

### Phase 3: Transitioning to Client Inference (Stage 2 Integration) (Weeks 5-8)

* Export the data rows from the Stage 1 verification database to build an annotated computer vision dataset. Use image augmentation techniques to expand the dataset across diverse illumination and perspective parameters.
* Train an optimized instance segmentation model (YOLOv8/11-seg) using a PyTorch pipeline. Export the trained architecture into an optimized INT8-quantized ONNX runtime configuration.
* Integrate `onnxruntime-web` into the client browser application to process visual frame inputs locally via WebGL/WASM execution threads. Configure the server-side API as a dynamic fallback mechanism if on-device model confidence drops below acceptable thresholds.