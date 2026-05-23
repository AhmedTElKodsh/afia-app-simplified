import { openRouterVisualEvidenceResponseFormat } from "./visual-evidence-schema.js";
import type { FewShot } from "../prompt/load.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterReferenceImage {
  label: string;
  mimeType: string;
  data: string;
}

interface CallOpenRouterArgs {
  apiKey: string;
  modelId: string;
  systemText: string;
  userText: string;
  fewShots?: FewShot[];
  imageBase64: string;
  referenceImages?: OpenRouterReferenceImage[];
  targetMimeType?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export function isOpenRouterVisionModel(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  const baseId = id.replace(/:[a-z0-9_-]+$/, "");
  return id.includes("vision") ||
    id.includes("qwen-vl") ||
    id.includes("qwen2-vl") ||
    id.includes("qwen2.5-vl") ||
    id.includes("vl-") ||
    baseId.endsWith("-vl") ||
    id.includes("llava") ||
    id.includes("pixtral") ||
    id.includes("omni") ||
    id.includes("gemma-3") ||
    id.includes("gemma-4");
}

export async function callOpenRouter(args: CallOpenRouterArgs): Promise<string> {
  if (!isOpenRouterVisionModel(args.modelId)) {
    throw new Error(`OpenRouter model is not in the configured vision allowlist: ${args.modelId}`);
  }

  const fetcher = args.fetchImpl ?? fetch;
  const calibrationText = calibrationLines(args.fewShots ?? [], args.referenceImages ?? []);
  const userContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: "high" } }> = [
    ...(args.referenceImages ?? []).map((image) => ({
      type: "image_url" as const,
      image_url: { url: toDataUrl(image.data, image.mimeType), detail: "high" as const },
    })),
    {
      type: "image_url",
      image_url: {
        url: toDataUrl(args.imageBase64, args.targetMimeType ?? "image/jpeg"),
        detail: "high",
      },
    },
    {
      type: "text",
      text: [
        args.userText,
        calibrationText ? `\nCalibrated reference anchors:\n${calibrationText}` : "",
        "\nThe target image is the final image before these instructions. Return JSON only.",
      ].join("\n"),
    },
  ];

  const response = await fetcher(OPENROUTER_API_URL, {
    method: "POST",
    signal: timeoutSignal(args.timeoutMs ?? 30000),
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
      "http-referer": "https://github.com/afia-app/afia-app-simplified",
      "x-title": "Afia Bottle Analysis",
    },
    body: JSON.stringify({
      model: args.modelId,
      temperature: 0,
      max_tokens: 1024,
      response_format: openRouterVisualEvidenceResponseFormat(),
      messages: [
        { role: "system", content: args.systemText },
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API failed with ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter response did not include assistant content");
  return content;
}

function toDataUrl(imageBase64: string, mimeType: string): string {
  return imageBase64.startsWith("data:") ? imageBase64 : `data:${mimeType};base64,${imageBase64}`;
}

function calibrationLines(fewShots: FewShot[], referenceImages: OpenRouterReferenceImage[]): string {
  return fewShots
    .map((shot, i) => {
      const imageLabel = referenceImages[i]?.label;
      const prefix = imageLabel ? `Reference image ${i + 1}: ${imageLabel}` : `Reference ${i + 1}`;
      return `${prefix}; known remaining ${shot.expected.nearestReferenceMl}ml; expected oil surface y=${Math.round(shot.expected.oilSurfaceYRatio * 1000)}/1000`;
    })
    .join("\n");
}

function timeoutSignal(timeoutMs: number): AbortSignal | undefined {
  const timeout = (AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal }).timeout;
  return typeof timeout === "function" ? timeout(timeoutMs) : undefined;
}
