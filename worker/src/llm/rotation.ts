import type { Env } from "../env.js";

export function buildGeminiKeyPool(env: Env): string[] {
  return buildKeyPool([
    ...splitKeys(env.GEMINI_API_KEYS),
    ...splitKeys(env.GEMINI_API_KEYS2),
    ...splitKeys(env.GEMINI_API_KEYS3),
    ...splitKeys(env.GEMINI_API_KEYS4),
    env.GEMINI_API_KEY,
    env.GEMINI_API_KEY2,
    env.GEMINI_API_KEY3,
    env.GEMINI_API_KEY4,
  ]);
}

export function buildOpenRouterKeyPool(env: Env): string[] {
  return buildKeyPool([
    ...splitKeys(env.OPENROUTER_API_KEYS),
    env.OPENROUTER_API_KEY,
    env.OPENROUTER_API_KEY2,
    env.OPENROUTER_API_KEY3,
    env.OPENROUTER_API_KEY4,
  ]);
}

export function buildGrokKeyPool(env: Env): string[] {
  return buildKeyPool([
    ...splitKeys(env.GROK_API_KEYS),
    env.GROK_API_KEY,
    env.GROK_API_KEY2,
    env.GROK_API_KEY3,
    env.GROK_API_KEY4,
  ]);
}

export function selectGeminiKey(keys: string[], attempt: number): string {
  return selectKey(keys, attempt);
}

export function selectKey(keys: string[], attempt: number): string {
  if (keys.length === 0) throw new Error("No API keys configured");
  return keys[attempt % keys.length];
}

function splitKeys(value: string | undefined): string[] {
  return value?.split(",").map((key) => key.trim()).filter(Boolean) ?? [];
}

function buildKeyPool(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}
