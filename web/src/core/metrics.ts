import type { Instant, WindowMetrics } from "../contract/types";

// A sample is sunlit when at least half the solar disc is above the skyline.
export const SUNLIT_THRESHOLD = 0.5;
// Horizons tables step at 30 minutes, so one sample covers half an hour.
export const STEP_HOURS = 0.5;

// One pass over the mission samples to derive the window metrics.
export function computeMetrics(samples: Instant[]): WindowMetrics {
  const n = samples.length;
  let sunlitCount = 0;
  let earthCount = 0;
  let bothCount = 0;
  let longestDark = 0;
  let longestCommGap = 0;
  let darkRun = 0;
  let commRun = 0;
  let sunsetInHours: number | null = null;
  let earthsetInHours: number | null = null;
  let litAtLanding = false;
  let earthAtLanding = false;

  for (let i = 0; i < n; i += 1) {
    const s = samples[i];
    const lit = s.sunFrac >= SUNLIT_THRESHOLD;
    const visible = s.earthVisible;
    if (lit) {
      sunlitCount += 1;
    }
    if (visible) {
      earthCount += 1;
    }
    if (lit && visible) {
      bothCount += 1;
    }
    if (i === 0) {
      litAtLanding = lit;
      earthAtLanding = visible;
    }
    if (!lit) {
      darkRun += 1;
      if (darkRun > longestDark) {
        longestDark = darkRun;
      }
    } else {
      darkRun = 0;
    }
    if (!visible) {
      commRun += 1;
      if (commRun > longestCommGap) {
        longestCommGap = commRun;
      }
    } else {
      commRun = 0;
    }
    if (sunsetInHours === null && !lit) {
      sunsetInHours = i * STEP_HOURS;
    }
    if (earthsetInHours === null && !visible) {
      earthsetInHours = i * STEP_HOURS;
    }
  }

  return {
    sunlitFraction: n === 0 ? 0 : sunlitCount / n,
    earthFraction: n === 0 ? 0 : earthCount / n,
    bothFraction: n === 0 ? 0 : bothCount / n,
    longestDarkHours: longestDark * STEP_HOURS,
    longestCommGapHours: longestCommGap * STEP_HOURS,
    sunsetInHours,
    earthsetInHours,
    litAtLanding,
    earthAtLanding,
    transitionCount: countTransitions(samples),
  };
}

// Count how many times the lit state flips between consecutive samples.
function countTransitions(samples: Instant[]): number {
  let count = 0;
  let prev: boolean | null = null;
  for (const s of samples) {
    const lit = s.sunFrac >= SUNLIT_THRESHOLD;
    if (prev !== null && lit !== prev) {
      count += 1;
    }
    prev = lit;
  }
  return count;
}
