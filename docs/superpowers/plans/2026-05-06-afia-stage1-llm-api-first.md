# Afia Oil Level Scanner — Stage 1 (LLM API-First) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Cloudflare-deployed web app where a consumer scans a QR on a 1.5L Afia oil bottle, captures a photo via the phone camera with a static front-side outline guide, and receives an LLM-analyzed oil level (consumed / remaining ml + visual red line). Admin dashboard lets reviewers correct results and ingest training images. Stage 1 uses Gemini (multi-key rotation) with Grok fallback — **no local model in this stage**; the captured image + LLM result is persisted to Supabase to build the Stage 2 training corpus.

**Architecture:**
- Single pnpm monorepo. One Cloudflare Worker (Hono) serves both the API and the SPA via Static Assets.
- React + Vite + Tailwind SPA with three surfaces: `/scan` (QR landing) → `/capture` (camera) → `/result` (oil level + slider), plus `/admin/*` (QR generator, review queue, manual upload).
- Worker `/api/analyze` accepts a JPEG, calls Gemini via a key-rotation pool, falls back to Grok on quota/error, parses a strict JSON response, persists everything to Supabase (Postgres + Storage), returns oil level + red-line Y ratio + ml values.
- Stage 1 outline is a **static SVG** sized for the 1.5L bottle geometry only. Auto-lock / quality detection are explicitly deferred.

**Tech Stack:**
- Cloudflare Workers + Wrangler 4 (Static Assets binding for SPA)
- Hono (router on Worker)
- React 18 + Vite 5 + TypeScript + Tailwind CSS
- i18next (en/ar) with RTL handling, theme = `prefers-color-scheme` + manual toggle persisted in `localStorage`
- Vitest + `@cloudflare/vitest-pool-workers` (Worker tests), Vitest + Testing Library (UI tests), Playwright (one e2e smoke)
- Supabase (Postgres `analyses` table, `bottle-images` Storage bucket); `@supabase/supabase-js` from the Worker
- `qrcode` (admin QR generation), `jsqr` or native `BarcodeDetector` for scanning fallback, but the QR encodes a direct URL so the OS camera handles it
- Secrets via Wrangler: `GEMINI_API_KEYS` (CSV), `GROK_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_TOKEN`

**Out of scope for Stage 1 (explicit):**
- Local on-device model (Stage 2)
- 2.5L bottle analysis path (QR generator stubs the size, but capture + analyze hardcode 1.5L geometry)
- Dynamic outline auto-lock, auto-capture, lighting/blur quality detection (placeholders only)
- Auth beyond a single shared `ADMIN_TOKEN` header for admin routes

---

## File Structure

```
afia-app-simplified/
├── package.json                          # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── worker/
│   ├── wrangler.jsonc                    # Worker config + Static Assets binding
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── index.ts                      # Hono app entry, route mounting
│   │   ├── env.ts                        # Env type + parser
│   │   ├── routes/
│   │   │   ├── analyze.ts                # POST /api/analyze
│   │   │   ├── admin.ts                  # /api/admin/* (auth, list, mark, override, upload)
│   │   │   └── health.ts                 # GET /api/health
│   │   ├── llm/
│   │   │   ├── gemini.ts                 # Single-key Gemini client
│   │   │   ├── grok.ts                   # Grok fallback client
│   │   │   ├── rotation.ts               # Round-robin + 429-aware key pool
│   │   │   └── orchestrator.ts           # Gemini-then-Grok with retries
│   │   ├── prompt/
│   │   │   ├── system-prompt.ts          # System instructions
│   │   │   ├── bottle-reference.ts       # 1.5L geometry constants + reference points
│   │   │   └── parse-response.ts         # Strict JSON parser + zod schema
│   │   └── storage/
│   │       └── supabase.ts               # Insert analysis + upload image
│   └── test/
│       ├── analyze.test.ts
│       ├── rotation.test.ts
│       ├── orchestrator.test.ts
│       └── parse-response.test.ts
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                       # Router
│   │   ├── i18n.ts                       # en + ar resources
│   │   ├── theme.ts                      # theme provider
│   │   ├── components/
│   │   │   ├── FloatingControls.tsx      # language + theme buttons (top-right)
│   │   │   ├── BottleOutline.tsx         # static SVG outline for 1.5L
│   │   │   ├── CameraCapture.tsx         # getUserMedia + capture
│   │   │   ├── OilSlider.tsx             # 55ml-step slider
│   │   │   └── CupCounter.tsx            # 1/4-1/2-3/4-full cup visualization
│   │   ├── pages/
│   │   │   ├── Scan.tsx                  # QR landing → forwards to /capture
│   │   │   ├── Capture.tsx               # camera + outline + manual button
│   │   │   ├── Result.tsx                # photo + red line + slider + cup counter
│   │   │   └── admin/
│   │   │       ├── AdminLayout.tsx       # token gate
│   │   │       ├── QrGenerator.tsx       # generate 1.5L / 2.5L QR
│   │   │       ├── ReviewQueue.tsx       # list of analyses
│   │   │       ├── ReviewDetail.tsx      # mark inaccurate / override / re-run
│   │   │       └── ManualUpload.tsx      # admin uploads image + ground truth
│   │   └── lib/
│   │       ├── api.ts                    # fetch wrappers
│   │       ├── bottle-geometry.ts        # 1.5L constants shared with worker
│   │       └── cups.ts                   # ml-to-cups math
│   └── test/
│       ├── OilSlider.test.tsx
│       ├── CupCounter.test.tsx
│       └── BottleOutline.test.tsx
├── packages/
│   └── shared/
│       ├── package.json
│       ├── src/
│       │   ├── types.ts                  # AnalysisRequest/Response types
│       │   └── bottle.ts                 # BOTTLE_1_5L = { capacityMl: 1500, ... }
│       └── tsconfig.json
└── docs/
    └── superpowers/plans/2026-05-06-afia-stage1-llm-api-first.md
```

**Why this layout:** the Worker and the SPA each hold one concern; `packages/shared` keeps the bottle constants and analysis types in one place so the LLM prompt, the result renderer, and the slider all agree on what 1500 ml means. The Worker owns secrets and never leaks them to the browser.

---

## Task 1: Monorepo + Worker + Vite skeleton

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Create: `worker/package.json`, `worker/wrangler.jsonc`, `worker/tsconfig.json`, `worker/src/index.ts`, `worker/src/env.ts`
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`
- Create: `packages/shared/package.json`, `packages/shared/src/types.ts`, `packages/shared/src/bottle.ts`, `packages/shared/tsconfig.json`
- Create: `worker/test/health.test.ts`

- [ ] **Step 1: Write `pnpm-workspace.yaml` and root `package.json`**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "worker"
  - "web"
  - "packages/*"
```

`package.json`:
```json
{
  "name": "afia-app-simplified",
  "private": true,
  "scripts": {
    "build": "pnpm -r run build",
    "dev:web": "pnpm --filter web dev",
    "dev:worker": "pnpm --filter worker dev",
    "test": "pnpm -r run test"
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
    "isolatedModules": true,
    "jsx": "react-jsx"
  }
}
```

- [ ] **Step 2: Write `packages/shared`**

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
export type BottleSize = "1.5L" | "2.5L";

export const BOTTLE_1_5L = {
  size: "1.5L" as const,
  capacityMl: 1500,
  // Approximate normalized geometry (0..1 within bottle bounding box) of fill region.
  // y=0 is the cap, y=1 is the base. Liquid surface is somewhere in fillTop..fillBottom.
  fillTopY: 0.18,
  fillBottomY: 0.96,
} as const;

export const BOTTLE_2_5L = {
  size: "2.5L" as const,
  capacityMl: 2500,
  fillTopY: 0.16,
  fillBottomY: 0.97,
} as const;

export const ML_PER_CUP_QUARTER = 55;
export const ML_PER_CUP = ML_PER_CUP_QUARTER * 4; // 220ml
```

`packages/shared/src/types.ts`:
```ts
import type { BottleSize } from "./bottle.js";

