import { SUNLIT_THRESHOLD } from "./metrics";
import { compare } from "./compare";
import type { Instant, MissionProfile, WindowMetrics } from "../contract/types";

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

function windowSteps(index: SlipIndex, durationHours: number): number {
  return Math.max(1, Math.floor((durationHours * 60) / index.stepMin));
}

function overlapsDark(index: SlipIndex, i0: number, steps: number): boolean {
  return index.darkRuns.some((r) => r.start < i0 + steps && i0 < r.start + r.length);
}

function longestDarkInWindow(index: SlipIndex, i0: number, steps: number): number {
  let longest = 0;
  for (const run of index.darkRuns) {
    const start = Math.max(run.start, i0);
    const end = Math.min(run.start + run.length, i0 + steps);
    if (end > start) {
      longest = Math.max(longest, end - start);
    }
  }
  return longest;
}

function metricsFromIndex(index: SlipIndex, i0: number, durationHours: number): WindowMetrics {
  const steps = windowSteps(index, durationHours);
  const n = steps;
  const sunlit = index.sunPrefix[i0 + n] - index.sunPrefix[i0];
  const earth = index.earthPrefix[i0 + n] - index.earthPrefix[i0];
  const longestDarkSteps = longestDarkInWindow(index, i0, n);
  const earthAtLanding = index.earth[i0] === 1;
  const litAtLanding = index.sunlit[i0] === 1;
  return {
    sunlitFraction: sunlit / n,
    earthFraction: earth / n,
    bothFraction: 0,
    longestDarkHours: longestDarkSteps * (index.stepMin / 60),
    longestCommGapHours: 0,
    sunsetInHours: null,
    earthsetInHours: null,
    litAtLanding,
    earthAtLanding,
    transitionCount: 0,
  };
}

function isRed(index: SlipIndex, i0: number, profile: MissionProfile): boolean {
  const metrics = metricsFromIndex(index, i0, profile.durationHours);
  const darkOver =
    profile.maxLongestDarkHours !== null &&
    metrics.longestDarkHours > profile.maxLongestDarkHours;
  const earthMiss = profile.earthRequiredAtLanding && !metrics.earthAtLanding;
  return darkOver || earthMiss;
}

// Landing indexes whose window is not red, oldest first.
export function nextLandingIndexes(
  index: SlipIndex,
  durationHours: number,
  count: number,
  profile?: MissionProfile,
): number[] {
  const steps = windowSteps(index, durationHours);
  const results: number[] = [];
  for (let i0 = 0; i0 + steps <= index.sunlit.length; i0 += 1) {
    if (profile) {
      if (isRed(index, i0, profile)) {
        continue;
      }
    } else if (overlapsDark(index, i0, steps)) {
      continue;
    }
    results.push(i0);
    if (results.length >= count) {
      break;
    }
  }
  return results;
}

function indexToIso(index: SlipIndex, i: number): string {
  const t0 = Date.parse(index.t0);
  const ms = t0 + i * index.stepMin * 60_000;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Next ISO landing times that are not red for this profile. */
export function nextDates(index: SlipIndex, profile: MissionProfile, count = 3): string[] {
  return nextLandingIndexes(index, profile.durationHours, count, profile).map((i) =>
    indexToIso(index, i),
  );
}

/**
 * Best other catalog site for the same landing that is not red.
 * Returns a comparison sentence, or null if none is better.
 */
export function betterSite(
  indexes: Record<string, SlipIndex>,
  currentId: string,
  landingUtc: string,
  profile: MissionProfile,
  siteNames: Record<string, string> = {},
): { siteId: string; sentence: string } | null {
  const current = indexes[currentId];
  if (!current) {
    return null;
  }
  const landingMs = Date.parse(landingUtc);
  const t0 = Date.parse(current.t0);
  const landingIndex = Math.round((landingMs - t0) / (current.stepMin * 60_000));
  if (landingIndex < 0 || landingIndex >= current.sunlit.length) {
    return null;
  }

  const currentMetrics = metricsFromIndex(current, landingIndex, profile.durationHours);
  let best: { siteId: string; metrics: WindowMetrics } | null = null;

  for (const [siteId, index] of Object.entries(indexes)) {
    if (siteId === currentId) {
      continue;
    }
    const i0 = Math.round((landingMs - Date.parse(index.t0)) / (index.stepMin * 60_000));
    if (i0 < 0 || i0 + windowSteps(index, profile.durationHours) > index.sunlit.length) {
      continue;
    }
    if (isRed(index, i0, profile)) {
      continue;
    }
    const metrics = metricsFromIndex(index, i0, profile.durationHours);
    if (!best || metrics.sunlitFraction > best.metrics.sunlitFraction) {
      best = { siteId, metrics };
    }
  }

  if (!best) {
    return null;
  }
  const name = siteNames[best.siteId] ?? best.siteId;
  return {
    siteId: best.siteId,
    sentence: compare(currentMetrics, best.metrics, name, profile.durationHours),
  };
}
