const GROK_API_URL = "https://api.x.ai/v1/chat/completions";

interface CallGrokArgs {
  apiKey: string;
  modelId: string;
  systemText: string;
  userText: string;
  imageBase64: string;
  targetMimeType?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface GrokResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function callGrok(args: CallGrokArgs): Promise<string> {
  const fetcher = args.fetchImpl ?? fetch;
  const response = await fetcher(GROK_API_URL, {
    method: "POST",
    signal: timeoutSignal(args.timeoutMs ?? 30000),
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.modelId,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.systemText },
        {
          role: "user",
          content: [
            { type: "text", text: `${args.userText}\nReturn JSON only.` },
            {
              type: "image_url",
              image_url: {
                url: toDataUrl(args.imageBase64, args.targetMimeType ?? "image/jpeg"),
                detail: "high",
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok API failed with ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as GrokResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Grok response did not include assistant content");
  return content;
}

function toDataUrl(imageBase64: string, mimeType: string): string {
  return imageBase64.startsWith("data:") ? imageBase64 : `data:${mimeType};base64,${imageBase64}`;
}

function timeoutSignal(timeoutMs: number): AbortSignal | undefined {
  const timeout = (AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal }).timeout;
  return typeof timeout === "function" ? timeout(timeoutMs) : undefined;
}
