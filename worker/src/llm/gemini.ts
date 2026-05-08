import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { FewShot } from "../prompt/load.js";

interface CallArgs {
  apiKey: string;
  modelId: string;
  systemText: string;
  userText: string;
  fewShots: FewShot[];
  imageBase64: string;
}

export async function callGemini(args: CallArgs): Promise<string> {
  const client = new GoogleGenerativeAI(args.apiKey);
  const model = client.getGenerativeModel({
    model: args.modelId,
    systemInstruction: args.systemText,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          remainingMl: { type: SchemaType.NUMBER },
          consumedMl: { type: SchemaType.NUMBER },
          redLineYRatio: { type: SchemaType.NUMBER },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["remainingMl", "consumedMl", "redLineYRatio", "confidence"],
      },
    },
  });

  const fewShotText = args.fewShots
    .map((fs, i) => `Example ${i + 1} (${fs.imagePath}): ${JSON.stringify(fs.expected)}`)
    .join("\n");

  const result = await model.generateContent([
    { text: `${args.userText}\n\nFew-shot reference outputs (text labels, not images):\n${fewShotText}` },
    { inlineData: { mimeType: "image/jpeg", data: args.imageBase64 } },
  ]);
  return result.response.text();
}
