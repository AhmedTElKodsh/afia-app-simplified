import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { FewShot } from "../prompt/load.js";

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
  thinkingBudget?: number;
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
  const client = new GoogleGenerativeAI(args.apiKey);
  const model = client.getGenerativeModel({
    model: args.modelId,
    systemInstruction: args.systemText,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: args.thinkingBudget ?? 0 },
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          readingPossible: { type: SchemaType.BOOLEAN },
          meniscusVisible: { type: SchemaType.STRING, enum: ["yes", "no", "uncertain"] },
          oilSurfaceYRatio: { type: SchemaType.NUMBER },
          nearestReferenceMl: { type: SchemaType.NUMBER },
          qualityFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          confidence: { type: SchemaType.NUMBER },
        },
        required: [
          "readingPossible",
          "meniscusVisible",
          "oilSurfaceYRatio",
          "nearestReferenceMl",
          "qualityFlags",
          "confidence",
        ],
      },
    } as any,
  });

  const referenceLabels = (args.referenceImages ?? [])
    .map((image, i) => `Reference image ${i + 1}: ${image.label}`)
    .join("\n");

  const parts = [
    ...(args.referenceImages ?? []).map((image) => ({
      inlineData: { mimeType: image.mimeType, data: image.data },
    })),
    { inlineData: { mimeType: args.targetMimeType ?? "image/jpeg", data: args.imageBase64 } },
    {
      text: [
        args.userText,
        referenceLabels ? `\nCalibrated reference images:\n${referenceLabels}` : "",
        "\nThe target image is the final image before these instructions. Return JSON only.",
      ].join("\n"),
    },
  ];

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (error) {
      if (!isRetryableQuotaError(error) || attempt === maxAttempts) {
        throw error;
      }
      const retryDelayMs = extractRetryDelayMs(error) ?? attempt * 15000;
      await sleep(retryDelayMs + 1000);
    }
  }

  throw new Error("Gemini call failed after retries");
}
