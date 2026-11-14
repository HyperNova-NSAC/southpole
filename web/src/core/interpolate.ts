import type { HorizonsSample, HorizonsTable } from "../contract/types";

// Horizons timestamps are ISO-8601 UTC strings, so convert to epoch milliseconds.
function toMs(t: string): number {
  return Date.parse(t);
}

const timeCache = new WeakMap<HorizonsTable, number[]>();

function sampleTimes(table: HorizonsTable): number[] {
  const cached = timeCache.get(table);
  if (cached) return cached;
  const times = table.samples.map((sample) => toMs(sample.t));
  timeCache.set(table, times);
  return times;
}

// Format epoch milliseconds back into an ISO-8601 UTC timestamp string.
function toIso(tMs: number): string {
  const d = new Date(tMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` +
    `.${pad(d.getUTCMilliseconds())}Z`
  );
}

/**
 * Interpolate the Horizons sample at tMs from the bracketing samples of the table.
 * Azimuth interpolates along the short way around the circle; the remaining
 * quantities interpolate linearly. Times outside the table clamp to an end sample.
 */
export function sampleAt(table: HorizonsTable, tMs: number): HorizonsSample {
  const times = sampleTimes(table);
  const first = times[0];
  const last = times[times.length - 1];
  const clamped = Math.min(Math.max(tMs, first), last);

  const n = table.samples.length;
  if (n === 1) {
    return table.samples[0];
  }
  if (clamped <= times[0]) {
    return table.samples[0];
  }
  if (clamped >= times[times.length - 1]) {
    return table.samples[table.samples.length - 1];
  }

  let lo = 0;
  let hi = times.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= clamped) lo = mid;
    else hi = mid;
  }
  const t0 = times[lo];
  const t1 = times[hi];
  const span = t1 - t0;
  const u = span === 0 ? 0 : (clamped - t0) / span;

  const s0 = table.samples[lo];
  const s1 = table.samples[hi];
  const azDelta = ((s1.azDeg - s0.azDeg + 540) % 360) - 180;
  const azDeg = (s0.azDeg + u * azDelta + 360) % 360;
  const elDeg = s0.elDeg + u * (s1.elDeg - s0.elDeg);
  const angDiamDeg = s0.angDiamDeg + u * (s1.angDiamDeg - s0.angDiamDeg);
  const illumFrac =
    s0.illumFrac === null || s1.illumFrac === null
      ? null
      : s0.illumFrac + u * (s1.illumFrac - s0.illumFrac);

  return {
    t: toIso(clamped),
    azDeg,
    elDeg,
    angDiamDeg,
    illumFrac,
  };
}
