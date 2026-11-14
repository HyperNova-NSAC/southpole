import { SUNLIT_THRESHOLD } from "./metrics";
import type { Instant } from "../contract/types";

export interface SlipIndex {
  siteId: string;
  t0: string;
  stepMin: number;
  sunlit: number[];
  earth: number[];
  sunPrefix: number[];
  earthPrefix: number[];
  darkRuns: { start: number; length: number }[];
  commRuns: { start: number; length: number }[];
}

// Build a prefix-sum based slip index over the mission samples for one site.
export function buildSlipIndex(
  siteId: string,
  t0: string,
  stepMin: number,
  samples: Instant[],
): SlipIndex {
  const sunlit = samples.map((s) => (s.sunFrac >= SUNLIT_THRESHOLD ? 1 : 0));
  const earth = samples.map((s) => (s.earthVisible ? 1 : 0));
  const sunPrefix = [0];
  const earthPrefix = [0];
  for (let i = 0; i < sunlit.length; i += 1) {
    sunPrefix.push(sunPrefix[i] + sunlit[i]);
    earthPrefix.push(earthPrefix[i] + earth[i]);
  }
  const darkRuns: { start: number; length: number }[] = [];
  const commRuns: { start: number; length: number }[] = [];
  let darkStart: number | null = null;
  let commStart: number | null = null;
  for (let i = 0; i < sunlit.length; i += 1) {
    const dark = sunlit[i] === 0;
    const comm = earth[i] === 0;
    if (dark && darkStart === null) {
      darkStart = i;
    }
    if (!dark && darkStart !== null) {
      darkRuns.push({ start: darkStart, length: i - darkStart });
      darkStart = null;
    }
    if (comm && commStart === null) {
      commStart = i;
    }
    if (!comm && commStart !== null) {
      commRuns.push({ start: commStart, length: i - commStart });
      commStart = null;
    }
  }
  if (darkStart !== null) {
    darkRuns.push({ start: darkStart, length: sunlit.length - darkStart });
  }
  if (commStart !== null) {
    commRuns.push({ start: commStart, length: earth.length - commStart });
  }
  return { siteId, t0, stepMin, sunlit, earth, sunPrefix, earthPrefix, darkRuns, commRuns };
}

// Landing indexes whose window does not overlap a dark run, oldest first.
export function nextLandingIndexes(index: SlipIndex, durationHours: number, count: number): number[] {
  const steps = Math.floor((durationHours * 60) / index.stepMin);
  const results: number[] = [];
  for (let i0 = 0; i0 + steps <= index.sunlit.length; i0 += 1) {
    const overlaps = index.darkRuns.some((r) => r.start < i0 + steps && i0 < r.start + r.length);
    if (overlaps) {
      continue;
    }
    results.push(i0);
    if (results.length >= count) {
      break;
    }
  }
  return results;
}
