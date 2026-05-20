import { Hono } from "hono";
import type { Env } from "./env.js";
import { analyzeRoute } from "./routes/analyze.js";
import { exportDatasetRoute, listAnalysesRoute, manualUploadRoute, patchAnalysisRoute } from "./routes/admin.js";
import { userCorrectionRoute } from "./routes/correction.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.post("/api/analyze", analyzeRoute);
app.post("/api/analyses/:id/user-correction", userCorrectionRoute);
app.post("/api/cv-analyze", (c) => c.json({
  error: "CV diagnostics are disabled in the deployed Stage 1 Worker",
  reason: "The OpenCV bundle exceeds the free Worker size limit. Use local eval commands for CV/ONNX diagnostics.",
}, 501));
app.get("/api/admin/analyses", listAnalysesRoute);
app.patch("/api/admin/analyses/:id", patchAnalysisRoute);
app.post("/api/admin/upload", manualUploadRoute);
app.get("/api/admin/dataset/export", exportDatasetRoute);
app.get("/api/onnx-probe", (c) => c.json({
  error: "ONNX diagnostics are disabled in the deployed Stage 1 Worker",
  reason: "The ONNX runtime path is a local diagnostics surface during M005.",
}, 501));
app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.env.ASSETS?.fetch(c.req.raw) ?? c.json({ error: "Not found" }, 404);
});

export default app;
