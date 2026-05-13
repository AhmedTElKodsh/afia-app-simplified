import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

export interface Env {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  ADMIN_TOKEN?: string;
  GEMINI_API_KEY: string;
  GEMINI_API_KEYS?: string;
  GEMINI_API_KEY2?: string;
  GEMINI_API_KEY3?: string;
  GEMINI_API_KEY4?: string;
  GROK_API_KEY?: string;
  GROK_MODEL_ID?: string;
  HF_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL_ID?: string;
  MODEL_ID: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_STORAGE_BUCKET?: string;
  SUPABASE_URL?: string;
}

export function loadEnv(): Env {
  console.log(`[env] process.env keys: ${Object.keys(process.env).filter(k => k.includes("API_KEY") || k.includes("MODEL")).join(", ")}`);
  return {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    GEMINI_API_KEYS: process.env.GEMINI_API_KEYS,
    GEMINI_API_KEY2: process.env.GEMINI_API_KEY2,
    GEMINI_API_KEY3: process.env.GEMINI_API_KEY3,
    GEMINI_API_KEY4: process.env.GEMINI_API_KEY4,
    GROK_API_KEY: process.env.GROK_API_KEY,
    HF_API_KEY: process.env.HF_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL_ID: process.env.OPENROUTER_MODEL_ID,
    MODEL_ID: process.env.MODEL_ID ?? "gemini-2.5-flash",
  };
}
