import { UserCorrectionRequestSchema } from "@afia/shared";
import type { Context } from "hono";
import type { Env } from "../env.js";
import { createAnalysisStorage } from "../storage/supabase.js";

type CorrectionBindings = { Bindings: Env };

export async function userCorrectionRoute(c: Context<CorrectionBindings>) {
  let body;
  try {
    body = UserCorrectionRequestSchema.parse(await c.req.json().catch(() => null));
  } catch {
    return c.json({ error: "Invalid user correction request" }, 400);
  }

  const record = await createAnalysisStorage(c.env).saveUserCorrection({
    id: c.req.param("id"),
    ...body,
  });
  return c.json({ analysis: record });
}
