import { describe, expect, it } from "vitest";
import { sampleAt } from "./interpolate";
import type { HorizonsTable } from "../contract/types";

// Build a minimal Horizons table for tests; the contract shape is camelCase on the wire.
function makeTable(samples: HorizonsTable["samples"]): HorizonsTable {
  return {
    body: "sun",
    siteId: "shackleton-rim",
    latDeg: -89.9,
    lonDegEast: 0,
    altKm: 0,
    stepMin: 30,
    queriedAt: "2026-11-14T00:00:00Z",
    queryUrl: "https://ssd.jpl.nasa.gov/api/horizons.api",
    source: "JPL Horizons",
    samples,
  };
}

describe("sampleAt", () => {
  it("wraps azimuth the short way at the midpoint", () => {
    // Azimuth 350 to 10 must cross zero, not jump the long way around.
    const table = makeTable([
      { t: "2027-03-03T00:00:00Z", azDeg: 350, elDeg: 1, angDiamDeg: 0.5, illumFrac: null },
      { t: "2027-03-03T00:30:00Z", azDeg: 10, elDeg: 2, angDiamDeg: 0.5, illumFrac: null },
    ]);
    const mid = sampleAt(table, Date.parse("2027-03-03T00:15:00Z"));
    expect(mid.azDeg).toBeCloseTo(0, 5);
  });

  it("interpolates elevation linearly", () => {
    const table = makeTable([
      { t: "2027-03-03T00:00:00Z", azDeg: 0, elDeg: 0, angDiamDeg: 0.5, illumFrac: null },
      { t: "2027-03-03T00:30:00Z", azDeg: 0, elDeg: 1, angDiamDeg: 0.5, illumFrac: null },
    ]);
    const mid = sampleAt(table, Date.parse("2027-03-03T00:15:00Z"));
    expect(mid.elDeg).toBeCloseTo(0.5, 5);
  });

  it("clamps before the first sample", () => {
    const table = makeTable([
      { t: "2027-03-03T00:00:00Z", azDeg: 350, elDeg: 1, angDiamDeg: 0.5, illumFrac: null },
      { t: "2027-03-03T00:30:00Z", azDeg: 10, elDeg: 2, angDiamDeg: 0.5, illumFrac: null },
    ]);
    const before = sampleAt(table, Date.parse("2027-03-02T23:00:00Z"));
    expect(before.azDeg).toBe(350);
    expect(before.elDeg).toBe(1);
  });
});
