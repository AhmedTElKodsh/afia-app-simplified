export interface StageLog {
  stage: string;
  latencyMs: number;
  confidence: number;
  decision?: string;
  error?: string;
}

/**
 * Log a pipeline stage to console only (no shared mutable state).
 * Cloudflare Workers may handle concurrent requests — module-level arrays
 * would race. Each request's async chain is consistent for console.log.
 */
export function logStage(stage: string, latencyMs: number, confidence: number, decision?: string, error?: string): void {
  console.log(JSON.stringify({ event: "cv_pipeline_stage", stage, latencyMs, confidence, decision, error }));
}

export function logSummary(stages: StageLog[]): void {
  const totalMs = stages.reduce((sum, l) => sum + l.latencyMs, 0);
  console.log(JSON.stringify({
    event: "cv_pipeline_summary",
    stageCount: stages.length,
    totalLatencyMs: totalMs,
    stageDetails: stages,
  }));
}
