/**
 * Dev-only demo: load Shackleton Horizons + mask files and print the verdict
 * for 2027-03-03 with the 14-day small-lander profile.
 *
 * Run from web/: `npm run demo` (after Horizons JSON exists).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HorizonMask, HorizonsTable, MissionProfile } from "../contract/types";
import { evaluateMission } from "./evaluate";
import { buildVerdict } from "./verdict";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../../public/data");

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, rel), "utf8")) as T;
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
  const sun = loadJson<HorizonsTable>("horizons/shackleton-rim-sun.json");
  const earth = loadJson<HorizonsTable>("horizons/shackleton-rim-earth.json");
  const mask = loadJson<HorizonMask>("masks/shackleton-rim.json");
  const { samples, metrics } = evaluateMission(
    sun,
    earth,
    mask,
    "2027-03-03T00:00:00Z",
    SMALL_LANDER.durationHours,
    1,
  );
  const verdict = buildVerdict({
    metrics,
    profile: SMALL_LANDER,
    landing: samples[0],
    commMarginDeg: 1,
  });
  console.log(verdict.sentence);
  console.log("sunlitFraction", metrics.sunlitFraction.toFixed(3));
  console.log("terrainIncluded", mask.terrainIncluded);
}

runDemo();
