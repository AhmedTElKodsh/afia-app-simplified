import { describe, expect, it } from "vitest";
import { buildProductScanUrl, buildMockQrSvg } from "./product-link";

describe("product scan links", () => {
  it("builds product-specific scan URLs for supported Stage 1 sizes", () => {
    expect(buildProductScanUrl("https://afia.example", "1.5L")).toBe("https://afia.example/scan?size=1.5L");
    expect(buildProductScanUrl("https://afia.example/app/", "2.5L")).toBe("https://afia.example/app/scan?size=2.5L");
  });

  it("renders a mock QR SVG that embeds the product scan URL", () => {
    const svg = buildMockQrSvg("https://afia.example", "1.5L");

    expect(svg).toContain("<svg");
    expect(svg).toContain("data-product-size=\"1.5L\"");
    expect(svg).toContain("https://afia.example/scan?size=1.5L");
  });
});
