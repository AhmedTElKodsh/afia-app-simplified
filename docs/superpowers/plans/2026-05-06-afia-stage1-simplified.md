# Afia Oil Level — Stage 1 (Eval-Only Spike) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate the Gemini ml-prediction pipeline against a sealed ground-truth fixture set. Stage 1 is a research spike, not a deployable app. Its sole purpose is to answer: *does Gemini predict remaining oil ml on real Afia 1.5L bottle images well enough to fund Stage 2 UX investment?*

**Architecture:**
- pnpm monorepo with **one package** in Stage 1: `worker/` (Node CLI runtime — Cloudflare deploy is Stage 2). Plus `packages/shared/` for types.
- No web app, no HTTP endpoint, no deployment in Stage 1.
- Gemini called from a CLI eval runner. Single API key. `temperature=0`. Structured JSON output via response schema.
- Ground truth = fixture folder name (e.g. `oil-bottle-frames/770ml/*.jpg` → 770ml). Comparator: predicted ml within ±55ml of ground truth = pass (one quarter-cup tolerance).

**Tech Stack:**
- Node 20 + TypeScript (CLI runtime; no Workers runtime needed in Stage 1)
- `@google/generative-ai` SDK (single key)
- Vitest for unit tests
- Zod for response validation
- pnpm workspace

**Kill Condition (Stage 1 done when ALL of):**
- 40 sealed holdout fixtures: ≥90% predictions within ±55ml of ground truth
- ≥80% accuracy on every individual stratum (anti-gaming)
- Byte-stable JSONL on ≥38/40 across 3 runs at `temperature=0`
- Versioned prompt + few-shots + comparator committed at tagged SHA
- Domain reviewer sign-off recorded in `runs/signoffs.jsonl`

**Out of scope for Stage 1 (deferred to Stage 2):**
- React/Vite SPA, i18n, theme, scan landing, camera capture, bottle outline, result page, slider, cup counter
- Cloudflare Worker HTTP API, Static Assets binding, deployment
- Supabase persistence, admin review queue, corrections, manual upload
- Grok fallback, multi-key Gemini rotation
- 2.5L bottle support
- Local on-device model

**Fixture Data (already on disk):**
- `oil-bottle-frames/<ml>ml/*.jpg` — real video-frame extractions, 28 ml-levels in 55ml steps from 55ml to 1500ml, ~41 frames per level
- `oil-bottle-augmented/<ml>ml/*.jpg` — AI-augmented variants, 28 levels + `empty/`, ~533 frames per level
- `oil-bottle-frames/1.5L_refs/` — clean reference shots (1500/750/55/empty)

---

## File Structure

```
afia-app-simplified/
├── package.json                            # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore                              # adds /runs/*.jsonl
├── packages/
│   └── shared/
│       ├── package.json
│       └── src/
│           ├── index.ts
│           ├── bottle.ts                   # BOTTLE_1_5L constants
│           └── types.ts                    # AnalysisResult + run-record shape
├── worker/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── env.ts                          # Env loader (dotenv)
│   │   ├── prompt/
│   │   │   ├── load.ts                     # loads + hashes prompt + few-shots
│   │   │   └── v1/
│   │   │       ├── system.md
│   │   │       ├── bottle-reference.md
│   │   │       └── few-shots/
│   │   │           ├── full-1500.json
│   │   │           ├── mid-770.json
│   │   │           └── empty.json
│   │   ├── llm/
│   │   │   ├── gemini.ts                   # single-key, temp=0, responseSchema
│   │   │   └── analyze.ts                  # analyzeFixture(imagePath, env)
│   │   └── eval/
│   │       ├── compare.ts                  # ±55ml exact-bucket comparator
│   │       ├── parse-response.ts           # Zod parser
│   │       ├── manifest.ts                 # sampler + seal logic
│   │       ├── run.ts                      # CLI entry: eval:dev / eval:holdout
│   │       ├── jsonl.ts                    # run-record writer
│   │       └── signoff.ts                  # reviewer gate CLI
│   └── test/
│       ├── compare.test.ts
│       ├── parse-response.test.ts
│       ├── manifest.test.ts
│       └── fixtures/
│           ├── dev/manifest.json           # 60 fixtures (committed)
│           └── holdout/manifest.json       # 40 fixtures sealed (committed)
├── runs/                                   # JSONL outputs (gitignored except .gitkeep)
│   ├── .gitkeep
│   └── signoffs.jsonl                      # reviewer decisions
├── oil-bottle-frames/                      # existing — read-only fixture source
└── oil-bottle-augmented/                   # existing — read-only fixture source
```

**Why this layout:** Stage 1 is a Node CLI. Workers runtime is Stage 2. Prompt and few-shots live as files (not inline strings) so they can be hashed and the eval is reproducible. The `runs/` directory is gitignored content with checked-in `.gitkeep` and `signoffs.jsonl` (sign-offs are durable; raw eval JSONL rotates).

---

## Task 1: Monorepo + worker package skeleton (Node CLI, no SPA)

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/vitest.config.ts`, `worker/src/env.ts`
- Create: `packages/shared/package.json`, `packages/shared/src/{index,bottle,types}.ts`
- Create: `worker/test/smoke.test.ts`

- [ ] **Step 1: Workspace root**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "worker"
  - "packages/*"
```

