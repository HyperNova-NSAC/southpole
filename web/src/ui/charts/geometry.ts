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

/**
 * Y range for the mission timeline, in degrees of clearance above the skyline.
 * Values far below the skyline stay clamped so a deep night does not flatten
 * the chart. The top follows the highest Sun or Earth clearance.
 */
export function timelineDomain(clearances: number[]): [number, number] {
  if (clearances.length === 0) return [-3, 3];
  const floor = Math.min(...clearances);
  const peak = Math.max(...clearances);
  const low = Math.max(-15, Math.min(-3, floor));
  const high = Math.max(3, peak + 2);
  return [low, high];
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

/**
 * Pixel radius of a Sun or Earth disc.
 *
 * `angDiamDeg` is the full angular diameter from Horizons (about 0.54° for the
 * Sun and 1.9° for Earth). `pxPerDeg` is the chart's elevation scale, so the
 * disc's height lines up with the degree axis. Both charts draw it as a circle:
 * the panorama squeezes 360° of azimuth into the width, and a true ellipse
 * would be a sliver.
 */
export function discRadiusPx(pxPerDeg: number, angDiamDeg: number): number {
  return (Math.max(0, angDiamDeg) / 2) * Math.abs(pxPerDeg);
}

/** Pixels per degree of a linear scale, using its two end values. */
export function pxPerDeg(spanPx: number, spanDeg: number): number {
  if (spanDeg === 0) return 0;
  return Math.abs(spanPx / spanDeg);
}

/** Polar chart position: azimuth clockwise from north (up), radius in pixels. */
export function polarPoint(azDeg: number, radius: number): { x: number; y: number } {
  const a = (azDeg * Math.PI) / 180;
  return { x: Math.sin(a) * radius, y: -Math.cos(a) * radius };
}

function elevationBounds(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

function elevationInside(elDeg: number, elMin: number, elMax: number): boolean {
  return elDeg >= elMin && elDeg <= elMax;
}

/** Shortest-way azimuth blend. `t` is 0 at `from` and 1 at `to`. */
function lerpAzimuth(from: number, to: number, t: number): number {
  const wrapped = (((to - from) % 360) + 360) % 360;
  const delta = wrapped > 180 ? wrapped - 360 : wrapped;
  return (from + delta * t + 360) % 360;
}

/**
 * Where the segment between an inside sample and an outside sample crosses
 * the elevation window. Azimuth follows the short way around the circle.
 */
function boundaryCrossing(
  a: { azDeg: number; elDeg: number; on?: boolean },
  b: { azDeg: number; elDeg: number; on?: boolean },
  elMin: number,
  elMax: number,
): TrackPoint {
  const outside = elevationInside(a.elDeg, elMin, elMax) ? b : a;
  const inside = outside === a ? b : a;
  const boundary = outside.elDeg > elMax ? elMax : elMin;
  const span = b.elDeg - a.elDeg;
  const t = span === 0 ? 0 : (boundary - a.elDeg) / span;
  const u = Math.min(1, Math.max(0, t));
  return {
    azDeg: lerpAzimuth(a.azDeg, b.azDeg, u),
    elDeg: boundary,
    on: inside.on ?? false,
  };
}

/**
 * Pieces of a Sun or Earth track that stay inside the chart's elevation window.
 * Each exit and re-entry is cut exactly at the boundary, so the path does not
 * run along the edge while the body is outside the window.
 */
export function clipTrackToWindow(points: TrackPoint[], elLow: number, elHigh: number): TrackPoint[][] {
  const [elMin, elMax] = elevationBounds(elLow, elHigh);
  const runs: TrackPoint[][] = [];
  let run: TrackPoint[] | null = null;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const prev = points[i - 1];
    const now = elevationInside(point.elDeg, elMin, elMax);
    const was = prev !== undefined && elevationInside(prev.elDeg, elMin, elMax);
    if (prev !== undefined && was !== now) {
      const edge = boundaryCrossing(prev, point, elMin, elMax);
      if (was && run) {
        run.push(edge);
        run = null;
      } else {
        run = [edge, point];
        runs.push(run);
      }
    } else if (now) {
      if (run === null) {
        run = [point];
        runs.push(run);
      } else {
        run.push(point);
      }
    }
  }
  return runs;
}

/**
 * Marker position for one body. Inside the elevation window this is the
 * playhead sample. Once it has left, it stays where it crossed the boundary
 * instead of sliding along the edge as its azimuth keeps changing.
 */
export function holdAtBoundary(
  points: { azDeg: number; elDeg: number }[],
  index: number,
  elLow: number,
  elHigh: number,
): { azDeg: number; elDeg: number } {
  const [elMin, elMax] = elevationBounds(elLow, elHigh);
  if (points.length === 0) return { azDeg: 0, elDeg: elMin };
  const i = Math.max(0, Math.min(points.length - 1, index));
  const current = points[i];
  if (elevationInside(current.elDeg, elMin, elMax)) return current;

  for (let j = i - 1; j >= 0; j -= 1) {
    if (!elevationInside(points[j].elDeg, elMin, elMax)) continue;
    const edge = boundaryCrossing(points[j], points[j + 1], elMin, elMax);
    return { azDeg: edge.azDeg, elDeg: edge.elDeg };
  }

  const first = points[0];
  return { azDeg: first.azDeg, elDeg: Math.min(elMax, Math.max(elMin, first.elDeg)) };
}
