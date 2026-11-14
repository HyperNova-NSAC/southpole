import type { HorizonMask, HorizonsTable, MissionProfile } from "../contract/types";
import { evaluateMission } from "./evaluate";
import { buildVerdict } from "./verdict";

// Dev-only demo: build a flat-mask Shackleton view for 2027-03-03 and print the verdict.
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

function sunTable(): HorizonsTable {
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
    samples: [
      { t: "2027-03-03T00:00:00Z", azDeg: 90, elDeg: 1.2, angDiamDeg: 0.5, illumFrac: null },
      { t: "2027-03-03T12:00:00Z", azDeg: 90, elDeg: 1.4, angDiamDeg: 0.5, illumFrac: null },
    ],
  };
}

function earthTable(): HorizonsTable {
  return {
    body: "earth",
    siteId: "shackleton-rim",
    latDeg: -89.9,
    lonDegEast: 0,
    altKm: 0,
    stepMin: 30,
    queriedAt: "2026-11-14T00:00:00Z",
    queryUrl: "https://ssd.jpl.nasa.gov/api/horizons.api",
    source: "JPL Horizons",
    samples: [
      { t: "2027-03-03T00:00:00Z", azDeg: 90, elDeg: 3.4, angDiamDeg: 0.9, illumFrac: 0.5 },
      { t: "2027-03-03T12:00:00Z", azDeg: 90, elDeg: 3.6, angDiamDeg: 0.9, illumFrac: 0.6 },
    ],
  };
}

const SMALL_LANDER: MissionProfile = {
  id: "small-lander",
  label: "Small lander, 14 days",
  durationHours: 336,
  earthRequiredAtLanding: true,
  maxLongestDarkHours: 50,
  illustrative: true,
};

export function runDemo(): void {
  const { samples, metrics } = evaluateMission(
    sunTable(),
    earthTable(),
    FLAT_MASK,
    "2027-03-03T00:00:00Z",
    SMALL_LANDER.durationHours,
    1,
  );
  const verdict = buildVerdict({ metrics, profile: SMALL_LANDER, landing: samples[0], commMarginDeg: 1 });
  console.log(verdict.sentence);
}
