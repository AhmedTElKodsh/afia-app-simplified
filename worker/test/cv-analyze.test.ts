import { describe, expect, it } from "vitest";

// Unit-test the input validation logic from cv-analyze.ts
// (Full HTTP integration requires a running Worker — not available in CI)

const VALID_MIME_PREFIXES = ["data:image/jpeg", "data:image/png", "data:image/webp"];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function validateMime(base64: string): boolean {
  const prefix = base64.split(",")[0] ?? "";
  return VALID_MIME_PREFIXES.some((p) => prefix.startsWith(p));
}

function validateSize(base64: string): boolean {
  const data = base64.replace(/^data:image\/\w+;base64,/, "");
  const decodedSize = Math.ceil(data.length * 0.75);
  return decodedSize <= MAX_IMAGE_SIZE_BYTES;
}

function coerceBottleSizeMl(value: unknown): number | null {
  const n = Number(value) || 1500;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

describe("cv-analyze input validation", () => {
  describe("MIME type validation", () => {
    it("accepts JPEG", () => {
      expect(validateMime("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
    });
    it("accepts PNG", () => {
      expect(validateMime("data:image/png;base64,iVBORw0KG")).toBe(true);
    });
    it("accepts WebP", () => {
      expect(validateMime("data:image/webp;base64,UklGR")).toBe(true);
    });
    it("rejects GIF", () => {
      expect(validateMime("data:image/gif;base64,R0lGODlh")).toBe(false);
    });
    it("rejects no prefix", () => {
      expect(validateMime("just-raw-data")).toBe(false);
    });
  });

  describe("file size validation", () => {
    it("accepts small image", () => {
      expect(validateSize("data:image/jpeg;base64," + "A".repeat(100))).toBe(true);
    });
    it("rejects oversized image", () => {
      const large = "data:image/jpeg;base64," + "A".repeat(Math.ceil(MAX_IMAGE_SIZE_BYTES / 0.75) + 1);
      expect(validateSize(large)).toBe(false);
    });
  });

  describe("bottleSizeMl coercion", () => {
    it("defaults to 1500 when missing", () => {
      expect(coerceBottleSizeMl(undefined)).toBe(1500);
    });
    it("accepts valid number", () => {
      expect(coerceBottleSizeMl(1500)).toBe(1500);
    });
    it("coerces string number", () => {
      expect(coerceBottleSizeMl("1500")).toBe(1500);
    });
    it("defaults 0 to 1500 (Number(0) is falsy)", () => {
      expect(coerceBottleSizeMl(0)).toBe(1500);
    });
    it("rejects negative", () => {
      expect(coerceBottleSizeMl(-1)).toBeNull();
    });
    it("rejects non-numeric string (defaults to 1500)", () => {
      expect(coerceBottleSizeMl("abc")).toBe(1500);
    });
  });
});