`package.json`:
```json
{
  "name": "afia-app-simplified",
  "private": true,
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "eval:dev": "pnpm --filter worker eval:dev",
    "eval:holdout": "pnpm --filter worker eval:holdout",
    "signoff": "pnpm --filter worker signoff"
  },
  "devDependencies": {
    "typescript": "5.6.3",
    "@types/node": "22.9.0"
  },
  "packageManager": "pnpm@9.12.3"
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

`.gitignore` (append):
```
node_modules
runs/*.jsonl
!runs/.gitkeep
!runs/signoffs.jsonl
.env
.env.local
```

- [ ] **Step 2: `packages/shared`**

`packages/shared/package.json`:
```json
{
  "name": "@afia/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`packages/shared/src/bottle.ts`:
```ts
export const BOTTLE_1_5L = {
  size: "1.5L" as const,
  capacityMl: 1500,
  fillTopY: 0.18,
  fillBottomY: 0.96,
} as const;

export const ML_PER_CUP_QUARTER = 55;
export const EXACT_TOLERANCE_ML = 55;   // ±55ml = quarter cup = "exact bucket"
export const CLOSE_TOLERANCE_ML = 110;  // ±110ml = "close"
```

`packages/shared/src/types.ts`:
```ts
export interface AnalysisResult {
  remainingMl: number;
  consumedMl: number;
  redLineYRatio: number;
  confidence: number;
  rawModelText: string;
  promptHash: string;
  fewshotHash: string;
  modelId: string;
}

export interface RunRecord {
  runId: string;
  runStartedTs: string;       // ISO
  promptHash: string;
  fewshotHash: string;
  modelId: string;
  modelVersion: string;
  imageId: string;            // relative path under fixtures/source dir
  imagePath: string;
  stratum: string;            // "real|aug:fillBucket:frameBucket"
  groundTruthMl: number;
  rawOutput: string;
  parsedMl: number | null;
  parsedConfidence: number | null;
  absErrorMl: number | null;
  exactBucketPass: boolean;
  closeBucketPass: boolean;
  comparatorName: string;
  comparatorVersion: string;
  holdoutTouches: number;     // 0 for dev runs; ≥1 for holdout
}
```

`packages/shared/src/index.ts`:
```ts
export * from "./bottle.js";
export * from "./types.js";
```

- [ ] **Step 3: Worker package (Node CLI)**

`worker/package.json`:
```json
{
  "name": "worker",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json --noEmit",
    "eval:dev": "tsx src/eval/run.ts --set=dev",
    "eval:holdout": "tsx src/eval/run.ts --set=holdout",
    "signoff": "tsx src/eval/signoff.ts"
  },
  "dependencies": {
    "@google/generative-ai": "0.21.0",
    "@afia/shared": "workspace:*",
    "zod": "3.23.8",
    "dotenv": "16.4.5"
  },
  "devDependencies": {
    "tsx": "4.19.2",
    "vitest": "2.1.4",
    "typescript": "5.6.3",
    "@types/node": "22.9.0"
  }
}
```

`worker/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src/**/*", "test/**/*"]
}
```

`worker/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
```

`worker/src/env.ts`:
```ts
import "dotenv/config";

export interface Env {
  GEMINI_API_KEY: string;
  MODEL_ID: string;
}

export function loadEnv(): Env {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing — set in .env or shell");
  return {
    GEMINI_API_KEY: key,
    MODEL_ID: process.env.MODEL_ID ?? "gemini-2.5-flash",
  };
}
```

- [ ] **Step 4: Smoke test**

`worker/test/smoke.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { BOTTLE_1_5L, EXACT_TOLERANCE_ML } from "@afia/shared";

describe("smoke", () => {
  it("shared package exports constants", () => {
    expect(BOTTLE_1_5L.capacityMl).toBe(1500);
    expect(EXACT_TOLERANCE_ML).toBe(55);
  });
});
```

- [ ] **Step 5: Install + verify**

```bash
pnpm install
pnpm --filter worker test
```
Expected: smoke test passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(stage1): bootstrap worker CLI + shared package (eval-only spike)"
```

---

## Task 2: Versioned prompt + few-shots, hashable

**Files:**
- Create: `worker/src/prompt/v1/system.md`, `worker/src/prompt/v1/bottle-reference.md`
- Create: `worker/src/prompt/v1/few-shots/{full-1500,mid-770,empty}.json`
- Create: `worker/src/prompt/load.ts`
- Test: `worker/test/prompt-load.test.ts`

- [ ] **Step 1: Failing test**

`worker/test/prompt-load.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { loadPrompt } from "../src/prompt/load.js";

describe("loadPrompt", () => {
  it("returns text + stable hashes for v1", async () => {
    const { systemText, userText, fewShots, promptHash, fewshotHash } = await loadPrompt("v1");
    expect(systemText.length).toBeGreaterThan(0);
    expect(userText.length).toBeGreaterThan(0);
    expect(fewShots.length).toBeGreaterThanOrEqual(3);
    expect(promptHash).toMatch(/^[a-f0-9]{16}$/);
    expect(fewshotHash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("hashes are deterministic", async () => {
    const a = await loadPrompt("v1");
    const b = await loadPrompt("v1");
    expect(a.promptHash).toBe(b.promptHash);
    expect(a.fewshotHash).toBe(b.fewshotHash);
  });
});
```

- [ ] **Step 2: Create prompt assets**

`worker/src/prompt/v1/system.md`:
```md
You are a precise image analysis assistant. You measure the remaining cooking oil
in a 1.5L Afia bottle from a single photograph. You respond ONLY with valid JSON
matching the provided schema. No prose. No markdown fences.
```

