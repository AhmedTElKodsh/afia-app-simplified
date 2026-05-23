import type { FewShot } from "../prompt/load.js";
import { geminiVisualEvidenceSchema } from "./visual-evidence-schema.js";

export interface GeminiReferenceImage {
  label: string;
  mimeType: string;
  data: string;
}

interface CallArgs {
  apiKey: string;
  modelId: string;
  systemText: string;
  userText: string;
  fewShots: FewShot[];
  imageBase64: string;
  referenceImages?: GeminiReferenceImage[];
  targetMimeType?: string;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRetryDelayMs(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const maybeError = error as { errorDetails?: Array<Record<string, unknown>>; message?: string };

  for (const detail of maybeError.errorDetails ?? []) {
    if (detail["@type"] !== "type.googleapis.com/google.rpc.RetryInfo") continue;
    const retryDelay = detail.retryDelay;
    if (typeof retryDelay === "string") {
      const match = retryDelay.match(/^(\d+)(?:\.(\d+))?s$/);
      if (!match) continue;
      const seconds = Number(match[1]);
      const fractionalMs = match[2] ? Number(`0.${match[2]}`) * 1000 : 0;
      return Math.ceil(seconds * 1000 + fractionalMs);
    }
  }

  const message = maybeError.message ?? "";
  const fallbackMatch = message.match(/Please retry in\s+([\d.]+)s/i);
  if (fallbackMatch) {
    return Math.ceil(Number(fallbackMatch[1]) * 1000);
  }

  return null;
}

function isRetryableQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { status?: number; message?: string };
  return maybeError.status === 429 || /quota exceeded|too many requests|rate limit/i.test(maybeError.message ?? "");
}

export async function callGemini(args: CallArgs): Promise<string> {
  const referenceLabels = args.fewShots
    .map((shot, i) => {
      const imageLabel = args.referenceImages?.[i]?.label;
      const prefix = imageLabel ? `Reference image ${i + 1}: ${imageLabel}` : `Reference ${i + 1}`;
      return `${prefix}; known remaining ${shot.expected.nearestReferenceMl}ml; expected oil surface y=${Math.round(shot.expected.oilSurfaceYRatio * 1000)}/1000`;
    })
    .join("\n");

  const parts: GeminiPart[] = [
    ...(args.referenceImages ?? []).map((image) => ({
      inline_data: { mime_type: image.mimeType, data: image.data },
    })),
    { inline_data: { mime_type: args.targetMimeType ?? "image/jpeg", data: args.imageBase64 } },
    {
      text: [
        args.userText,
        referenceLabels ? `\nCalibrated reference images:\n${referenceLabels}` : "",
        "\nThe target image is the final image before these instructions. Return exactly one JSON object matching schemaVersion afia_visual_evidence_v1.",
      ].join("\n"),
    },
  ];

  const maxAttempts = args.maxAttempts ?? 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fetchGemini(args.apiKey, args.modelId, {
        systemInstruction: { parts: [{ text: args.systemText }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
          responseSchema: geminiVisualEvidenceSchema(),
        },
      });
      return readGeminiText(result);
    } catch (error) {
      if (!isRetryableQuotaError(error) || attempt === maxAttempts) {
        throw error;
      }
      const retryDelayMs = extractRetryDelayMs(error) ?? attempt * (args.retryBaseDelayMs ?? 15000);
      await sleep(retryDelayMs + 1000);
    }
  }

  throw new Error("Gemini call failed after retries");
}

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

interface GeminiGenerateRequest {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: Array<{ role: "user"; parts: GeminiPart[] }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
  };
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

async function fetchGemini(apiKey: string, modelId: string, body: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const error = new Error(`Gemini API failed with ${response.status}: ${await response.text()}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<GeminiGenerateResponse>;
}

function readGeminiText(response: GeminiGenerateResponse): string {
  const text = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((value): value is string => Boolean(value))
    .join("");
  if (!text) throw new Error("Gemini response did not include text");
  return text;
}
