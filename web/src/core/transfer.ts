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
const HOHMANN_AXIS_KM = (LEO_RADIUS_KM + MOON_DISTANCE_KM) / 2;
const MOON_DEG_PER_MS = 360 / (MOON_SIDEREAL_DAYS * DAY_MS);

export type TransferKind = "hohmann" | "four-day" | "apollo" | "fast";

export const TRANSFER_OPTIONS: { id: TransferKind; label: string; coastHours: number | null; detail: string }[] = [
  {
    id: "hohmann",
    label: "Hohmann transfer",
    coastHours: null,
    detail: "Minimum-energy ellipse. The rocket reaches the Moon at the far end of the coast.",
  },
  {
    id: "four-day",
    label: "4-day transfer",
    coastHours: 96,
    detail: "A shorter ellipse that meets the Moon before the far end of the coast.",
  },
  {
    id: "apollo",
    label: "Apollo transfer",
    coastHours: 72,
    detail: "About three days, the coast Apollo flew. The burn from Earth is harder than a Hohmann transfer.",
  },
  {
    id: "fast",
    label: "Fast transfer",
    coastHours: 52,
    detail: "The short elliptical coast from this parking orbit, a little over two days. A quicker flight would leave on a hyperbola.",
  },
];

export type Transfer = {
  kind: TransferKind;
  liftoffMs: number;
  departureMs: number;
  arrivalMs: number;
  coastHours: number;
  parkingHours: number;
  /** Ecliptic longitude of the Moon when the rocket arrives, degrees from the vernal equinox. */
  arrivalLongitudeDeg: number;
  /** Direction of the low point of the transfer, where the rocket leaves Earth orbit. */
  perigeeLongitudeDeg: number;
  semiMajorKm: number;
  eccentricity: number;
  /** Mean motion of the transfer ellipse, radians per second. */
  meanMotion: number;
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
 * Ellipse from a 185 km Earth orbit that meets the Moon's mean orbit.
 * Hohmann arrives at the far end. Shorter coasts cross the Moon's orbit earlier
 * and need a harder burn. The burn is aimed so the rocket and the Moon arrive together.
 */
export function planTransfer(arrivalUtc: string, kind: TransferKind = "hohmann"): Transfer {
  const option = TRANSFER_OPTIONS.find((item) => item.id === kind) ?? TRANSFER_OPTIONS[0];
  const ellipse = option.coastHours === null ? hohmannEllipse() : ellipseForCoast(option.coastHours * 3600);
  const arrivalMs = Date.parse(arrivalUtc);
  const departureMs = arrivalMs - ellipse.seconds * 1000;
  const arrivalLongitudeDeg = moonLongitudeDeg(arrivalMs);
  return {
    kind: option.id,
    liftoffMs: departureMs - PARKING_HOURS * 3_600_000,
    departureMs,
    arrivalMs,
    coastHours: ellipse.seconds / 3600,
    parkingHours: PARKING_HOURS,
    arrivalLongitudeDeg,
    perigeeLongitudeDeg: wrap(arrivalLongitudeDeg - (ellipse.trueAnomaly * 180) / Math.PI),
    semiMajorKm: ellipse.semiMajorKm,
    eccentricity: ellipse.eccentricity,
    meanMotion: ellipse.meanMotion,
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
  const meanAnomaly = plan.meanMotion * ((utcMs - plan.departureMs) / 1000);
  const eccentric = solveKepler(meanAnomaly, plan.eccentricity);
  const anomaly = trueAnomaly(eccentric, plan.eccentricity);
  return {
    utcMs,
    phase: "coast",
    rocketRadiusKm: plan.semiMajorKm * (1 - plan.eccentricity * Math.cos(eccentric)),
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

type Ellipse = {
  semiMajorKm: number;
  eccentricity: number;
  meanMotion: number;
  trueAnomaly: number;
  seconds: number;
};

/** Time and angle to the point where an ellipse of this size crosses the Moon's orbit. */
function crossing(semiMajorKm: number): Ellipse | null {
  const eccentricity = 1 - LEO_RADIUS_KM / semiMajorKm;
  const apogeeKm = semiMajorKm * (1 + eccentricity);
  if (apogeeKm < MOON_DISTANCE_KM - 0.5) return null;
  const atApogee = apogeeKm <= MOON_DISTANCE_KM + 1;
  const cosNu = atApogee
    ? -1
    : (LEO_RADIUS_KM * (1 + eccentricity) / MOON_DISTANCE_KM - 1) / eccentricity;
  if (cosNu < -1 || cosNu > 1) return null;
  const trueAnomaly = Math.acos(cosNu);
  const cosE = (eccentricity + cosNu) / (1 + eccentricity * cosNu);
  const eccentric = Math.atan2(Math.sqrt(Math.max(0, 1 - cosE * cosE)), cosE);
  const meanAnomaly = eccentric - eccentricity * Math.sin(eccentric);
  const meanMotion = Math.sqrt(EARTH_MU_KM3_S2 / semiMajorKm ** 3);
  return {
    semiMajorKm,
    eccentricity,
    meanMotion,
    trueAnomaly,
    seconds: meanAnomaly / meanMotion,
  };
}

function hohmannEllipse(): Ellipse {
  const ellipse = crossing(HOHMANN_AXIS_KM);
  if (!ellipse) throw new Error("Hohmann ellipse does not reach the Moon");
  return ellipse;
}

/** Larger ellipses reach the Moon sooner. Search for the coast closest to the target. */
function ellipseForCoast(targetSeconds: number): Ellipse {
  const slow = hohmannEllipse();
  if (targetSeconds >= slow.seconds) return slow;
  let low = HOHMANN_AXIS_KM;
  let high = HOHMANN_AXIS_KM;
  let fastest = slow;
  for (let i = 0; i < 24; i += 1) {
    high *= 1.5;
    const candidate = crossing(high);
    if (!candidate) break;
    fastest = candidate;
    if (candidate.seconds <= targetSeconds) break;
  }
  if (fastest.seconds > targetSeconds) return fastest;
  for (let i = 0; i < 48; i += 1) {
    const mid = (low + high) / 2;
    const candidate = crossing(mid);
    if (!candidate || candidate.seconds > targetSeconds) low = mid;
    else high = mid;
  }
  return crossing(high) ?? fastest;
}

/** Outbound coasts stay within half an orbit, where this equation has one solution. */
function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let low = 0;
  let high = Math.PI;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (mid - eccentricity * Math.sin(mid) < meanAnomaly) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
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
