/** Earth–Moon transfer timed so the rocket meets the Moon at a chosen landing. */

const DAY_MS = 86_400_000;
const J2000_MS = Date.parse("2000-01-01T12:00:00Z");

export const EARTH_RADIUS_KM = 6371;
export const LEO_ALTITUDE_KM = 185;
export const MOON_DISTANCE_KM = 384_400;
export const EARTH_MU_KM3_S2 = 398_600.4418;
/** Sidereal month. The Moon returns to the same star direction. */
export const MOON_SIDEREAL_DAYS = 27.321661;
/** Coast in a parking orbit between liftoff and the burn toward the Moon. */
export const PARKING_HOURS = 2.5;

const LEO_RADIUS_KM = EARTH_RADIUS_KM + LEO_ALTITUDE_KM;
const TRANSFER_AXIS_KM = (LEO_RADIUS_KM + MOON_DISTANCE_KM) / 2;
const TRANSFER_ECCENTRICITY = (MOON_DISTANCE_KM - LEO_RADIUS_KM) / (MOON_DISTANCE_KM + LEO_RADIUS_KM);
const COAST_SECONDS = Math.PI * Math.sqrt(TRANSFER_AXIS_KM ** 3 / EARTH_MU_KM3_S2);
const MEAN_MOTION = Math.sqrt(EARTH_MU_KM3_S2 / TRANSFER_AXIS_KM ** 3);
const MOON_DEG_PER_MS = 360 / (MOON_SIDEREAL_DAYS * DAY_MS);

export type Transfer = {
  liftoffMs: number;
  departureMs: number;
  arrivalMs: number;
  coastHours: number;
  parkingHours: number;
  /** Ecliptic longitude of the Moon when the rocket arrives, degrees from the vernal equinox. */
  arrivalLongitudeDeg: number;
  /** Direction of the low point of the transfer, where the rocket leaves Earth orbit. */
  perigeeLongitudeDeg: number;
};

export type CraftState = {
  utcMs: number;
  phase: "parking" | "coast";
  rocketRadiusKm: number;
  rocketLongitudeDeg: number;
  moonLongitudeDeg: number;
};

/** Low-precision ecliptic longitude of the Moon. Enough to aim a diagram, not a flight. */
export function moonLongitudeDeg(utcMs: number): number {
  const d = (utcMs - J2000_MS) / DAY_MS;
  const L = 218.3164477 + 13.17639648 * d;
  const M = 134.9633964 + 13.06499295 * d;
  const D = 297.8501921 + 12.19074912 * d;
  const lon =
    L +
    6.289 * Math.sin(rad(M)) +
    1.274 * Math.sin(rad(2 * D - M)) +
    0.658 * Math.sin(rad(2 * D)) +
    0.214 * Math.sin(rad(2 * M)) -
    0.186 * Math.sin(rad(D));
  return wrap(lon);
}

/**
 * Hohmann transfer from a 185 km Earth orbit out to the Moon's mean orbit.
 * The burn is aimed so the rocket and the Moon arrive at the same place.
 */
export function planTransfer(arrivalUtc: string): Transfer {
  const arrivalMs = Date.parse(arrivalUtc);
  const coastMs = COAST_SECONDS * 1000;
  const departureMs = arrivalMs - coastMs;
  const arrivalLongitudeDeg = moonLongitudeDeg(arrivalMs);
  return {
    liftoffMs: departureMs - PARKING_HOURS * 3_600_000,
    departureMs,
    arrivalMs,
    coastHours: coastMs / 3_600_000,
    parkingHours: PARKING_HOURS,
    arrivalLongitudeDeg,
    perigeeLongitudeDeg: wrap(arrivalLongitudeDeg - 180),
  };
}

/** Rocket and Moon at a fraction of the flight. 0 is liftoff, 1 is arrival at the Moon. */
export function stateAt(plan: Transfer, fraction: number): CraftState {
  const clamped = Math.min(1, Math.max(0, fraction));
  const span = plan.arrivalMs - plan.liftoffMs;
  const utcMs = plan.liftoffMs + clamped * span;
  const moonLongitude = wrap(plan.arrivalLongitudeDeg - MOON_DEG_PER_MS * (plan.arrivalMs - utcMs));
  if (utcMs <= plan.departureMs) {
    return {
      utcMs,
      phase: "parking",
      rocketRadiusKm: LEO_RADIUS_KM,
      rocketLongitudeDeg: plan.perigeeLongitudeDeg,
      moonLongitudeDeg: moonLongitude,
    };
  }
  const meanAnomaly = MEAN_MOTION * ((utcMs - plan.departureMs) / 1000);
  const eccentric = solveKepler(meanAnomaly, TRANSFER_ECCENTRICITY);
  const anomaly = trueAnomaly(eccentric, TRANSFER_ECCENTRICITY);
  return {
    utcMs,
    phase: "coast",
    rocketRadiusKm: TRANSFER_AXIS_KM * (1 - TRANSFER_ECCENTRICITY * Math.cos(eccentric)),
    rocketLongitudeDeg: wrap(plan.perigeeLongitudeDeg + (anomaly * 180) / Math.PI),
    moonLongitudeDeg: moonLongitude,
  };
}

/** Points along the coast, equally spaced in time, for drawing the path. */
export function coastPath(plan: Transfer, count = 90): CraftState[] {
  const points: CraftState[] = [];
  for (let i = 0; i <= count; i += 1) {
    const coastFraction = i / count;
    const utcMs = plan.departureMs + coastFraction * (plan.arrivalMs - plan.departureMs);
    const fraction = (utcMs - plan.liftoffMs) / (plan.arrivalMs - plan.liftoffMs);
    points.push(stateAt(plan, fraction));
  }
  return points;
}

function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let eccentric = meanAnomaly + eccentricity * Math.sin(meanAnomaly);
  for (let i = 0; i < 15; i += 1) {
    const delta =
      (eccentric - eccentricity * Math.sin(eccentric) - meanAnomaly) /
      (1 - eccentricity * Math.cos(eccentric));
    eccentric -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return eccentric;
}

function trueAnomaly(eccentric: number, eccentricity: number): number {
  const cosE = Math.cos(eccentric);
  const sinE = Math.sin(eccentric);
  const denominator = 1 - eccentricity * cosE;
  const cosNu = (cosE - eccentricity) / denominator;
  const sinNu = (Math.sqrt(1 - eccentricity * eccentricity) * sinE) / denominator;
  return Math.atan2(sinNu, cosNu);
}

function rad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function wrap(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
