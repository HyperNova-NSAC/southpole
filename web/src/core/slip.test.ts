import { describe, expect, it } from "vitest";
import { buildSlipIndex, nextDates, nextLandingIndexes } from "./slip";
import type { Instant, MissionProfile } from "../contract/types";

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

const STRICT_LANDER: MissionProfile = {
  id: "small-lander",
  label: "Small lander, 14 days",
  durationHours: 7, // 14 half-hour steps — short so the 48-sample fixture fits
  earthRequiredAtLanding: true,
  // 10 dark steps × 0.5 h = 5 h night → red when limit is 2 h
  maxLongestDarkHours: 2,
  illustrative: true,
};

describe("slip", () => {
  it("skips landings that fall inside a planted dark run", () => {
    const samples: Instant[] = [];
    for (let i = 0; i < 48; i += 1) {
      const dark = i >= 5 && i < 15;
      samples.push(instant(dark ? 0 : 1, true));
    }
    const index = buildSlipIndex("shackleton-rim", "2027-03-03T00:00:00Z", 30, samples);

    // Strict overlap skip (any dark in the window).
    const dates = nextLandingIndexes(index, STRICT_LANDER.durationHours, 3);
    expect(dates[0]).toBeGreaterThanOrEqual(15);

    // nextDates skips red windows; a landing that starts inside the dark run is red.
    const next = nextDates(index, STRICT_LANDER, 3);
    expect(next.length).toBeGreaterThan(0);
    const insideDark = "2027-03-03T02:30:00Z"; // index 5
    expect(next.includes(insideDark)).toBe(false);
    expect(Date.parse(next[0])).toBeGreaterThan(Date.parse(insideDark));
  });
});
