import type { BottleSize } from "./bottle.js";

export interface AnalysisRequest {
  bottleSize: BottleSize;
  imageBase64: string;
}

export interface AnalysisResult {
  remainingMl: number;
  consumedMl: number;
  redLineYRatio: number;
  confidence: number;
  provider: "gemini" | "grok";
  rawModelText: string;
}

export interface AnalysisRecord extends AnalysisResult {
  id: string;
  createdAt: string;
  imageUrl: string;
  bottleSize: BottleSize;
  adminCorrection?: {
    flag: "too_big" | "too_small" | "manual";
    correctedRemainingMl?: number;
    note?: string;
  };
}
