/** Pure geometry shared by the charts. No React or DOM, so it is easy to test. */

export type TrackPoint = { azDeg: number; elDeg: number; on: boolean };
export type TrackRun = { on: boolean; points: TrackPoint[] };

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** "N", "NE", … for an azimuth in degrees. */
export function compassLabel(azDeg: number): string {
  const wrapped = ((azDeg % 360) + 360) % 360;
  return COMPASS[Math.round(wrapped / 45) % 8];
}

/**
 * Split a Sun or Earth track into runs that can each be drawn as one path.
 * A new run starts when visibility flips (the boundary point is shared so the
 * two styles meet without a gap) or, with `breakOnWrap`, when the azimuth
 * jumps across the 0°/360° seam of a flat panorama.
 */
export function splitTrack(points: TrackPoint[], breakOnWrap: boolean): TrackRun[] {
  const runs: TrackRun[] = [];
  let current: TrackRun | null = null;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const prev = points[i - 1];
    const wrapped = breakOnWrap && prev !== undefined && Math.abs(point.azDeg - prev.azDeg) > 180;
    if (current === null || wrapped) {
      current = { on: point.on, points: [point] };
      runs.push(current);
    } else if (point.on !== current.on) {
      current = { on: point.on, points: [prev, point] };
      runs.push(current);
    } else {
      current.points.push(point);
    }
  }
  return runs;
}

/**
 * Elevation range for a sky chart. The terrain always fits; tracks only push
 * the top up, because the Sun dipping to −80° at night is not worth the space.
 */
export function elevationDomain(
  mask: number[],
  tracks: { elDeg: number }[][],
  minLow = -3,
  minHigh = 8,
): [number, number] {
  let low = minLow;
  let high = minHigh;
  for (const el of mask) {
    low = Math.min(low, el);
    high = Math.max(high, el);
  }
  for (const track of tracks) {
    for (const point of track) high = Math.max(high, point.elDeg);
  }
  return [Math.floor(low - 1), Math.min(90, Math.ceil(high + 1))];
}

/** Index ranges [start, end) where `flags` is true, for drawing timeline bands. */
export function runsWhere(flags: boolean[]): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  let start = -1;
  flags.forEach((flag, i) => {
    if (flag && start < 0) start = i;
    if (!flag && start >= 0) {
      runs.push({ start, end: i });
      start = -1;
    }
  });
  if (start >= 0) runs.push({ start, end: flags.length });
  return runs;
}

/** Index of the sample whose time is closest to `ms`. Samples must be sorted. */
export function nearestIndex(times: number[], ms: number): number {
  if (times.length === 0) return 0;
  let lo = 0;
  let hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= ms) lo = mid;
    else hi = mid;
  }
  return Math.abs(times[hi] - ms) < Math.abs(times[lo] - ms) ? hi : lo;
}

/** Polar chart position: azimuth clockwise from north (up), radius in pixels. */
export function polarPoint(azDeg: number, radius: number): { x: number; y: number } {
  const a = (azDeg * Math.PI) / 180;
  return { x: Math.sin(a) * radius, y: -Math.cos(a) * radius };
}
