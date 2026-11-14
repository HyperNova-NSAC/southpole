import { describe, expect, it } from "vitest";
import { evaluateInstant } from "./evaluate";
import { computeMetrics } from "./metrics";
import { discFraction } from "./mask";
import { buildVerdict } from "./verdict";
import type { HorizonMask, Instant, MissionProfile } from "../contract/types";

const FLAT_MASK: HorizonMask = {
  siteId: "shackleton-rim",
  latDeg: -89.9,
  lonDegEast: 0,
  mastM: 2,
  azStepDeg: 1,
  maskElDeg: new Array<number>(360).fill(0),
  heightM: 0,
  demSource: "flat",
  terrainIncluded: false,
};

const RIDGE_MASK: HorizonMask = {
  ...FLAT_MASK,
  maskElDeg: new Array<number>(360).fill(10),
  demSource: "ridge",
  terrainIncluded: true,
};

const SMALL_LANDER: MissionProfile = {
  id: "small-lander",
  label: "Small lander, 14 days",
  durationHours: 336,
  earthRequiredAtLanding: true,
  maxLongestDarkHours: 50,
  illustrative: true,
};

function instant(sunElDeg: number, earthElDeg: number, mask: HorizonMask = FLAT_MASK): Instant {
  const sun = { t: "2027-03-03T00:00:00Z", azDeg: 90, elDeg: sunElDeg, angDiamDeg: 0.5, illumFrac: null };
  const earth = { t: "2027-03-03T00:00:00Z", azDeg: 90, elDeg: earthElDeg, angDiamDeg: 0.9, illumFrac: 0.5 };
  return evaluateInstant(sun, earth, mask, 1);
}

describe("verdict", () => {
  it("says the landing works when the Sun is up and Earth is visible", () => {
    const landing = instant(20, 20);
    const metrics = computeMetrics([landing]);
    expect(metrics.sunlitFraction).toBe(1);
    const result = buildVerdict({ metrics, profile: SMALL_LANDER, landing, commMarginDeg: 1 });
    expect(result.light).toBe("green");
    expect(result.sentence).toContain("This landing works");
  });

  it("says the landing does not work when the longest night is over the limit", () => {
    // Earth stays visible; a long dark run trips the night limit.
    const landing = instant(-5, 20);
    const samples = Array.from({ length: 120 }, () => landing); // 60 hours dark
    const metrics = computeMetrics(samples);
    const result = buildVerdict({ metrics, profile: SMALL_LANDER, landing, commMarginDeg: 1 });
    expect(result.light).toBe("red");
    expect(result.sentence).toContain("This landing does not work");
    expect(result.sentence.toLowerCase()).toContain("night");
  });

  it("gives sunFrac 0 when a 10° ridge blocks a +2° Sun", () => {
    const landing = instant(2, 20, RIDGE_MASK);
    expect(landing.sunFrac).toBe(0);
    expect(discFraction(2, 0.5, 10)).toBe(0);
  });
});
