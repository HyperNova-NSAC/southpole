import { describe, expect, it } from "vitest";
import { compare } from "./compare";
import type { WindowMetrics } from "../contract/types";

function metrics(earthFraction: number, longestDarkHours: number): WindowMetrics {
  return {
    sunlitFraction: 0.9,
    earthFraction,
    bothFraction: 0.8,
    longestDarkHours,
    longestCommGapHours: 0,
    sunsetInHours: null,
    earthsetInHours: null,
    litAtLanding: true,
    earthAtLanding: true,
    transitionCount: 0,
  };
}

describe("compare", () => {
  it("says the other site stays in contact longer when the difference is big", () => {
    const sentence = compare(metrics(0.64, 18), metrics(0.9, 12), "Nobile Rim 1", 336);
    expect(sentence).toContain("stays in contact");
  });

  it("says the sites are about the same when differences are small", () => {
    const sentence = compare(metrics(0.64, 18), metrics(0.62, 17), "Nobile Rim 1", 336);
    expect(sentence).toContain("about the same");
  });
});