export interface AnalysisRequest {
  bottleSize: BottleSize;
  imageBase64: string; // JPEG, no data: prefix
}

export interface AnalysisResult {
  remainingMl: number;
  consumedMl: number;
  redLineYRatio: number;     // 0..1, position of liquid surface within bottle bbox
  confidence: number;        // 0..1
  provider: "gemini" | "grok";
  rawModelText: string;
}

export interface AnalysisRecord extends AnalysisResult {
  id: string;
  createdAt: string;
  imageUrl: string;
  bottleSize: BottleSize;
  adminCorrection?: {
    flag: "too_big" | "too_small" | "manual";
    correctedRemainingMl?: number;
    note?: string;
  };
}
```

`packages/shared/src/index.ts`:
```ts
export * from "./bottle.js";
export * from "./types.js";
```

- [ ] **Step 3: Write Worker skeleton with health route**

`worker/package.json`:
```json
{
  "name": "worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "build": "wrangler deploy --dry-run --outdir=dist"
  },
  "dependencies": {
    "hono": "4.6.10",
    "@afia/shared": "workspace:*"
  },
  "devDependencies": {
    "wrangler": "4.0.0",
    "@cloudflare/workers-types": "4.20251101.0",
    "@cloudflare/vitest-pool-workers": "0.5.30",
    "vitest": "2.1.4",
    "typescript": "5.6.3"
  }
}
```

`worker/wrangler.jsonc`:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "afia-stage1",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "../web/dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "observability": { "enabled": true }
}
```

`worker/src/env.ts`:
```ts
export interface Env {
  ASSETS: Fetcher;
  GEMINI_API_KEYS: string;     // comma-separated
  GROK_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  ADMIN_TOKEN: string;
}
```

