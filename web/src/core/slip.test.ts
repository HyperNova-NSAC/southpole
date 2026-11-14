import { describe, expect, it } from "vitest";
import { buildSlipIndex, nextLandingIndexes } from "./slip";
import type { Instant } from "../contract/types";

function instant(sunFrac: number, earthVisible: boolean): Instant {
  return {
    t: "2027-03-03T00:00:00Z",
    sunAzDeg: 90,
    sunElDeg: 0,
    sunAngDiamDeg: 0.5,
    sunClearanceDeg: 0,
    sunFrac,
    earthAzDeg: 90,
    earthElDeg: 0,
    earthAngDiamDeg: 0.9,
    earthIllumFrac: 0.5,
    earthClearanceDeg: 0,
    earthVisible,
    powerWm2: 0,
  };
}

describe("slip", () => {
  it("skips landings that fall inside a planted dark run", () => {
    const samples: Instant[] = [];
    for (let i = 0; i < 48; i += 1) {
      const dark = i >= 5 && i < 15;
      samples.push(instant(dark ? 0 : 1, !dark));
    }
    const index = buildSlipIndex("shackleton-rim", "2027-03-03T00:00:00Z", 30, samples);
    const dates = nextLandingIndexes(index, 14, 3);
    expect(dates[0]).toBeGreaterThanOrEqual(15);
  });
});
