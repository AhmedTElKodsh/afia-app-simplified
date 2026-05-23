type JsonSchema = {
  type?: string;
  enum?: string[];
  const?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  required?: string[];
  additionalProperties?: boolean;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
};

export const VISUAL_EVIDENCE_SCHEMA_NAME = "afia_visual_evidence_v1";

export const VISUAL_EVIDENCE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "bottleDetected",
    "bottleType",
    "bottleTypeConfidence",
    "topVisible",
    "bottomVisible",
    "frontLabelVisible",
    "liquidBoundaryVisible",
    "bottleBox",
    "liquidLine",
    "qualityFlags",
    "evidenceConfidence",
    "refusalReason",
  ],
  properties: {
    schemaVersion: { type: "string", const: VISUAL_EVIDENCE_SCHEMA_NAME },
    bottleDetected: { type: "boolean" },
    bottleType: { type: "string", enum: ["afia_1_5l", "afia_2_5l", "unknown"] },
    bottleTypeConfidence: ratioSchema(),
    topVisible: { type: "boolean" },
    bottomVisible: { type: "boolean" },
    frontLabelVisible: { type: "boolean" },
    liquidBoundaryVisible: { type: "boolean" },
    bottleBox: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["yMin", "xMin", "yMax", "xMax"],
          properties: {
            yMin: normalizedCoordinateSchema(),
            xMin: normalizedCoordinateSchema(),
            yMax: normalizedCoordinateSchema(),
            xMax: normalizedCoordinateSchema(),
          },
        },
        { type: "null" },
      ],
    },
    liquidLine: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "points"],
          properties: {
            kind: { type: "string", const: "line" },
            points: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["x", "y"],
                properties: {
                  x: normalizedCoordinateSchema(),
                  y: normalizedCoordinateSchema(),
                },
              },
            },
          },
        },
        { type: "null" },
      ],
    },
    qualityFlags: { type: "array", items: { type: "string" } },
    evidenceConfidence: ratioSchema(),
    refusalReason: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
} satisfies JsonSchema;

export function geminiVisualEvidenceSchema() {
  return toGeminiSchema(VISUAL_EVIDENCE_JSON_SCHEMA);
}

export function openRouterVisualEvidenceResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: VISUAL_EVIDENCE_SCHEMA_NAME,
      strict: true,
      schema: VISUAL_EVIDENCE_JSON_SCHEMA,
    },
  };
}

function ratioSchema(): JsonSchema {
  return { type: "number", minimum: 0, maximum: 1 };
}

function normalizedCoordinateSchema(): JsonSchema {
  return { type: "number", minimum: 0, maximum: 1000 };
}

function toGeminiSchema(schema: JsonSchema): Record<string, unknown> {
  if (schema.anyOf) {
    return { anyOf: schema.anyOf.map((item) => toGeminiSchema(item)) };
  }

  const converted: Record<string, unknown> = {
    ...schema,
  };

  // Gemini's responseSchema uses its own Schema subset and rejects JSON Schema
  // keywords such as additionalProperties. Keep the stricter schema for
  // OpenRouter, but strip unsupported keywords from the Gemini request body.
  delete converted.additionalProperties;

  if (schema.type) converted.type = schema.type.toUpperCase();

  if (schema.const !== undefined) {
    converted.enum = [schema.const];
    delete converted.const;
  }
  if (schema.properties) {
    converted.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }
  if (schema.items) {
    converted.items = toGeminiSchema(schema.items);
  }

  return converted;
}
