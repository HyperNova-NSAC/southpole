import { discFraction, skylineEl } from "./mask";
import { sampleAt } from "./interpolate";
import { computeMetrics } from "./metrics";
import type {
  HorizonMask,
  HorizonsSample,
  HorizonsTable,
  Instant,
  WindowMetrics,
} from "../contract/types";

export const SUNLIT_THRESHOLD = 0.5;
export const EARTH_COMM_MARGIN_DEG = 1;
export const SOLAR_CONSTANT_WM2 = 1361;

/**
 * Turn one Sun/Earth sample plus a horizon mask into the instant a mission sees.
 * Computes clearance, the visible disc fraction and the illustrative panel power.
 */
export function evaluateInstant(
  sun: HorizonsSample,
  earth: HorizonsSample,
  mask: HorizonMask,
  commMarginDeg: number,
): Instant {
  const sunSkyline = skylineEl(mask, sun.azDeg);
  const earthSkyline = skylineEl(mask, earth.azDeg);
  const sunClearanceDeg = sun.elDeg - sunSkyline;
  const sunFrac = discFraction(sun.elDeg, sun.angDiamDeg, sunSkyline);
  const earthClearanceDeg = earth.elDeg - earthSkyline;
  const earthVisible = earthClearanceDeg >= commMarginDeg;
  const elev = (Math.max(sun.elDeg, 0) * Math.PI) / 180;
  const tracking = SOLAR_CONSTANT_WM2 * sunFrac * Math.cos(elev);

  return {
    t: sun.t,
    sunAzDeg: sun.azDeg,
    sunElDeg: sun.elDeg,
    sunAngDiamDeg: sun.angDiamDeg,
    sunClearanceDeg,
    sunFrac,
    earthAzDeg: earth.azDeg,
    earthElDeg: earth.elDeg,
    earthAngDiamDeg: earth.angDiamDeg,
    earthIllumFrac: earth.illumFrac,
    earthClearanceDeg,
    earthVisible,
    powerWm2: tracking,
  };
}

/**
 * Walk a mission window from the landing time in half-hour steps and derive
 * the samples plus the window metrics used by the verdict.
 */
export function evaluateMission(
  sun: HorizonsTable,
  earth: HorizonsTable,
  mask: HorizonMask,
  landingUtc: string,
  durationHours: number,
  commMarginDeg: number,
): { samples: Instant[]; metrics: WindowMetrics } {
  const landingMs = Date.parse(landingUtc);
  const stepMs = 30 * 60 * 1000;
  const totalMs = durationHours * 3_600_000;
  const kMax = Math.floor(totalMs / stepMs);
  const samples: Instant[] = [];
  for (let k = 0; k <= kMax; k += 1) {
    const tMs = landingMs + k * stepMs;
    const sunSample = sampleAt(sun, tMs);
    const earthSample = sampleAt(earth, tMs);
    samples.push(evaluateInstant(sunSample, earthSample, mask, commMarginDeg));
  }
  const metrics = computeMetrics(samples);
  return { samples, metrics };
}