`worker/src/prompt/v1/bottle-reference.md`:
```md
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
be ≥0.85. Lower it for occlusion, glare, blur, extreme tilt, or partial framing.
```

`worker/src/prompt/v1/few-shots/full-1500.json`:
```json
{
  "imagePath": "oil-bottle-frames/1.5L_refs/1500ml.jpg",
  "expected": { "remainingMl": 1500, "consumedMl": 0, "redLineYRatio": 0.18, "confidence": 0.95 }
}
```

`worker/src/prompt/v1/few-shots/mid-770.json`:
```json
{
  "imagePath": "oil-bottle-frames/1.5L_refs/750ml.jpg",
  "expected": { "remainingMl": 750, "consumedMl": 750, "redLineYRatio": 0.57, "confidence": 0.9 }
}
```

`worker/src/prompt/v1/few-shots/empty.json`:
```json
{
  "imagePath": "oil-bottle-frames/1.5L_refs/empty.jpg",
  "expected": { "remainingMl": 0, "consumedMl": 1500, "redLineYRatio": 0.96, "confidence": 0.95 }
}
```

- [ ] **Step 3: Implement loader**

`worker/src/prompt/load.ts`:
```ts
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface FewShot {
  imagePath: string;
  expected: { remainingMl: number; consumedMl: number; redLineYRatio: number; confidence: number };
}

export interface LoadedPrompt {
  systemText: string;
  userText: string;
  fewShots: FewShot[];
  promptHash: string;
  fewshotHash: string;
  promptVersion: string;
}

function hash16(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export async function loadPrompt(version: string): Promise<LoadedPrompt> {
  const root = join(__dirname, version);
  const systemText = await readFile(join(root, "system.md"), "utf8");
  const userText = await readFile(join(root, "bottle-reference.md"), "utf8");
  const fewshotDir = join(root, "few-shots");
  const files = (await readdir(fewshotDir)).filter((f) => f.endsWith(".json")).sort();
  const fewShots: FewShot[] = [];
  for (const f of files) fewShots.push(JSON.parse(await readFile(join(fewshotDir, f), "utf8")));
  return {
    systemText,
    userText,
    fewShots,
    promptHash: hash16(systemText + "\n---\n" + userText),
    fewshotHash: hash16(JSON.stringify(fewShots)),
    promptVersion: version,
  };
}
```

- [ ] **Step 4: Run test** — `pnpm --filter worker test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(prompt): versioned v1 system + reference + few-shots with stable hashing"
```

---

## Task 3: Response parser + comparator (committed BEFORE scoring)

**Files:**
- Create: `worker/src/eval/parse-response.ts`, `worker/src/eval/compare.ts`
- Test: `worker/test/parse-response.test.ts`, `worker/test/compare.test.ts`

**Critical:** This task must land BEFORE any holdout fixtures are scored. Comparator semantics frozen here are what the kill condition is measured against.

- [ ] **Step 1: Failing tests**

`worker/test/parse-response.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseAnalysisResponse } from "../src/eval/parse-response.js";

describe("parseAnalysisResponse", () => {
  it("parses valid JSON", () => {
    const r = parseAnalysisResponse(`{"remainingMl":800,"consumedMl":700,"redLineYRatio":0.47,"confidence":0.92}`);
    expect(r.remainingMl).toBe(800);
  });
  it("strips ```json fences", () => {
    const r = parseAnalysisResponse("```json\n{\"remainingMl\":800,\"consumedMl\":700,\"redLineYRatio\":0.47,\"confidence\":0.92}\n```");
    expect(r.remainingMl).toBe(800);
  });
  it("clamps redLineYRatio to 0..1", () => {
    const r = parseAnalysisResponse(`{"remainingMl":800,"consumedMl":700,"redLineYRatio":1.5,"confidence":0.9}`);
    expect(r.redLineYRatio).toBe(1);
  });
  it("clamps ml to 0..1500", () => {
    const r = parseAnalysisResponse(`{"remainingMl":-50,"consumedMl":1700,"redLineYRatio":0.1,"confidence":0.8}`);
    expect(r.remainingMl).toBe(0);
    expect(r.consumedMl).toBe(1500);
  });
  it("throws on missing fields", () => {
    expect(() => parseAnalysisResponse(`{"remainingMl":800}`)).toThrow();
  });
  it("throws on non-JSON", () => {
    expect(() => parseAnalysisResponse("not json")).toThrow();
  });
});
```

`worker/test/compare.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { compareMl, COMPARATOR_NAME, COMPARATOR_VERSION } from "../src/eval/compare.js";

describe("compareMl (±55ml exact, ±110ml close)", () => {
  it("exact when within ±55ml", () => {
    expect(compareMl(770, 770)).toEqual({ absErrorMl: 0, exactBucketPass: true, closeBucketPass: true });
    expect(compareMl(770, 825)).toEqual({ absErrorMl: 55, exactBucketPass: true, closeBucketPass: true });
    expect(compareMl(770, 715)).toEqual({ absErrorMl: 55, exactBucketPass: true, closeBucketPass: true });
  });
  it("close but not exact at >55..≤110ml", () => {
    expect(compareMl(770, 880)).toEqual({ absErrorMl: 110, exactBucketPass: false, closeBucketPass: true });
  });
  it("miss at >110ml", () => {
    expect(compareMl(770, 1000)).toEqual({ absErrorMl: 230, exactBucketPass: false, closeBucketPass: false });
  });
  it("identifies itself", () => {
    expect(COMPARATOR_NAME).toBe("ml-bucket-tolerance");
    expect(COMPARATOR_VERSION).toBe("1.0.0");
  });
});
```

- [ ] **Step 2: Implement parser**

`worker/src/eval/parse-response.ts`:
```ts
import { z } from "zod";

