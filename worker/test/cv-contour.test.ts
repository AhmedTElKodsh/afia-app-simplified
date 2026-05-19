import { describe, expect, it } from "vitest";
import { scoreContours } from "../src/cv/scoring.js";
import type { ContourRect } from "../src/cv/scoring.js";

const imgW = 640;
const imgH = 480;

function rect(x: number, y: number, w: number, h: number): ContourRect {
  return { origIdx: 0, x, y, w, h, area: w * h };
}

describe("scoreContours", () => {
  it("returns null for empty contour list", () => {
    expect(scoreContours([], imgW, imgH)).toBeNull();
  });

  it("prefers tall, centered contours over short, off-center ones", () => {
    const tallCentered = rect(270, 50, 100, 340);  // aspect 3.4, centered
    const shortCorner = rect(0, 400, 200, 50);     // aspect 0.25, off-center
    const result = scoreContours([shortCorner, tallCentered], imgW, imgH);
    expect(result).not.toBeNull();
    expect(result!.idx).toBe(1); // tallCentered wins
    expect(result!.score).toBeGreaterThan(0.3);
  });

  it("rejects all contours if none score >= 0.3", () => {
    const tinyNoise = rect(0, 0, 5, 5);
    const result = scoreContours([tinyNoise], imgW, imgH);
    expect(result).toBeNull();
  });

  it("penalizes contours far from image center", () => {
    const center = rect(270, 190, 100, 100);
    const corner = rect(0, 0, 100, 100);
    const centered = scoreContours([corner, center], imgW, imgH);
    expect(centered).not.toBeNull();
    expect(centered!.idx).toBe(1); // center wins over corner
  });

  it("prefers high aspect ratio (tall) contours", () => {
    const tall = rect(270, 80, 80, 320);   // aspect 4.0
    const wide = rect(270, 190, 300, 100); // aspect 0.33
    const result = scoreContours([wide, tall], imgW, imgH);
    expect(result!.idx).toBe(1);
  });

  it("larger contours score higher (sizeScore favors bigger)", () => {
    // Same center position, different sizes — sizeScore should favor bigger
    const big = rect(250, 100, 150, 280);   // area 42000
    const small = rect(250, 100, 80, 140);  // area 11200
    const result = scoreContours([small, big], imgW, imgH);
    expect(result!.idx).toBe(1); // big wins
  });
});
