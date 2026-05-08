import { describe, expect, it } from "vitest";
import { BOTTLE_1_5L, EXACT_TOLERANCE_ML } from "@afia/shared";

describe("smoke", () => {
  it("shared package exports constants", () => {
    expect(BOTTLE_1_5L.capacityMl).toBe(1500);
    expect(EXACT_TOLERANCE_ML).toBe(55);
  });
});
