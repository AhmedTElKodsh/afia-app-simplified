import type { BottleSize } from "./bottle.js";

export function buildProductScanUrl(baseUrl: string, size: BottleSize): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const params = new URLSearchParams({ size });
  return `${normalizedBase}/scan?${params.toString()}`;
}

function escapeAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;");
}

export function buildMockQrSvg(baseUrl: string, size: BottleSize): string {
  const scanUrl = buildProductScanUrl(baseUrl, size);
  const encodedUrl = escapeAttr(scanUrl);
  const encodedSize = escapeAttr(size);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="Mock QR for Afia ${encodedSize}" data-product-size="${encodedSize}" data-scan-url="${encodedUrl}">
  <rect width="160" height="160" fill="#fff"/>
  <rect x="12" y="12" width="38" height="38" fill="#111"/>
  <rect x="110" y="12" width="38" height="38" fill="#111"/>
  <rect x="12" y="110" width="38" height="38" fill="#111"/>
  <path d="M66 24h12v12H66zm24 0h8v8h-8zm-18 24h16v8H72zm32 10h12v12h-12zM62 76h12v12H62zm24 0h10v10H86zm24 4h26v8h-26zM62 104h8v32h-8zm24 8h14v14H86zm30-4h10v10h-10zm16 18h14v18h-14z" fill="#111"/>
  <text x="80" y="156" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="#111">${encodedUrl}</text>
</svg>`;
}