const Schema = z.object({
  remainingMl: z.number(),
  consumedMl: z.number(),
  redLineYRatio: z.number(),
  confidence: z.number(),
});

export function parseAnalysisResponse(raw: string) {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); }
  catch (e) { throw new Error(`LLM response not JSON: ${(e as Error).message}`); }
  const v = Schema.parse(parsed);
  return {
    remainingMl: clamp(v.remainingMl, 0, 1500),
    consumedMl: clamp(v.consumedMl, 0, 1500),
    redLineYRatio: clamp(v.redLineYRatio, 0, 1),
    confidence: clamp(v.confidence, 0, 1),
  };
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
```

- [ ] **Step 3: Implement comparator**

`worker/src/eval/compare.ts`:
```ts
import { EXACT_TOLERANCE_ML, CLOSE_TOLERANCE_ML } from "@afia/shared";

export const COMPARATOR_NAME = "ml-bucket-tolerance";
export const COMPARATOR_VERSION = "1.0.0";

export function compareMl(predicted: number, groundTruth: number) {
  const absErrorMl = Math.abs(predicted - groundTruth);
  return {
    absErrorMl,
    exactBucketPass: absErrorMl <= EXACT_TOLERANCE_ML,
    closeBucketPass: absErrorMl <= CLOSE_TOLERANCE_ML,
  };
}
```

- [ ] **Step 4: Run tests** — `pnpm --filter worker test` — Expected: PASS.

- [ ] **Step 5: Commit (THIS IS THE COMPARATOR-FREEZE COMMIT)**

```bash
git add -A
git commit -m "feat(eval): freeze parser + ±55ml comparator (kill-condition reference v1.0.0)"
git tag eval/comparator-v1.0.0
```

---

## Task 4: Gemini client (single key, temp=0, response schema)

**Files:**
- Create: `worker/src/llm/gemini.ts`
- Test: `worker/test/gemini.test.ts` (mocked)

- [ ] **Step 1: Failing test (mocked SDK)**

`worker/test/gemini.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@google/generative-ai", () => {
  const generateContent = vi.fn(async () => ({
    response: { text: () => `{"remainingMl":770,"consumedMl":730,"redLineYRatio":0.57,"confidence":0.9}` },
  }));
  return {
    GoogleGenerativeAI: vi.fn(() => ({ getGenerativeModel: vi.fn(() => ({ generateContent })) })),
  };
});

import { callGemini } from "../src/llm/gemini.js";

describe("callGemini", () => {
  it("returns raw text from SDK", async () => {
    const text = await callGemini({
      apiKey: "test", modelId: "gemini-2.5-flash",
      systemText: "sys", userText: "user", fewShots: [], imageBase64: "abc",
    });
    expect(text).toContain("770");
  });
});
```

- [ ] **Step 2: Implement**

`worker/src/llm/gemini.ts`:
```ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { FewShot } from "../prompt/load.js";

interface CallArgs {
  apiKey: string;
  modelId: string;
  systemText: string;
  userText: string;
  fewShots: FewShot[];
  imageBase64: string;
}

export async function callGemini(args: CallArgs): Promise<string> {
  const client = new GoogleGenerativeAI(args.apiKey);
  const model = client.getGenerativeModel({
    model: args.modelId,
    systemInstruction: args.systemText,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          remainingMl: { type: SchemaType.NUMBER },
          consumedMl: { type: SchemaType.NUMBER },
          redLineYRatio: { type: SchemaType.NUMBER },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["remainingMl", "consumedMl", "redLineYRatio", "confidence"],
      },
    },
  });

  const fewShotText = args.fewShots
    .map((fs, i) => `Example ${i + 1} (image ${fs.imagePath}): ${JSON.stringify(fs.expected)}`)
    .join("\n");

  const result = await model.generateContent([
    { text: `${args.userText}\n\nFew-shot examples (label only, not images):\n${fewShotText}` },
    { inlineData: { mimeType: "image/jpeg", data: args.imageBase64 } },
  ]);
  return result.response.text();
}
```

> **Note on few-shots:** v1 passes few-shot expected outputs as text-only labels rather than re-uploading the example images. This is a deliberate cost/latency choice for v1. If holdout accuracy underperforms, the v2 prompt iteration may add image few-shots and re-hash.

- [ ] **Step 3: Run test** — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(llm): single-key Gemini client, temperature=0, JSON response schema"
```

---

## Task 5: Fixture manifest sampler (dev/holdout split, sealed)

**Files:**
- Create: `worker/src/eval/manifest.ts`
- Create: `worker/test/fixtures/dev/manifest.json`, `worker/test/fixtures/holdout/manifest.json` (committed outputs)
- Test: `worker/test/manifest.test.ts`

**Stratification:** 4 axes — `source` (real|aug), `fillBucket` (empty/low|mid-low|mid-high|high), `frameBucket` (early|late, real frames only — augmented all = "aug"). Cells with no fixtures available are skipped; sampler reports cell counts.

