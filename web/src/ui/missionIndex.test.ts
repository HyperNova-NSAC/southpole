import { describe, expect, it } from "vitest";
import { buildSlipIndex } from "../core/slip";
import type { Instant, MissionProfile } from "../contract/types";
import { suggestDates } from "./missionIndex";

function instant(sunFrac: number): Instant {
  return {
    t: "2027-03-03T00:00:00Z",
    sunAzDeg: 0,
    sunElDeg: 0,
    sunAngDiamDeg: 0.5,
    sunClearanceDeg: 0,
    sunFrac,
    earthAzDeg: 0,
    earthElDeg: 0,
    earthAngDiamDeg: 0.9,
    earthIllumFrac: 0.5,
    earthClearanceDeg: 2,
    earthVisible: true,
    powerWm2: 0,
  };
}

const profile: MissionProfile = {
  id: "small-lander",
  label: "Small lander, 14 days",
  durationHours: 24,
  earthRequiredAtLanding: true,
  maxLongestDarkHours: 2,
  illustrative: true,
};

describe("suggestDates", () => {
  it("spaces the suggested landings at least a day apart", () => {
    const samples = Array.from({ length: 48 * 4 }, (_, i) => instant(i < 10 ? 0 : 1));
    const index = buildSlipIndex("shackleton-rim", "2027-03-01T00:00:00Z", 30, samples);
    const dates = suggestDates(index, profile, 3);
    expect(dates.length).toBe(3);
    const gap = Date.parse(dates[1]) - Date.parse(dates[0]);
    expect(gap).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
  });
});
