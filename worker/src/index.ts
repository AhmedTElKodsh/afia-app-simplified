import { Hono } from "hono";
import type { Env } from "./env.js";
import { analyzeRoute } from "./routes/analyze.js";
import { listAnalysesRoute, manualUploadRoute, patchAnalysisRoute } from "./routes/admin.js";
import { onnxProbeRoute } from "./routes/onnx-probe.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.post("/api/analyze", analyzeRoute);
app.post("/api/cv-analyze", async (c) => {
  const { cvAnalyzeRoute } = await import("./routes/cv-analyze.js");
  return cvAnalyzeRoute(c);
});
app.get("/api/admin/analyses", listAnalysesRoute);
app.patch("/api/admin/analyses/:id", patchAnalysisRoute);
app.post("/api/admin/upload", manualUploadRoute);
app.get("/api/onnx-probe", onnxProbeRoute);
app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.env.ASSETS?.fetch(c.req.raw) ?? c.json({ error: "Not found" }, 404);
});

export default app;