- [ ] **Step 1: Failing test**

`worker/test/manifest.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fillBucket, sampleManifest } from "../src/eval/manifest.js";

describe("fillBucket", () => {
  it("buckets ml correctly", () => {
    expect(fillBucket(0)).toBe("empty-low");
    expect(fillBucket(275)).toBe("empty-low");
    expect(fillBucket(330)).toBe("mid-low");
    expect(fillBucket(770)).toBe("mid-low");
    expect(fillBucket(825)).toBe("mid-high");
    expect(fillBucket(1265)).toBe("high");
    expect(fillBucket(1500)).toBe("high");
  });
});

describe("sampleManifest", () => {
  it("produces deterministic sample for fixed seed", () => {
    const a = sampleManifest({ devCount: 60, holdoutCount: 40, seed: 42, framesRoot: "oil-bottle-frames", augRoot: "oil-bottle-augmented" });
    const b = sampleManifest({ devCount: 60, holdoutCount: 40, seed: 42, framesRoot: "oil-bottle-frames", augRoot: "oil-bottle-augmented" });
    expect(a.dev.map((f) => f.imageId)).toEqual(b.dev.map((f) => f.imageId));
    expect(a.holdout.map((f) => f.imageId)).toEqual(b.holdout.map((f) => f.imageId));
  });
  it("dev and holdout are disjoint", () => {
    const m = sampleManifest({ devCount: 60, holdoutCount: 40, seed: 42, framesRoot: "oil-bottle-frames", augRoot: "oil-bottle-augmented" });
    const devSet = new Set(m.dev.map((f) => f.imageId));
    for (const h of m.holdout) expect(devSet.has(h.imageId)).toBe(false);
  });
});
```

- [ ] **Step 2: Implement sampler**

`worker/src/eval/manifest.ts`:
```ts
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

export type Source = "real" | "aug";
export type FillBucket = "empty-low" | "mid-low" | "mid-high" | "high";
export type FrameBucket = "early" | "late" | "aug";

export interface FixtureEntry {
  imageId: string;             // path relative to repo root
  imagePath: string;           // absolute path
  groundTruthMl: number;
  source: Source;
  fillBucket: FillBucket;
  frameBucket: FrameBucket;
  stratum: string;             // `${source}:${fillBucket}:${frameBucket}`
}

export interface SampleArgs {
  devCount: number;
  holdoutCount: number;
  seed: number;
  framesRoot: string;
  augRoot: string;
}

export interface SampledManifest {
  dev: FixtureEntry[];
  holdout: FixtureEntry[];
  cellCounts: Record<string, number>;
  seed: number;
}

export function fillBucket(ml: number): FillBucket {
  if (ml <= 275) return "empty-low";
  if (ml <= 770) return "mid-low";
  if (ml <= 1210) return "mid-high";
  return "high";
}

// Mulberry32 deterministic PRNG
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseMlFolder(name: string): number | null {
  if (name === "empty") return 0;
  const m = name.match(/^(\d+)ml$/);
  return m ? parseInt(m[1], 10) : null;
}

function parseFrameIndex(filename: string): number | null {
  const m = filename.match(/_t(\d+)\.(\d+)s_/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

async function listFixtures(root: string, source: Source): Promise<FixtureEntry[]> {
  const out: FixtureEntry[] = [];
  const folders = await readdir(root, { withFileTypes: true });
  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const ml = parseMlFolder(folder.name);
    if (ml === null) continue; // skip 1.5L_refs etc.
    const folderPath = join(root, folder.name);
    const files = await readdir(folderPath);
    for (const f of files) {
      if (!/\.(jpg|jpeg|png)$/i.test(f)) continue;
      const frameIdx = source === "real" ? parseFrameIndex(f) : null;
      const frameBucket: FrameBucket =
        source === "aug" ? "aug" : (frameIdx !== null && frameIdx < 5) ? "early" : "late";
      out.push({
        imageId: relative(process.cwd(), join(folderPath, f)).replace(/\\/g, "/"),
        imagePath: join(folderPath, f),
        groundTruthMl: ml,
        source,
        fillBucket: fillBucket(ml),
        frameBucket,
        stratum: `${source}:${fillBucket(ml)}:${frameBucket}`,
      });
    }
  }
  return out;
}

export async function sampleManifest(args: SampleArgs): Promise<SampledManifest> {
  const real = await listFixtures(args.framesRoot, "real");
  const aug = await listFixtures(args.augRoot, "aug");
  const all = [...real, ...aug];
  const rand = rng(args.seed);

  // Group by stratum, shuffle within each
  const byStratum = new Map<string, FixtureEntry[]>();
  for (const f of all) {
    if (!byStratum.has(f.stratum)) byStratum.set(f.stratum, []);
    byStratum.get(f.stratum)!.push(f);
  }
  const cellCounts: Record<string, number> = {};
  for (const [k, v] of byStratum) cellCounts[k] = v.length;

  const strata = Array.from(byStratum.keys()).sort();
  for (const k of strata) byStratum.set(k, shuffle(byStratum.get(k)!, rand));

  // Round-robin pull from strata until counts hit
  const dev: FixtureEntry[] = [];
  const holdout: FixtureEntry[] = [];
  let devIdx = 0, holdoutIdx = 0;
  outer: while (dev.length < args.devCount || holdout.length < args.holdoutCount) {
    let progressed = false;
    for (const k of strata) {
      const pool = byStratum.get(k)!;
      if (dev.length < args.devCount && pool.length > 0) {
        dev.push(pool.shift()!); progressed = true;
        if (dev.length >= args.devCount && holdout.length >= args.holdoutCount) break outer;
      }
      if (holdout.length < args.holdoutCount && pool.length > 0) {
        holdout.push(pool.shift()!); progressed = true;
        if (dev.length >= args.devCount && holdout.length >= args.holdoutCount) break outer;
      }
    }
    if (!progressed) break;
  }

  return { dev, holdout, cellCounts, seed: args.seed };
}
```

