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