`worker/src/index.ts`:
```ts
import { Hono } from "hono";
import type { Env } from "./env.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 4: Write the failing health test**

`worker/test/health.test.ts`:
```ts
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("health", () => {
  it("returns ok", async () => {
    const res = await SELF.fetch("https://x/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

`worker/vitest.config.ts`:
```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
export default defineWorkersConfig({
  test: { poolOptions: { workers: { wrangler: { configPath: "./wrangler.jsonc" } } } },
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm --filter worker test`
Expected: FAIL — module wiring not complete or the test runs and passes (if it passes, that's fine — proceed).

- [ ] **Step 6: Bootstrap Vite app**

`web/package.json`:
```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-router-dom": "6.27.0",
    "@afia/shared": "workspace:*"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "4.3.3",
    "vite": "5.4.10",
    "vitest": "2.1.4",
    "@testing-library/react": "16.0.1",
    "@testing-library/jest-dom": "6.6.3",
    "jsdom": "25.0.1",
    "typescript": "5.6.3",
    "tailwindcss": "3.4.14",
    "postcss": "8.4.47",
    "autoprefixer": "10.4.20",
    "@types/react": "18.3.12",
    "@types/react-dom": "18.3.1"
  }
}
```

`web/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8787" } },
  build: { outDir: "dist", emptyOutDir: true },
});
```

`web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" /><title>Afia</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

`web/src/main.tsx`:
```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>
);
```

`web/src/App.tsx`:
```tsx
import { Routes, Route, Navigate } from "react-router-dom";
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/scan?size=1.5L" replace />} />
      <Route path="/scan" element={<div>scan placeholder</div>} />
    </Routes>
  );
}
```

`web/src/index.css`:
```css
@tailwind base; @tailwind components; @tailwind utilities;
html, body, #root { height: 100%; }
```

`web/tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";
export default { content: ["./index.html", "./src/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] } satisfies Config;
```

- [ ] **Step 7: Install + verify build**

Run:
```bash
pnpm install
pnpm --filter web build
pnpm --filter worker build
pnpm --filter worker test
```
Expected: web builds to `web/dist`, worker dry-run succeeds, health test passes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: bootstrap monorepo, worker, vite skeleton"
```

---

## Task 2: Floating language + theme controls, i18n, theme provider

**Files:**
- Create: `web/src/i18n.ts`, `web/src/theme.ts`, `web/src/components/FloatingControls.tsx`
- Modify: `web/src/main.tsx`, `web/src/App.tsx`
- Test: `web/test/FloatingControls.test.tsx`

- [ ] **Step 1: Write the failing test**

`web/test/FloatingControls.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect } from "vitest";
import { FloatingControls } from "../src/components/FloatingControls";
import { ThemeProvider } from "../src/theme";
import { I18nProvider } from "../src/i18n";

describe("FloatingControls", () => {
  it("toggles language en <-> ar and sets dir attribute", () => {
    render(<I18nProvider><ThemeProvider><FloatingControls /></ThemeProvider></I18nProvider>);
    const langBtn = screen.getByRole("button", { name: /language/i });
    expect(document.documentElement.lang).toBe("en");
    fireEvent.click(langBtn);
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("toggles theme and sets html class", () => {
    render(<I18nProvider><ThemeProvider><FloatingControls /></ThemeProvider></I18nProvider>);
    const themeBtn = screen.getByRole("button", { name: /theme/i });
    fireEvent.click(themeBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
```

`web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()], test: { environment: "jsdom", setupFiles: [] } });
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement i18n + theme + FloatingControls**

`web/src/i18n.ts`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "en" | "ar";
const dict: Record<Lang, Record<string, string>> = {
  en: {
    "capture.title": "Photograph the FRONT of the bottle",
    "capture.button": "Capture",
    "capture.hint": "Hold the bottle so its outline matches the guide",
    "result.consumed": "Consumed",
    "result.remaining": "Remaining",
  },
  ar: {
    "capture.title": "صوّر الوجه الأمامي للزجاجة",
    "capture.button": "التقاط",
    "capture.hint": "اضبط الزجاجة لتطابق الإطار الإرشادي",
    "result.consumed": "المستهلك",
    "result.remaining": "المتبقي",
  },
};

const Ctx = createContext<{ lang: Lang; t: (k: string) => string; toggle: () => void }>({
  lang: "en", t: (k) => k, toggle: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "en");
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("lang", lang);
  }, [lang]);
  const t = (k: string) => dict[lang][k] ?? k;
  const toggle = () => setLang((l) => (l === "en" ? "ar" : "en"));
  return <Ctx.Provider value={{ lang, t, toggle }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
```

`web/src/theme.ts`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
type Theme = "light" | "dark";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "light");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);
  return <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")) }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
```

`web/src/components/FloatingControls.tsx`:
```tsx
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

export function FloatingControls() {
  const { lang, toggle: toggleLang } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  return (
    <div className="fixed top-3 right-3 z-50 flex gap-2 pointer-events-auto">
      <button aria-label="language" onClick={toggleLang}
        className="rounded-full bg-white/80 dark:bg-black/60 backdrop-blur px-3 py-1 text-sm shadow">
        {lang === "en" ? "ع" : "EN"}
      </button>
      <button aria-label="theme" onClick={toggleTheme}
        className="rounded-full bg-white/80 dark:bg-black/60 backdrop-blur px-3 py-1 text-sm shadow">
        {theme === "light" ? "🌙" : "☀"}
      </button>
    </div>
  );
}
```

`web/tailwind.config.ts` — add `darkMode: "class"`:
```ts
import type { Config } from "tailwindcss";
export default { darkMode: "class", content: ["./index.html", "./src/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] } satisfies Config;
```

Update `web/src/main.tsx` to wrap providers:
```tsx
import { I18nProvider } from "./i18n";
import { ThemeProvider } from "./theme";
// ...
createRoot(document.getElementById("root")!).render(
  <React.StrictMode><I18nProvider><ThemeProvider>
    <BrowserRouter><App /></BrowserRouter>
  </ThemeProvider></I18nProvider></React.StrictMode>
);
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): i18n (en/ar+rtl), theme toggle, floating controls"
```

---

## Task 3: Admin QR generator (1.5L + 2.5L stub)

**Files:**
- Create: `web/src/pages/admin/AdminLayout.tsx`, `web/src/pages/admin/QrGenerator.tsx`
- Modify: `web/src/App.tsx`
- Add dep: `qrcode` (web)
- Test: `web/test/QrGenerator.test.tsx`

- [ ] **Step 1: Write the failing test**

`web/test/QrGenerator.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { QrGenerator } from "../src/pages/admin/QrGenerator";

describe("QrGenerator", () => {
  it("renders QR images for 1.5L and 2.5L pointing at /scan?size=...", async () => {
    render(<MemoryRouter><QrGenerator origin="https://afia.test" /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));
    await waitFor(() => {
      const imgs = screen.getAllByRole("img");
      expect(imgs.length).toBe(2);
      expect(imgs[0].getAttribute("alt")).toMatch(/1\.5L/);
      expect(imgs[1].getAttribute("alt")).toMatch(/2\.5L/);
    });
    expect(screen.getByText(/https:\/\/afia\.test\/scan\?size=1\.5L/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test`
Expected: FAIL — `QrGenerator` not found.

- [ ] **Step 3: Implement**

Add `qrcode`: `pnpm --filter web add qrcode && pnpm --filter web add -D @types/qrcode`.

`web/src/pages/admin/QrGenerator.tsx`:
```tsx
import { useState } from "react";
import QRCode from "qrcode";

const SIZES = ["1.5L", "2.5L"] as const;

export function QrGenerator({ origin = window.location.origin }: { origin?: string }) {
  const [imgs, setImgs] = useState<{ size: string; url: string; data: string }[]>([]);
  const generate = async () => {
    const out = await Promise.all(
      SIZES.map(async (s) => {
        const url = `${origin}/scan?size=${encodeURIComponent(s)}`;
        const data = await QRCode.toDataURL(url, { width: 320, margin: 1 });
        return { size: s, url, data };
      })
    );
    setImgs(out);
  };
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Bottle QR codes</h1>
      <button onClick={generate} className="px-4 py-2 bg-blue-600 text-white rounded">Generate</button>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {imgs.map((q) => (
          <div key={q.size} className="border p-3 rounded space-y-1">
            <img src={q.data} alt={`QR ${q.size}`} />
            <div className="text-xs break-all">{q.url}</div>
            <a href={q.data} download={`afia-${q.size}.png`} className="text-blue-600 text-sm">Download</a>
          </div>
        ))}
      </div>
    </div>
  );
}
```

`web/src/pages/admin/AdminLayout.tsx`:
```tsx
import { Outlet, Link } from "react-router-dom";
import { useState, useEffect } from "react";

export function AdminLayout() {
  const [token, setToken] = useState(() => localStorage.getItem("admin_token") || "");
  useEffect(() => { localStorage.setItem("admin_token", token); }, [token]);
  if (!token) {
    return (
      <div className="p-6 max-w-sm">
        <h1 className="text-xl mb-2">Admin</h1>
        <input className="border w-full p-2" placeholder="Admin token"
          onChange={(e) => setToken(e.target.value)} />
      </div>
    );
  }
  return (
    <div>
      <nav className="p-3 border-b flex gap-4 text-sm">
        <Link to="/admin/qr">QR</Link>
        <Link to="/admin/review">Review</Link>
        <Link to="/admin/upload">Upload</Link>
      </nav>
      <Outlet />
    </div>
  );
}
```

Update `web/src/App.tsx`:
```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { FloatingControls } from "./components/FloatingControls";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { QrGenerator } from "./pages/admin/QrGenerator";

export default function App() {
  return (
    <>
      <FloatingControls />
      <Routes>
        <Route path="/" element={<Navigate to="/scan?size=1.5L" replace />} />
        <Route path="/scan" element={<div>scan placeholder</div>} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="qr" replace />} />
          <Route path="qr" element={<QrGenerator />} />
        </Route>
      </Routes>
    </>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): QR generator for 1.5L and 2.5L bottles"
```

---

## Task 4: Scan landing → /capture with size param

**Files:**
- Create: `web/src/pages/Scan.tsx`
- Modify: `web/src/App.tsx`
- Test: `web/test/Scan.test.tsx`

- [ ] **Step 1: Write the failing test**

`web/test/Scan.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { Scan } from "../src/pages/Scan";

describe("Scan", () => {
  it("redirects unsupported sizes to a friendly notice", () => {
    render(
      <MemoryRouter initialEntries={["/scan?size=2.5L"]}>
        <Routes><Route path="/scan" element={<Scan />} /></Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/not supported yet/i)).toBeInTheDocument();
  });
  it("forwards 1.5L to /capture", () => {
    render(
      <MemoryRouter initialEntries={["/scan?size=1.5L"]}>
        <Routes>
          <Route path="/scan" element={<Scan />} />
          <Route path="/capture" element={<div>capture-page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("capture-page")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test`
Expected: FAIL — `Scan` missing.

- [ ] **Step 3: Implement**

`web/src/pages/Scan.tsx`:
```tsx
import { Navigate, useSearchParams } from "react-router-dom";

export function Scan() {
  const [params] = useSearchParams();
  const size = params.get("size");
  if (size === "1.5L") return <Navigate to={`/capture?size=1.5L`} replace />;
  return (
    <div className="p-6 text-center">
      <h1 className="text-xl">Bottle size {size ?? "unknown"} not supported yet.</h1>
      <p className="text-sm opacity-70">Stage 1 supports 1.5L bottles only.</p>
    </div>
  );
}
```

Wire in `App.tsx`:
```tsx
import { Scan } from "./pages/Scan";
// <Route path="/scan" element={<Scan />} />
// <Route path="/capture" element={<div>capture placeholder</div>} />
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): scan landing forwards 1.5L to capture, gates other sizes"
```

---

## Task 5: Static bottle outline component (1.5L)

**Files:**
- Create: `web/src/components/BottleOutline.tsx`
- Test: `web/test/BottleOutline.test.tsx`

- [ ] **Step 1: Write the failing test**

`web/test/BottleOutline.test.tsx`:
```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BottleOutline } from "../src/components/BottleOutline";

describe("BottleOutline", () => {
  it("renders an SVG with role=presentation and a single path", () => {
    const { container } = render(<BottleOutline color="#f59e0b" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("role")).toBe("presentation");
    expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test` — Expected: FAIL.

- [ ] **Step 3: Implement**

`web/src/components/BottleOutline.tsx`:
```tsx
type Props = { color?: string; className?: string };

// Approximate Afia 1.5L silhouette: shoulder + tapered cap + base.
// Drawn in a 100x300 viewBox so we can position centered on screen.
export function BottleOutline({ color = "#f59e0b", className }: Props) {
  return (
    <svg
      role="presentation"
      viewBox="0 0 100 300"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
    >
      <path
        d="
          M 42 10 H 58 V 28
          C 58 32 60 34 62 36
          L 70 50
          C 76 58 80 70 80 86
          V 270
          C 80 282 72 290 60 290
          H 40
          C 28 290 20 282 20 270
          V 86
          C 20 70 24 58 30 50
          L 38 36
          C 40 34 42 32 42 28 Z
        "
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Cap detail */}
      <path d="M 42 10 H 58 V 26 H 42 Z" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
```

- [ ] **Step 4: Run to verify it passes** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): static 1.5L bottle outline SVG component"
```

---

## Task 6: Camera capture page (manual button, layout-safe outline)

**Files:**
- Create: `web/src/components/CameraCapture.tsx`, `web/src/pages/Capture.tsx`
- Modify: `web/src/App.tsx`
- Test: `web/test/CameraCapture.test.tsx` (mock getUserMedia)

- [ ] **Step 1: Write the failing test**

`web/test/CameraCapture.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CameraCapture } from "../src/components/CameraCapture";

beforeEach(() => {
  // @ts-expect-error
  navigator.mediaDevices = { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) };
});

describe("CameraCapture", () => {
  it("renders capture button, instruction text, and bottle outline overlay", () => {
    render(<CameraCapture onCapture={() => {}} />);
    expect(screen.getByRole("button", { name: /capture/i })).toBeInTheDocument();
    expect(screen.getByText(/front/i)).toBeInTheDocument();
    expect(document.querySelector("svg[role='presentation']")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement**

`web/src/components/CameraCapture.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import { BottleOutline } from "./BottleOutline";
import { useI18n } from "../i18n";

type Props = { onCapture: (jpegBlob: Blob) => void };

export function CameraCapture({ onCapture }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e: any) { setErr(e?.message ?? "camera error"); }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const capture = async () => {
    const v = videoRef.current; if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.9));
    onCapture(blob);
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col">
      {/* Top text band — leaves space for floating controls top-right */}
      <div className="pt-3 pb-2 px-16 text-center text-sm bg-gradient-to-b from-black/60 to-transparent z-10">
        <div className="font-medium">{t("capture.title")}</div>
        <div className="opacity-80 text-xs mt-0.5">{t("capture.hint")}</div>
      </div>

      {/* Camera feed */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        {/* Outline sized to ~58% of viewport height, centered, never overlapping bottom button (h-32) or top band */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <BottleOutline className="h-[58vh] max-h-[520px] w-auto opacity-90" color="#f59e0b" />
        </div>
        {err && <div className="absolute bottom-32 left-0 right-0 text-center text-red-400">{err}</div>}
      </div>

      {/* Bottom action bar */}
      <div className="h-32 flex items-center justify-center bg-gradient-to-t from-black/80 to-transparent">
        <button
          onClick={capture}
          aria-label="capture"
          className="w-20 h-20 rounded-full bg-white border-4 border-white/40 active:scale-95 transition"
        />
      </div>
    </div>
  );
}
```

`web/src/pages/Capture.tsx`:
```tsx
import { useState } from "react";
import { CameraCapture } from "../components/CameraCapture";
import { useNavigate, useSearchParams } from "react-router-dom";

export function Capture() {
  const [params] = useSearchParams();
  const size = params.get("size") ?? "1.5L";
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const onCapture = async (blob: Blob) => {
    setBusy(true);
    const buf = await blob.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    sessionStorage.setItem("afia.capture", b64);
    sessionStorage.setItem("afia.size", size);
    nav("/result");
  };

  if (busy) return <div className="p-6 text-center">Analyzing…</div>;
  return <CameraCapture onCapture={onCapture} />;
}
```

Wire in `App.tsx`: `<Route path="/capture" element={<Capture />} />`.

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): camera capture screen with static 1.5L outline overlay"
```

---

## Task 7: Worker `/api/analyze` endpoint scaffold

**Files:**
- Create: `worker/src/routes/analyze.ts`
- Modify: `worker/src/index.ts`
- Test: `worker/test/analyze.test.ts`

- [ ] **Step 1: Write the failing test**

`worker/test/analyze.test.ts`:
```ts
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("POST /api/analyze", () => {
  it("rejects missing fields with 400", async () => {
    const res = await SELF.fetch("https://x/api/analyze", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    expect(res.status).toBe(400);
  });
  it("rejects unsupported bottle size with 400", async () => {
    const res = await SELF.fetch("https://x/api/analyze", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bottleSize: "2.5L", imageBase64: "AAAA" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement scaffold (calls stub orchestrator)**

`worker/src/routes/analyze.ts`:
```ts
import { Hono } from "hono";
import type { Env } from "../env.js";

export const analyze = new Hono<{ Bindings: Env }>();

analyze.post("/", async (c) => {
  const body = await c.req.json().catch(() => null) as { bottleSize?: string; imageBase64?: string } | null;
  if (!body?.bottleSize || !body.imageBase64) return c.json({ error: "missing fields" }, 400);
  if (body.bottleSize !== "1.5L") return c.json({ error: "unsupported bottle size" }, 400);
  // Stage 1 stub — replaced in later tasks
  return c.json({ error: "not implemented" }, 501);
});
```

`worker/src/index.ts`:
```ts
import { Hono } from "hono";
import type { Env } from "./env.js";
import { analyze } from "./routes/analyze.js";
const app = new Hono<{ Bindings: Env }>();
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/analyze", analyze);
export default app;
```

- [ ] **Step 4: Run** — PASS (both 400 cases).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(worker): /api/analyze validates inputs, stubs response"
```

---

## Task 8: Gemini key rotation pool

**Files:**
- Create: `worker/src/llm/rotation.ts`
- Test: `worker/test/rotation.test.ts`

- [ ] **Step 1: Write the failing test**

`worker/test/rotation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { KeyPool } from "../src/llm/rotation.js";

describe("KeyPool", () => {
  it("rotates across keys", () => {
    const pool = new KeyPool(["a", "b", "c"]);
    expect(pool.next()).toBe("a");
    expect(pool.next()).toBe("b");
    expect(pool.next()).toBe("c");
    expect(pool.next()).toBe("a");
  });
  it("skips keys cooled down for 429", () => {
    const pool = new KeyPool(["a", "b"]);
    pool.markRateLimited("a", 60_000);
    expect(pool.next()).toBe("b");
    expect(pool.next()).toBe("b");
  });
  it("returns null when all keys cooled", () => {
    const pool = new KeyPool(["a"]);
    pool.markRateLimited("a", 60_000);
    expect(pool.next()).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

`worker/src/llm/rotation.ts`:
```ts
export class KeyPool {
  private idx = 0;
  private cooldownUntil = new Map<string, number>();
  constructor(private keys: string[]) {
    if (keys.length === 0) throw new Error("KeyPool empty");
  }
  next(now = Date.now()): string | null {
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[this.idx];
      this.idx = (this.idx + 1) % this.keys.length;
      const until = this.cooldownUntil.get(k) ?? 0;
      if (until <= now) return k;
    }
    return null;
  }
  markRateLimited(key: string, durationMs: number, now = Date.now()) {
    this.cooldownUntil.set(key, now + durationMs);
  }
}

export function parseKeys(csv: string): string[] {
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(worker): Gemini key rotation pool with 429 cooldown"
```

---

## Task 9: Prompt + reference data + response parser

**Files:**
- Create: `worker/src/prompt/system-prompt.ts`, `worker/src/prompt/bottle-reference.ts`, `worker/src/prompt/parse-response.ts`
- Test: `worker/test/parse-response.test.ts`
- Add dep: `zod`

- [ ] **Step 1: Write the failing test**

`worker/test/parse-response.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseModelResponse } from "../src/prompt/parse-response.js";

describe("parseModelResponse", () => {
  it("parses well-formed JSON inside fenced block", () => {
    const txt = "Here you go:\n```json\n" +
      '{"remainingMl":900,"redLineYRatio":0.42,"confidence":0.8}\n' + "```";
    const out = parseModelResponse(txt, 1500);
    expect(out.remainingMl).toBe(900);
    expect(out.consumedMl).toBe(600);
    expect(out.redLineYRatio).toBeCloseTo(0.42);
  });
  it("clamps remaining to capacity", () => {
    const out = parseModelResponse('{"remainingMl":2000,"redLineYRatio":0.1,"confidence":0.5}', 1500);
    expect(out.remainingMl).toBe(1500);
    expect(out.consumedMl).toBe(0);
  });
  it("throws on invalid JSON", () => {
    expect(() => parseModelResponse("not json at all", 1500)).toThrow();
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

Add zod: `pnpm --filter worker add zod`.

`worker/src/prompt/bottle-reference.ts`:
```ts
import { BOTTLE_1_5L } from "@afia/shared";
export const BOTTLE_REFERENCE_TEXT_1_5L = `
You are inspecting an Afia 1.5L cooking oil bottle, photographed from the front.
Bottle facts:
- Total capacity: ${BOTTLE_1_5L.capacityMl} ml.
- The fillable cylindrical region spans roughly y=${BOTTLE_1_5L.fillTopY} (just below the shoulder) to y=${BOTTLE_1_5L.fillBottomY} (just above the base) within the bottle's vertical bounding box, where y=0 is the cap and y=1 is the base.
- Oil is golden/amber and translucent. The meniscus (oil surface) is a horizontal line.
- Ignore label graphics, reflections, and the air gap above the meniscus.
`.trim();
```

`worker/src/prompt/system-prompt.ts`:
```ts
import { BOTTLE_REFERENCE_TEXT_1_5L } from "./bottle-reference.js";

export function buildSystemPrompt(): string {
  return [
    BOTTLE_REFERENCE_TEXT_1_5L,
    "",
    "Task: Estimate the REMAINING oil volume in milliliters and the vertical position of the oil surface.",
    "Output a single JSON object — no prose, no markdown — with keys:",
    `  "remainingMl": integer 0..1500`,
    `  "redLineYRatio": number 0..1 (0=cap, 1=base; position of the oil meniscus inside the bottle bbox)`,
    `  "confidence": number 0..1`,
    "If you cannot identify a 1.5L Afia bottle from the front, return remainingMl=0 and confidence<=0.2.",
  ].join("\n");
}
```

`worker/src/prompt/parse-response.ts`:
```ts
import { z } from "zod";
import type { AnalysisResult } from "@afia/shared";

const Schema = z.object({
  remainingMl: z.number().finite(),
  redLineYRatio: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

export function parseModelResponse(
  raw: string,
  capacityMl: number
): Omit<AnalysisResult, "provider" | "rawModelText"> {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object found");
  const json = JSON.parse(candidate.slice(start, end + 1));
  const parsed = Schema.parse(json);
  const remaining = Math.max(0, Math.min(capacityMl, Math.round(parsed.remainingMl)));
  return {
    remainingMl: remaining,
    consumedMl: capacityMl - remaining,
    redLineYRatio: parsed.redLineYRatio,
    confidence: parsed.confidence,
  };
}
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(worker): prompt builder + strict zod response parser"
```

---

## Task 10: Gemini + Grok clients + orchestrator

**Files:**
- Create: `worker/src/llm/gemini.ts`, `worker/src/llm/grok.ts`, `worker/src/llm/orchestrator.ts`
- Test: `worker/test/orchestrator.test.ts`

- [ ] **Step 1: Write the failing test**

`worker/test/orchestrator.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { runAnalysis } from "../src/llm/orchestrator.js";

describe("runAnalysis orchestrator", () => {
  it("returns Gemini result when first key succeeds", async () => {
    const gemini = vi.fn().mockResolvedValue("{\"remainingMl\":900,\"redLineYRatio\":0.4,\"confidence\":0.9}");
    const grok = vi.fn();
    const out = await runAnalysis({ imageBase64: "AAAA", capacityMl: 1500 }, {
      geminiKeys: ["k1", "k2"], grokKey: "g", callGemini: gemini, callGrok: grok,
    });
    expect(out.provider).toBe("gemini");
    expect(out.remainingMl).toBe(900);
    expect(gemini).toHaveBeenCalledTimes(1);
    expect(grok).not.toHaveBeenCalled();
  });
  it("rotates on 429 then falls back to Grok if all keys cooled", async () => {
    const gemini = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("429"), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error("429"), { status: 429 }));
    const grok = vi.fn().mockResolvedValue("{\"remainingMl\":300,\"redLineYRatio\":0.7,\"confidence\":0.6}");
    const out = await runAnalysis({ imageBase64: "AAAA", capacityMl: 1500 }, {
      geminiKeys: ["k1", "k2"], grokKey: "g", callGemini: gemini, callGrok: grok,
    });
    expect(out.provider).toBe("grok");
    expect(out.remainingMl).toBe(300);
    expect(gemini).toHaveBeenCalledTimes(2);
    expect(grok).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

`worker/src/llm/gemini.ts`:
```ts
import { buildSystemPrompt } from "../prompt/system-prompt.js";

export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

const MODEL = "gemini-2.5-flash";

export async function callGemini(args: { apiKey: string; imageBase64: string }): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(args.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: buildSystemPrompt() },
          { inline_data: { mime_type: "image/jpeg", data: args.imageBase64 } },
        ],
      }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new HttpError(res.status, await res.text());
  const j: any = await res.json();
  const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n");
  if (!txt) throw new Error("empty Gemini response");
  return txt;
}
```

`worker/src/llm/grok.ts`:
```ts
import { buildSystemPrompt } from "../prompt/system-prompt.js";
import { HttpError } from "./gemini.js";

const MODEL = "grok-2-vision-1212";

export async function callGrok(args: { apiKey: string; imageBase64: string }): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${args.apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: [
          { type: "text", text: buildSystemPrompt() },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${args.imageBase64}` } },
        ],
      }],
    }),
  });
  if (!res.ok) throw new HttpError(res.status, await res.text());
  const j: any = await res.json();
  const txt = j?.choices?.[0]?.message?.content;
  if (!txt) throw new Error("empty Grok response");
  return txt;
}
```

`worker/src/llm/orchestrator.ts`:
```ts
import type { AnalysisResult } from "@afia/shared";
import { KeyPool } from "./rotation.js";
import { parseModelResponse } from "../prompt/parse-response.js";

export interface OrchestratorDeps {
  geminiKeys: string[];
  grokKey: string;
  callGemini: (args: { apiKey: string; imageBase64: string }) => Promise<string>;
  callGrok: (args: { apiKey: string; imageBase64: string }) => Promise<string>;
}

const COOLDOWN_MS = 60_000;

export async function runAnalysis(
  input: { imageBase64: string; capacityMl: number },
  deps: OrchestratorDeps
): Promise<AnalysisResult> {
  const pool = new KeyPool(deps.geminiKeys);
  let lastErr: unknown;
  // Try each Gemini key once
  for (let i = 0; i < deps.geminiKeys.length; i++) {
    const key = pool.next();
    if (!key) break;
    try {
      const raw = await deps.callGemini({ apiKey: key, imageBase64: input.imageBase64 });
      const parsed = parseModelResponse(raw, input.capacityMl);
      return { ...parsed, provider: "gemini", rawModelText: raw };
    } catch (e: any) {
      lastErr = e;
      if (e?.status === 429 || e?.status === 503) pool.markRateLimited(key, COOLDOWN_MS);
      else continue;
    }
  }
  // Fallback to Grok
  if (deps.grokKey) {
    const raw = await deps.callGrok({ apiKey: deps.grokKey, imageBase64: input.imageBase64 });
    const parsed = parseModelResponse(raw, input.capacityMl);
    return { ...parsed, provider: "grok", rawModelText: raw };
  }
  throw lastErr ?? new Error("all providers failed");
}
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(worker): LLM orchestrator (Gemini multi-key + Grok fallback)"
```

---

## Task 11: Wire orchestrator into `/api/analyze` + persist to Supabase

**Files:**
- Create: `worker/src/storage/supabase.ts`
- Modify: `worker/src/routes/analyze.ts`
- Test: extend `worker/test/analyze.test.ts`
- Add dep: `@supabase/supabase-js`

- [ ] **Step 1: Add the failing test (mock fetch)**

Append to `worker/test/analyze.test.ts`:
```ts
import { vi } from "vitest";

describe("POST /api/analyze happy path (mocked Gemini)", () => {
  it("returns parsed result", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes("generativelanguage.googleapis.com")) {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"remainingMl":900,"redLineYRatio":0.42,"confidence":0.88}' }] } }]
        }), { status: 200 });
      }
      if (u.includes("supabase")) return new Response("{}", { status: 200 });
      return new Response("nope", { status: 404 });
    });
    const res = await SELF.fetch("https://x/api/analyze", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "AAAA" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.remainingMl).toBe(900);
    expect(body.consumedMl).toBe(600);
    fetchSpy.mockRestore();
  });
});
```

Provide test secrets via `worker/vitest.config.ts`:
```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
export default defineWorkersConfig({
  test: { poolOptions: { workers: { wrangler: { configPath: "./wrangler.jsonc" }, miniflare: {
    bindings: {
      GEMINI_API_KEYS: "test-key-1,test-key-2",
      GROK_API_KEY: "test-grok",
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_SERVICE_KEY: "test-service",
      ADMIN_TOKEN: "admin-test",
    },
  } } } },
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement Supabase write + wire orchestrator**

`worker/src/storage/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import type { AnalysisResult } from "@afia/shared";
import type { Env } from "../env.js";

export function supa(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function persistAnalysis(env: Env, args: {
  imageBase64: string; bottleSize: string; result: AnalysisResult;
}): Promise<{ id: string; imageUrl: string }> {
  const client = supa(env);
  const id = crypto.randomUUID();
  const path = `analyses/${id}.jpg`;
  const bytes = Uint8Array.from(atob(args.imageBase64), (c) => c.charCodeAt(0));
  const { error: upErr } = await client.storage.from("bottle-images").upload(path, bytes, {
    contentType: "image/jpeg", upsert: false,
  });
  if (upErr) throw upErr;
  const { data: pub } = client.storage.from("bottle-images").getPublicUrl(path);
  const imageUrl = pub.publicUrl;
  const { error: insErr } = await client.from("analyses").insert({
    id, bottle_size: args.bottleSize, image_url: imageUrl,
    remaining_ml: args.result.remainingMl, consumed_ml: args.result.consumedMl,
    red_line_y_ratio: args.result.redLineYRatio, confidence: args.result.confidence,
    provider: args.result.provider, raw_model_text: args.result.rawModelText,
  });
  if (insErr) throw insErr;
  return { id, imageUrl };
}
```

Add dep: `pnpm --filter worker add @supabase/supabase-js`.

Replace `worker/src/routes/analyze.ts`:
```ts
import { Hono } from "hono";
import type { Env } from "../env.js";
import { runAnalysis } from "../llm/orchestrator.js";
import { callGemini } from "../llm/gemini.js";
import { callGrok } from "../llm/grok.js";
import { parseKeys } from "../llm/rotation.js";
import { persistAnalysis } from "../storage/supabase.js";
import { BOTTLE_1_5L } from "@afia/shared";

export const analyze = new Hono<{ Bindings: Env }>();

analyze.post("/", async (c) => {
  const body = await c.req.json().catch(() => null) as { bottleSize?: string; imageBase64?: string } | null;
  if (!body?.bottleSize || !body.imageBase64) return c.json({ error: "missing fields" }, 400);
  if (body.bottleSize !== "1.5L") return c.json({ error: "unsupported bottle size" }, 400);

  try {
    const result = await runAnalysis(
      { imageBase64: body.imageBase64, capacityMl: BOTTLE_1_5L.capacityMl },
      {
        geminiKeys: parseKeys(c.env.GEMINI_API_KEYS),
        grokKey: c.env.GROK_API_KEY,
        callGemini, callGrok,
      },
    );
    let persisted: { id?: string; imageUrl?: string } = {};
    try {
      persisted = await persistAnalysis(c.env, {
        imageBase64: body.imageBase64, bottleSize: body.bottleSize, result,
      });
    } catch (e) {
      console.error("supabase persist failed", e);
    }
    return c.json({ ...result, ...persisted });
  } catch (e: any) {
    console.error("analyze failed", e);
    return c.json({ error: "analysis failed", detail: String(e?.message ?? e) }, 502);
  }
});
```

Persisting failure must NOT block returning the result to the user.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(worker): wire LLM orchestrator + Supabase persist into analyze"
```

---

## Task 12: Supabase schema migration

**Files:**
- Create: `worker/migrations/001_init.sql` (run manually in Supabase SQL editor)

- [ ] **Step 1: Author migration**

`worker/migrations/001_init.sql`:
```sql
create extension if not exists pgcrypto;

create table if not exists analyses (
  id uuid primary key,
  created_at timestamptz default now() not null,
  bottle_size text not null,
  image_url text not null,
  remaining_ml integer not null,
  consumed_ml integer not null,
  red_line_y_ratio double precision not null,
  confidence double precision not null,
  provider text not null,
  raw_model_text text,
  admin_flag text check (admin_flag in ('too_big','too_small','manual')),
  admin_corrected_remaining_ml integer,
  admin_note text
);

-- Storage bucket must be created manually in Supabase UI:
-- name: bottle-images, public: true
```

- [ ] **Step 2: Document the manual steps**

Add a section to `worker/wrangler.jsonc` comments or `docs/supabase-setup.md`:
```
1. Create Supabase project
2. Storage → New bucket → name "bottle-images", public read
3. SQL Editor → paste 001_init.sql → run
4. Project Settings → API → copy URL + service_role key
5. wrangler secret put SUPABASE_URL / SUPABASE_SERVICE_KEY
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(db): initial Supabase schema for analyses"
```

---

## Task 13: Result page — image with red line + consumed/remaining text

**Files:**
- Create: `web/src/pages/Result.tsx`, `web/src/lib/api.ts`
- Modify: `web/src/App.tsx`
- Test: `web/test/Result.test.tsx`

- [ ] **Step 1: Write the failing test**

`web/test/Result.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Result } from "../src/pages/Result";

beforeEach(() => {
  sessionStorage.setItem("afia.capture", btoa("\x00\x00\x00"));
  sessionStorage.setItem("afia.size", "1.5L");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
    remainingMl: 900, consumedMl: 600, redLineYRatio: 0.42, confidence: 0.9, provider: "gemini",
  }), { status: 200 }));
});

describe("Result", () => {
  it("shows consumed and remaining text, and a red line overlay", async () => {
    render(<MemoryRouter><Result /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/600 ?ml/)).toBeInTheDocument());
    expect(screen.getByText(/900 ?ml/)).toBeInTheDocument();
    expect(document.querySelector("[data-testid='red-line']")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

`web/src/lib/api.ts`:
```ts
import type { AnalysisResult } from "@afia/shared";

export async function postAnalyze(body: { bottleSize: string; imageBase64: string }): Promise<AnalysisResult & { id?: string; imageUrl?: string }> {
  const res = await fetch("/api/analyze", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
  return res.json();
}
```

`web/src/pages/Result.tsx`:
```tsx
import { useEffect, useState } from "react";
import type { AnalysisResult } from "@afia/shared";
import { postAnalyze } from "../lib/api";
import { useI18n } from "../i18n";
import { OilSlider } from "../components/OilSlider";

export function Result() {
  const { t } = useI18n();
  const [imgB64] = useState(() => sessionStorage.getItem("afia.capture") ?? "");
  const [size] = useState(() => sessionStorage.getItem("afia.size") ?? "1.5L");
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!imgB64) { setErr("no image"); return; }
    postAnalyze({ bottleSize: size, imageBase64: imgB64 }).then(setData).catch((e) => setErr(e.message));
  }, [imgB64, size]);

  if (err) return <div className="p-6 text-center text-red-600">{err}</div>;
  if (!data) return <div className="p-6 text-center">Analyzing…</div>;

  const dataUrl = `data:image/jpeg;base64,${imgB64}`;

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="relative inline-block">
        <img src={dataUrl} className="w-full rounded" alt="captured bottle" />
        <div
          data-testid="red-line"
          className="absolute left-0 right-0 h-0.5 bg-red-500"
          style={{ top: `${data.redLineYRatio * 100}%` }}
        />
      </div>
      <div className="mt-3 text-center">
        <div>{t("result.consumed")}: <b>{data.consumedMl} ml</b></div>
        <div>{t("result.remaining")}: <b>{data.remainingMl} ml</b></div>
      </div>
      <div className="mt-4">
        <OilSlider remainingMl={data.remainingMl} redLineYRatio={data.redLineYRatio} />
      </div>
    </div>
  );
}
```

Wire route. (`OilSlider` is implemented next; the import will fail until Task 14 — write a stub component to keep tests green for now or implement Tasks 14/15 first if you prefer. For order safety, also create a stub:)

`web/src/components/OilSlider.tsx` (stub):
```tsx
export function OilSlider(_props: { remainingMl: number; redLineYRatio: number }) {
  return <div data-testid="oil-slider-stub" />;
}
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): result page with red-line overlay and ml summary"
```

---

## Task 14: Cup math (`ml-to-cups`)

**Files:**
- Create: `web/src/lib/cups.ts`
- Test: `web/test/cups.test.ts`

- [ ] **Step 1: Write the failing test**

`web/test/cups.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mlToCups } from "../src/lib/cups";

describe("mlToCups", () => {
  it("0 ml → 0 whole, 0 fraction", () => {
    expect(mlToCups(0)).toEqual({ whole: 0, fraction: 0 });
  });
  it("55 ml → 1/4 cup", () => {
    expect(mlToCups(55)).toEqual({ whole: 0, fraction: 1 });
  });
  it("110 ml → 1/2 cup", () => {
    expect(mlToCups(110)).toEqual({ whole: 0, fraction: 2 });
  });
  it("220 ml → 1 whole cup", () => {
    expect(mlToCups(220)).toEqual({ whole: 1, fraction: 0 });
  });
  it("275 ml → 1 whole + 1/4", () => {
    expect(mlToCups(275)).toEqual({ whole: 1, fraction: 1 });
  });
  it("rounds to nearest 55 ml step", () => {
    expect(mlToCups(54)).toEqual({ whole: 0, fraction: 0 });   // floor by step
    expect(mlToCups(109)).toEqual({ whole: 0, fraction: 1 });
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

`web/src/lib/cups.ts`:
```ts
import { ML_PER_CUP_QUARTER } from "@afia/shared";

export interface Cups { whole: number; fraction: 0 | 1 | 2 | 3 } // 0=full, 1=¼, 2=½, 3=¾

export function mlToCups(ml: number): Cups {
  const steps = Math.floor(Math.max(0, ml) / ML_PER_CUP_QUARTER); // each step = 55ml = ¼ cup
  const whole = Math.floor(steps / 4);
  const fraction = (steps % 4) as 0 | 1 | 2 | 3;
  return { whole, fraction };
}
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): cup math helper (55ml steps, ¼/½/¾/whole)"
```

---

## Task 15: `OilSlider` component (55 ml steps, clamp to last partial)

**Files:**
- Replace stub: `web/src/components/OilSlider.tsx`
- Create: `web/src/components/CupCounter.tsx`
- Test: `web/test/OilSlider.test.tsx`, `web/test/CupCounter.test.tsx`

- [ ] **Step 1: Write the failing tests**

`web/test/CupCounter.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CupCounter } from "../src/components/CupCounter";

describe("CupCounter", () => {
  it("displays '1' with quarter cup at 275 ml consumed", () => {
    render(<CupCounter consumedMl={275} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByTestId("cup")).toHaveAttribute("data-fraction", "1"); // ¼
  });
  it("displays '0' with full empty cup at 0 ml", () => {
    render(<CupCounter consumedMl={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByTestId("cup")).toHaveAttribute("data-fraction", "0");
  });
});
```

`web/test/OilSlider.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OilSlider } from "../src/components/OilSlider";

describe("OilSlider", () => {
  it("starts at the red line and reports 0 consumed-from-here", () => {
    render(<OilSlider remainingMl={900} redLineYRatio={0.42} />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "900");
  });
  it("clamps last step when remainder < 55ml", () => {
    render(<OilSlider remainingMl={120} redLineYRatio={0.5} />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "110" } }); // 2 steps × 55 = 110, last partial 10ml is unreachable beyond
    expect(slider).toHaveAttribute("aria-valuenow", "110");
  });
  it("steps in 55 ml increments", () => {
    render(<OilSlider remainingMl={900} redLineYRatio={0.4} />);
    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.step).toBe("55");
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

`web/src/components/CupCounter.tsx`:
```tsx
import { mlToCups } from "../lib/cups";

const FRACTION_LABEL: Record<number, string> = { 0: "FULL", 1: "¼", 2: "½", 3: "¾" };

export function CupCounter({ consumedMl }: { consumedMl: number }) {
  const { whole, fraction } = mlToCups(consumedMl);
  return (
    <div className="flex items-center gap-3">
      <div data-testid="cup" data-fraction={fraction}
        className="w-16 h-20 border-2 border-current rounded-b-lg relative overflow-hidden">
        <div
          className="absolute left-0 right-0 bottom-0 bg-amber-500"
          style={{ height: fraction === 0 && whole > 0 ? "100%" : `${(fraction / 4) * 100}%` }}
        />
      </div>
      <div className="text-3xl font-semibold">{whole}</div>
      <div className="text-sm opacity-70">{fraction === 0 ? (whole > 0 ? "cups" : "cup") : `${FRACTION_LABEL[fraction]} cup`}</div>
    </div>
  );
}
```

`web/src/components/OilSlider.tsx`:
```tsx
import { useState } from "react";
import { ML_PER_CUP_QUARTER } from "@afia/shared";
import { CupCounter } from "./CupCounter";

type Props = { remainingMl: number; redLineYRatio: number };

export function OilSlider({ remainingMl }: Props) {
  // Slider value = ml the user has "scrolled past" from the red line, capped to last 55-ml step.
  const maxStepped = Math.floor(remainingMl / ML_PER_CUP_QUARTER) * ML_PER_CUP_QUARTER;
  // If remainder < 55ml, max is 0 (cannot reach a step). Show the slider regardless.
  const max = maxStepped;
  const [val, setVal] = useState(0);
  return (
    <div className="flex gap-4 items-stretch">
      <input
        type="range"
        min={0}
        max={Math.max(max, ML_PER_CUP_QUARTER)} /* never collapse to 0-width */
        step={ML_PER_CUP_QUARTER}
        value={val}
        aria-valuemin={0}
        aria-valuemax={remainingMl}
        aria-valuenow={val}
        onChange={(e) => {
          const v = Math.min(max, Number(e.target.value));
          setVal(v);
        }}
        className="vertical-slider h-48"
        style={{ writingMode: "vertical-lr" as any, direction: "rtl" }}
      />
      <CupCounter consumedMl={val} />
    </div>
  );
}
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): vertical 55ml-step slider + cup counter"
```

---

## Task 16: Admin auth header + review queue list

**Files:**
- Create: `worker/src/routes/admin.ts`
- Modify: `worker/src/index.ts`
- Create: `web/src/pages/admin/ReviewQueue.tsx`
- Modify: `web/src/App.tsx`, `web/src/lib/api.ts`
- Test: `worker/test/admin.test.ts`

- [ ] **Step 1: Write the failing test**

`worker/test/admin.test.ts`:
```ts
import { SELF } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";

describe("admin auth", () => {
  it("403 without admin token", async () => {
    const res = await SELF.fetch("https://x/api/admin/analyses");
    expect(res.status).toBe(403);
  });
  it("returns list with valid token (Supabase mocked)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "abc", remaining_ml: 900 }]), { status: 200 })
    );
    const res = await SELF.fetch("https://x/api/admin/analyses", {
      headers: { "x-admin-token": "admin-test" },
    });
    expect(res.status).toBe(200);
    const j = await res.json() as any;
    expect(Array.isArray(j)).toBe(true);
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement**

`worker/src/routes/admin.ts`:
```ts
import { Hono } from "hono";
import type { Env } from "../env.js";
import { supa } from "../storage/supabase.js";

export const admin = new Hono<{ Bindings: Env }>();

admin.use("*", async (c, next) => {
  if (c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) return c.json({ error: "forbidden" }, 403);
  await next();
});

admin.get("/analyses", async (c) => {
  const client = supa(c.env);
  const { data, error } = await client.from("analyses").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

admin.post("/analyses/:id/correction", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json() as { flag: "too_big" | "too_small" | "manual"; correctedRemainingMl?: number; note?: string };
  const client = supa(c.env);
  const { error } = await client.from("analyses").update({
    admin_flag: body.flag,
    admin_corrected_remaining_ml: body.correctedRemainingMl ?? null,
    admin_note: body.note ?? null,
  }).eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});
```

`worker/src/index.ts`:
```ts
import { admin } from "./routes/admin.js";
app.route("/api/admin", admin);
```

`web/src/pages/admin/ReviewQueue.tsx`:
```tsx
import { useEffect, useState } from "react";

export function ReviewQueue() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    const tok = localStorage.getItem("admin_token") ?? "";
    fetch("/api/admin/analyses", { headers: { "x-admin-token": tok } })
      .then((r) => r.json()).then(setRows);
  }, []);
  return (
    <div className="p-4 space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="border rounded p-3 flex gap-3">
          <img src={r.image_url} className="w-24 h-32 object-cover rounded" />
          <div className="text-sm">
            <div>id: {r.id.slice(0, 8)}</div>
            <div>remaining: {r.remaining_ml} ml</div>
            <div>confidence: {r.confidence?.toFixed?.(2)}</div>
            <div>provider: {r.provider}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Wire route under `/admin/review`.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): token-gated review queue"
```

---

## Task 17: Admin correction actions + manual upload

**Files:**
- Create: `web/src/pages/admin/ReviewDetail.tsx`, `web/src/pages/admin/ManualUpload.tsx`
- Add: `worker/src/routes/admin.ts` POST `/upload`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Add Worker upload endpoint test**

Append to `worker/test/admin.test.ts`:
```ts
it("admin upload requires fields", async () => {
  const res = await SELF.fetch("https://x/api/admin/upload", {
    method: "POST", headers: { "content-type": "application/json", "x-admin-token": "admin-test" }, body: "{}",
  });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement upload route**

Append to `worker/src/routes/admin.ts`:
```ts
admin.post("/upload", async (c) => {
  const body = await c.req.json().catch(() => null) as
    | { imageBase64: string; bottleSize: "1.5L"; groundTruthRemainingMl: number; note?: string }
    | null;
  if (!body?.imageBase64 || !body.bottleSize || typeof body.groundTruthRemainingMl !== "number")
    return c.json({ error: "missing fields" }, 400);
  const id = crypto.randomUUID();
  const path = `manual/${id}.jpg`;
  const client = supa(c.env);
  const bytes = Uint8Array.from(atob(body.imageBase64), (ch) => ch.charCodeAt(0));
  await client.storage.from("bottle-images").upload(path, bytes, { contentType: "image/jpeg" });
  const { data: pub } = client.storage.from("bottle-images").getPublicUrl(path);
  const { error } = await client.from("analyses").insert({
    id, bottle_size: body.bottleSize, image_url: pub.publicUrl,
    remaining_ml: body.groundTruthRemainingMl,
    consumed_ml: (body.bottleSize === "1.5L" ? 1500 : 2500) - body.groundTruthRemainingMl,
    red_line_y_ratio: 0, confidence: 1, provider: "admin",
    admin_flag: "manual", admin_corrected_remaining_ml: body.groundTruthRemainingMl, admin_note: body.note ?? null,
  });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ id });
});
```

- [ ] **Step 4: Implement admin UIs**

`web/src/pages/admin/ReviewDetail.tsx`:
```tsx
import { useState } from "react";
import { useParams } from "react-router-dom";

export function ReviewDetail() {
  const { id } = useParams();
  const [note, setNote] = useState("");
  const [corrected, setCorrected] = useState<number | "">("");
  const send = async (flag: "too_big" | "too_small" | "manual") => {
    const tok = localStorage.getItem("admin_token") ?? "";
    await fetch(`/api/admin/analyses/${id}/correction`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": tok },
      body: JSON.stringify({ flag, correctedRemainingMl: corrected === "" ? undefined : corrected, note }),
    });
  };
  return (
    <div className="p-4 space-y-2 max-w-md">
      <div className="flex gap-2">
        <button className="px-3 py-1 bg-red-200" onClick={() => send("too_big")}>Too big</button>
        <button className="px-3 py-1 bg-yellow-200" onClick={() => send("too_small")}>Too small</button>
      </div>
      <input className="border p-1 w-full" type="number" placeholder="Corrected ml"
        value={corrected} onChange={(e) => setCorrected(e.target.value === "" ? "" : Number(e.target.value))} />
      <textarea className="border p-1 w-full" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="px-3 py-1 bg-green-300" onClick={() => send("manual")}>Save manual correction</button>
    </div>
  );
}
```

`web/src/pages/admin/ManualUpload.tsx`:
```tsx
import { useState } from "react";

export function ManualUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [ml, setMl] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const submit = async () => {
    if (!file || ml === "") { setStatus("missing"); return; }
    const buf = await file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const tok = localStorage.getItem("admin_token") ?? "";
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": tok },
      body: JSON.stringify({ imageBase64: b64, bottleSize: "1.5L", groundTruthRemainingMl: Number(ml), note }),
    });
    setStatus(res.ok ? "uploaded" : `error ${res.status}`);
  };

  return (
    <div className="p-4 space-y-2 max-w-md">
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <input className="border p-1 w-full" type="number" placeholder="Remaining ml (ground truth)"
        value={ml} onChange={(e) => setMl(e.target.value === "" ? "" : Number(e.target.value))} />
      <textarea className="border p-1 w-full" placeholder="Notes" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={submit}>Upload</button>
      {status && <div className="text-sm">{status}</div>}
    </div>
  );
}
```

Wire routes:
```tsx
<Route path="review" element={<ReviewQueue />} />
<Route path="review/:id" element={<ReviewDetail />} />
<Route path="upload" element={<ManualUpload />} />
```

- [ ] **Step 5: Run all tests** — PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(admin): correction actions + manual training upload"
```

---

## Task 18: Deploy + smoke test

**Files:**
- Modify: `worker/wrangler.jsonc` (no change needed if tasks above complete)
- Optional: `e2e/smoke.spec.ts` (Playwright)

- [ ] **Step 1: Set secrets**

```bash
cd worker
wrangler secret put GEMINI_API_KEYS
wrangler secret put GROK_API_KEY
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put ADMIN_TOKEN
```

- [ ] **Step 2: Build + deploy**

```bash
pnpm --filter web build
pnpm --filter worker deploy
```

Expected: Wrangler outputs the deployed URL (e.g. `https://afia-stage1.<account>.workers.dev`).

- [ ] **Step 3: Smoke test on a real phone**

Generate a 1.5L QR via `/admin/qr`, scan with the phone camera, verify:
- `/scan?size=1.5L` redirects to `/capture`
- Camera opens, outline visible, capture works
- Result page renders red line and ml values
- Row appears in `/admin/review`

- [ ] **Step 4: Commit any deploy fixes**

```bash
git commit -am "chore: stage 1 deploy adjustments" || true
```

---

## Self-Review Notes

**Coverage check (spec → task):**
1. Scan QR (mock, 1.5L + 2.5L) → Task 3
2. Open Cloudflare-deployed link → Tasks 1, 18
3. Camera opens, front-side text, static outline laid out around floating buttons + capture button → Tasks 2, 5, 6
4. Quality detection → **deferred** (explicitly out of Stage 1 scope)
5. LLM analysis (Gemini multi-key + Grok fallback, prompt + reference, persist for training) → Tasks 7–12
6. Result with red line, slider in 55 ml steps clamped to last partial, cup counter (¼/½/¾/full + whole number) → Tasks 13–15
7. Admin review with too-big/too-small flags + manual correction + manual upload → Tasks 16–17
8. Two-stage strategy → Stage 1 only here; Stage 2 (local model) explicitly excluded

**Type consistency:** `AnalysisResult` in `@afia/shared` is the single source of truth used by Worker, parser, and Result page. `ML_PER_CUP_QUARTER` (55 ml) is shared across slider, cup counter, and tests. `BOTTLE_1_5L.capacityMl` (1500) is used by orchestrator clamp + admin upload `consumed_ml` derivation.

**Auto-lock + 2.5L analysis** are intentional Stage-1 omissions; the QR generator already produces 2.5L codes so the QR sticker artwork can ship while the analyzer rejects 2.5L until Stage 2.