- [ ] **Step 3: Run test** — Expected: PASS.

- [ ] **Step 4: Generate the committed manifests**

Add a one-shot script `worker/src/eval/build-manifest.ts`:
```ts
import { sampleManifest } from "./manifest.js";
import { writeFile, mkdir } from "node:fs/promises";

const m = await sampleManifest({
  devCount: 60, holdoutCount: 40, seed: 20260507,
  framesRoot: "oil-bottle-frames",
  augRoot: "oil-bottle-augmented",
});
await mkdir("worker/test/fixtures/dev", { recursive: true });
await mkdir("worker/test/fixtures/holdout", { recursive: true });
await writeFile("worker/test/fixtures/dev/manifest.json", JSON.stringify({ seed: m.seed, cellCounts: m.cellCounts, fixtures: m.dev }, null, 2));
await writeFile("worker/test/fixtures/holdout/manifest.json", JSON.stringify({ seed: m.seed, cellCounts: m.cellCounts, fixtures: m.holdout, sealed: true, holdoutTouches: 0 }, null, 2));
console.log(`dev=${m.dev.length} holdout=${m.holdout.length} strata=${Object.keys(m.cellCounts).length}`);
```

Run:
```bash
cd worker && tsx src/eval/build-manifest.ts
```

- [ ] **Step 5: Commit (manifest seal)**

```bash
git add -A
git commit -m "feat(eval): seal dev/holdout fixture manifests (seed=20260507, 60/40 split)"
git tag eval/manifest-v1
```

---

## Task 6: JSONL run-record writer

**Files:**
- Create: `worker/src/eval/jsonl.ts`
- Test: `worker/test/jsonl.test.ts`

- [ ] **Step 1: Failing test**

`worker/test/jsonl.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeRunRecord } from "../src/eval/jsonl.js";
import type { RunRecord } from "@afia/shared";

describe("writeRunRecord", () => {
  it("appends one line of valid JSON per call", async () => {
    const dir = mkdtempSync(join(tmpdir(), "afia-jsonl-"));
    const path = join(dir, "run.jsonl");
    const rec: RunRecord = {
      runId: "r1", runStartedTs: "2026-05-07T00:00:00Z",
      promptHash: "a".repeat(16), fewshotHash: "b".repeat(16),
      modelId: "gemini-2.5-flash", modelVersion: "v1",
      imageId: "x.jpg", imagePath: "/x.jpg", stratum: "real:high:early",
      groundTruthMl: 1500, rawOutput: "{}", parsedMl: 1485, parsedConfidence: 0.9,
      absErrorMl: 15, exactBucketPass: true, closeBucketPass: true,
      comparatorName: "ml-bucket-tolerance", comparatorVersion: "1.0.0",
      holdoutTouches: 0,
    };
    await writeRunRecord(path, rec);
    await writeRunRecord(path, rec);
    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).imageId).toBe("x.jpg");
  });
});
```

- [ ] **Step 2: Implement**

`worker/src/eval/jsonl.ts`:
```ts
import { appendFile } from "node:fs/promises";
import type { RunRecord } from "@afia/shared";

export async function writeRunRecord(path: string, rec: RunRecord): Promise<void> {
  await appendFile(path, JSON.stringify(rec) + "\n", "utf8");
}
```

- [ ] **Step 3: Run + Commit**

```bash
pnpm --filter worker test
git add -A && git commit -m "feat(eval): JSONL run-record writer"
```

---

## Task 7: `analyzeFixture` + Eval runner CLI (`eval:dev`, `eval:holdout`)

**Files:**
- Create: `worker/src/llm/analyze.ts`, `worker/src/eval/run.ts`
- Modify: `worker/test/fixtures/holdout/manifest.json` (touch counter incremented by runner)

- [ ] **Step 1: `analyzeFixture`**

`worker/src/llm/analyze.ts`:
```ts
import { readFile } from "node:fs/promises";
import { callGemini } from "./gemini.js";
import { loadPrompt } from "../prompt/load.js";
import { parseAnalysisResponse } from "../eval/parse-response.js";
import type { Env } from "../env.js";

export async function analyzeFixture(imagePath: string, env: Env, promptVersion = "v1") {
  const prompt = await loadPrompt(promptVersion);
  const buf = await readFile(imagePath);
  const imageBase64 = buf.toString("base64");
  const rawOutput = await callGemini({
    apiKey: env.GEMINI_API_KEY,
    modelId: env.MODEL_ID,
    systemText: prompt.systemText,
    userText: prompt.userText,
    fewShots: prompt.fewShots,
    imageBase64,
  });
  let parsed: ReturnType<typeof parseAnalysisResponse> | null = null;
  let parseErr: string | null = null;
  try { parsed = parseAnalysisResponse(rawOutput); }
  catch (e) { parseErr = (e as Error).message; }
  return { rawOutput, parsed, parseErr, prompt };
}
```

