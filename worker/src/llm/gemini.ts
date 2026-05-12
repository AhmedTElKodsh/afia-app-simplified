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
          fillPercent: { type: SchemaType.NUMBER },
          qualityFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          confidence: { type: SchemaType.NUMBER },
        },
        required: [
          "readingPossible",
          "meniscusVisible",
          "oilSurfaceYRatio",
          "nearestReferenceMl",
          "fillPercent",
          "qualityFlags",
          "confidence",
        ],
      },
    } as any,
  });

  const fewShotText = args.fewShots
    .map((fs, i) => `Example ${i + 1} (${fs.imagePath}): ${JSON.stringify(fs.expected)}`)
    .join("\n");

  const referenceLabels = (args.referenceImages ?? [])
    .map((image, i) => `Reference image ${i + 1}: ${image.label}`)
    .join("\n");

  const result = await model.generateContent([
    ...(args.referenceImages ?? []).map((image) => ({
      inlineData: { mimeType: image.mimeType, data: image.data },
    })),
    { inlineData: { mimeType: args.targetMimeType ?? "image/jpeg", data: args.imageBase64 } },
    {
      text: [
        args.userText,
        referenceLabels ? `\nCalibrated reference images:\n${referenceLabels}` : "",
        fewShotText ? `\nExpected reference outputs:\n${fewShotText}` : "",
        "\nThe target image is the final image before these instructions. Return JSON only.",
      ].join("\n"),
    },
  ]);
  return result.response.text();
}