- [ ] **Step 2: Runner CLI**

`worker/src/eval/run.ts`:
```ts
#!/usr/bin/env tsx
import { readFile, writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../env.js";
import { analyzeFixture } from "../llm/analyze.js";
import { compareMl, COMPARATOR_NAME, COMPARATOR_VERSION } from "./compare.js";
import { writeRunRecord } from "./jsonl.js";
import type { RunRecord } from "@afia/shared";
import type { FixtureEntry } from "./manifest.js";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"];
}));
const set = args.set === "holdout" ? "holdout" : "dev";
const manifestPath = `worker/test/fixtures/${set}/manifest.json`;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (set === "holdout") {
  manifest.holdoutTouches = (manifest.holdoutTouches ?? 0) + 1;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.warn(`[seal] holdout touched, count = ${manifest.holdoutTouches}`);
}

const env = loadEnv();
const runId = randomUUID();
const runStartedTs = new Date().toISOString();
const outDir = "runs";
mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/${runStartedTs.replace(/[:.]/g, "-")}_${set}_${runId.slice(0, 8)}.jsonl`;

let n = 0, exact = 0, close = 0;
const perStratum = new Map<string, { n: number; exact: number }>();

for (const fx of manifest.fixtures as FixtureEntry[]) {
  n++;
  const { rawOutput, parsed, prompt } = await analyzeFixture(fx.imagePath, env);
  const comp = parsed ? compareMl(parsed.remainingMl, fx.groundTruthMl) : null;
  const rec: RunRecord = {
    runId, runStartedTs,
    promptHash: prompt.promptHash, fewshotHash: prompt.fewshotHash,
    modelId: env.MODEL_ID, modelVersion: prompt.promptVersion,
    imageId: fx.imageId, imagePath: fx.imagePath, stratum: fx.stratum,
    groundTruthMl: fx.groundTruthMl,
    rawOutput,
    parsedMl: parsed?.remainingMl ?? null,
    parsedConfidence: parsed?.confidence ?? null,
    absErrorMl: comp?.absErrorMl ?? null,
    exactBucketPass: comp?.exactBucketPass ?? false,
    closeBucketPass: comp?.closeBucketPass ?? false,
    comparatorName: COMPARATOR_NAME, comparatorVersion: COMPARATOR_VERSION,
    holdoutTouches: set === "holdout" ? manifest.holdoutTouches : 0,
  };
  await writeRunRecord(outPath, rec);
  if (rec.exactBucketPass) exact++;
  if (rec.closeBucketPass) close++;
  const s = perStratum.get(fx.stratum) ?? { n: 0, exact: 0 };
  s.n++; if (rec.exactBucketPass) s.exact++;
  perStratum.set(fx.stratum, s);
  process.stdout.write(`[${n}/${manifest.fixtures.length}] ${fx.imageId} gt=${fx.groundTruthMl} pred=${rec.parsedMl} ${rec.exactBucketPass ? "✓" : "✗"}\n`);
}

console.log(`\n=== ${set} run ${runId} ===`);
console.log(`exact (±55ml): ${exact}/${n} = ${(100 * exact / n).toFixed(1)}%`);
console.log(`close (±110ml): ${close}/${n} = ${(100 * close / n).toFixed(1)}%`);
console.log(`per-stratum exact:`);
for (const [k, v] of [...perStratum.entries()].sort()) {
  console.log(`  ${k}: ${v.exact}/${v.n} = ${(100 * v.exact / v.n).toFixed(1)}%`);
}
console.log(`output: ${outPath}`);
```

- [ ] **Step 3: Smoke run on dev (3 fixtures)**

Set `GEMINI_API_KEY` in `.env`. Manually trim a copy of `dev/manifest.json` to 3 fixtures and run:
```bash
pnpm eval:dev
```
Inspect `runs/*.jsonl` — verify schema, hashes, comparator outputs.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(eval): analyzeFixture + run.ts CLI for dev/holdout sets"
```

---

## Task 8: Stage 1 exit-gate script + reviewer sign-off

**Files:**
- Create: `worker/src/eval/signoff.ts`
- Create (gitignored seed): `runs/.gitkeep`, `runs/signoffs.jsonl`

- [ ] **Step 1: Implement gate**

`worker/src/eval/signoff.ts`:
```ts
#!/usr/bin/env tsx
import { readFile, appendFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const HOLDOUT_RUNS_NEEDED = 3;
const AGGREGATE_BAR = 0.90;
const STRATUM_BAR = 0.80;
const BYTE_STABLE_MIN = 38;

const files = readdirSync("runs")
  .filter((f) => f.includes("_holdout_") && f.endsWith(".jsonl"))
  .sort()
  .slice(-HOLDOUT_RUNS_NEEDED);

if (files.length < HOLDOUT_RUNS_NEEDED) {
  console.error(`Need ${HOLDOUT_RUNS_NEEDED} holdout runs, found ${files.length}`);
  process.exit(2);
}

interface Row { imageId: string; stratum: string; rawOutput: string; exactBucketPass: boolean; }
const runs: Row[][] = [];
for (const f of files) {
  const lines = (await readFile(`runs/${f}`, "utf8")).trim().split("\n");
  runs.push(lines.map((l) => JSON.parse(l)));
}

// Aggregate accuracy on the latest run
const latest = runs[runs.length - 1];
const totalExact = latest.filter((r) => r.exactBucketPass).length;
const aggregate = totalExact / latest.length;
console.log(`aggregate exact: ${totalExact}/${latest.length} = ${(100*aggregate).toFixed(1)}%`);

// Per-stratum
const byStratum = new Map<string, { n: number; exact: number }>();
for (const r of latest) {
  const s = byStratum.get(r.stratum) ?? { n: 0, exact: 0 };
  s.n++; if (r.exactBucketPass) s.exact++;
  byStratum.set(r.stratum, s);
}
let stratumPass = true;
for (const [k, v] of byStratum) {
  const acc = v.exact / v.n;
  const ok = acc >= STRATUM_BAR;
  console.log(`  ${k}: ${(100 * acc).toFixed(1)}% ${ok ? "✓" : "✗"}`);
  if (!ok) stratumPass = false;
}

// Byte-stability across runs
let byteStable = 0;
for (let i = 0; i < latest.length; i++) {
  const outputs = runs.map((r) => r[i]?.rawOutput);
  if (outputs.every((o) => o === outputs[0])) byteStable++;
}
console.log(`byte-stable across ${HOLDOUT_RUNS_NEEDED} runs: ${byteStable}/${latest.length}`);

const metricsPass = aggregate >= AGGREGATE_BAR && stratumPass && byteStable >= BYTE_STABLE_MIN;
console.log(`\nMETRIC GATE: ${metricsPass ? "PASS ✓" : "FAIL ✗"}`);

if (!metricsPass) {
  console.log("Iterate prompt/few-shots on dev set, do not touch holdout.");
  process.exit(1);
}

const rl = createInterface({ input, output });
console.log("\n--- REVIEWER SIGN-OFF ---");
console.log("Open the latest holdout JSONL and review predictions against ground truth.");
const reviewer = await rl.question("Reviewer name: ");
const decision = (await rl.question("Trustworthy enough to fund Stage 2? (yes/no): ")).toLowerCase();
const notes = await rl.question("Notes: ");
rl.close();

await appendFile("runs/signoffs.jsonl", JSON.stringify({
  ts: new Date().toISOString(),
  reviewer,
  decision,
  notes,
  runFiles: files,
  aggregate,
  byteStable,
  perStratum: Object.fromEntries(byStratum),
}) + "\n");

if (decision !== "yes") {
  console.log("Sign-off recorded as no-go. Stage 1 not complete.");
  process.exit(1);
}
console.log("Stage 1 PASS. Proceed to Stage 2.");
```

- [ ] **Step 2: Commit**

```bash
mkdir -p runs && touch runs/.gitkeep runs/signoffs.jsonl
git add -A
git commit -m "feat(eval): Stage 1 exit-gate (90/80/byte-stable + reviewer sign-off)"
```

---

## Task 9: Run the actual Stage 1 evaluation

This is not a code task — it is the execution of the plan above to determine whether Stage 1 passes.

- [ ] **Step 1: Iterate on dev set**
  ```bash
  pnpm eval:dev
  ```
  Examine results. Adjust `worker/src/prompt/v1/system.md`, `bottle-reference.md`, or `few-shots/*.json`. Each change creates a new `promptHash` / `fewshotHash`, naturally versioning the JSONL trail. **Do not touch the holdout manifest.**

- [ ] **Step 2: Once dev plateau is reached, run holdout 3×**
  ```bash
  pnpm eval:holdout
  pnpm eval:holdout
  pnpm eval:holdout
  ```
  Each run increments `holdoutTouches` in the manifest. Three runs are required for the byte-stability check.

- [ ] **Step 3: Run the gate**
  ```bash
  pnpm signoff
  ```
  Gate either fails (iterate further on dev OR break the seal and re-draw from reserve, accepting the audit cost) or prompts the reviewer for sign-off.

- [ ] **Step 4: Commit the sign-off record**
  ```bash
  git add runs/signoffs.jsonl worker/test/fixtures/holdout/manifest.json
  git commit -m "eval: Stage 1 sign-off recorded"
  git tag stage1/passed   # only if decision == yes
  ```

---

## Stage 2 Roadmap (Promoted from Old Stage 1)

When `stage1/passed` is tagged, Stage 2 picks up:

1. **Consumer UX:** React + Vite SPA, i18n (en/ar+RTL), theme toggle, scan landing, camera capture with bottle outline overlay, result page with red line, OilSlider (55ml steps), CupCounter
2. **Cloudflare Worker HTTP API:** wrap `analyzeFixture` as `POST /api/analyze`, Static Assets binding for SPA, deploy + smoke test
3. **Supabase persistence:** `analyses` table matching the JSONL run-record schema frozen in Stage 1; `bottle-images` storage bucket; RLS for admin
4. **Multi-key Gemini rotation + Grok fallback**
5. **Admin review queue + corrections + manual upload**
6. **2.5L bottle path** — extend `BOTTLE_2_5L`, geometry, prompt
7. **Stage 3 (later):** local on-device model fine-tuned on the corrections corpus

---

## Summary

**Stage 1 delivers:** a passing or failing answer to *can we trust Gemini ml predictions on Afia 1.5L bottles?* — backed by a sealed 40-fixture eval, byte-stable across 3 runs at temperature 0, with a versioned prompt, a frozen comparator, and a reviewer sign-off.

**Stage 1 does NOT deliver:** any UI, any deployment, any persistence, any camera, any user-facing surface.

**Total tasks: 9** (down from 15 in the previous "simplification" — the simplification did not go far enough).
