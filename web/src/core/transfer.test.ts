import { describe, expect, it } from "vitest";
import {
  EARTH_MU_KM3_S2,
  EARTH_RADIUS_KM,
  LEO_ALTITUDE_KM,
  MOON_DISTANCE_KM,
  PARKING_HOURS,
  coastPath,
  planTransfer,
  stateAt,
} from "./transfer";

const ARRIVAL = "2027-01-15T00:00:00Z";

function gap(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

describe("planTransfer", () => {
  const plan = planTransfer(ARRIVAL);
  const r1 = EARTH_RADIUS_KM + LEO_ALTITUDE_KM;
  const axis = (r1 + MOON_DISTANCE_KM) / 2;
  const coastMs = Math.PI * Math.sqrt(axis ** 3 / EARTH_MU_KM3_S2) * 1000;

  it("puts liftoff a parking orbit before the burn, and the burn a Hohmann coast before landing", () => {
    expect(plan.arrivalMs - plan.departureMs).toBeCloseTo(coastMs, -2);
    expect(plan.departureMs - plan.liftoffMs).toBeCloseTo(PARKING_HOURS * 3_600_000, 0);
    expect(plan.liftoffMs).toBeLessThan(plan.arrivalMs);
    expect(plan.coastHours).toBeGreaterThan(4.5 * 24);
    expect(plan.coastHours).toBeLessThan(5.5 * 24);
  });

  it("meets the Moon at the landing and leaves from low Earth orbit", () => {
    const start = stateAt(plan, 0);
    const burn = stateAt(plan, (plan.departureMs - plan.liftoffMs) / (plan.arrivalMs - plan.liftoffMs));
    const end = stateAt(plan, 1);
    expect(start.phase).toBe("parking");
    expect(burn.rocketRadiusKm).toBeCloseTo(r1, 0);
    expect(end.rocketRadiusKm).toBeCloseTo(MOON_DISTANCE_KM, 0);
    expect(gap(end.rocketLongitudeDeg, end.moonLongitudeDeg)).toBeLessThan(0.05);
    expect(gap(end.moonLongitudeDeg, plan.arrivalLongitudeDeg)).toBeLessThan(0.05);
  });

  it("draws a coast that stays between Earth orbit and the Moon", () => {
    const path = coastPath(plan, 12);
    expect(path[0].rocketRadiusKm).toBeCloseTo(r1, 0);
    expect(path[path.length - 1].rocketRadiusKm).toBeCloseTo(MOON_DISTANCE_KM, 0);
    for (const point of path) {
      expect(point.rocketRadiusKm).toBeGreaterThanOrEqual(r1 - 1);
      expect(point.rocketRadiusKm).toBeLessThanOrEqual(MOON_DISTANCE_KM + 1);
    }
  });

  it.each([
    ["four-day", 96],
    ["apollo", 72],
    ["fast", 52],
  ] as const)("flies a %s coast in the chosen time and still meets the Moon", (kind, hours) => {
    const chosen = planTransfer(ARRIVAL, kind);
    expect(chosen.coastHours).toBeCloseTo(hours, 1);
    expect(chosen.coastHours).toBeLessThan(plan.coastHours);
    const end = stateAt(chosen, 1);
    expect(end.rocketRadiusKm).toBeCloseTo(MOON_DISTANCE_KM, 0);
    expect(gap(end.rocketLongitudeDeg, end.moonLongitudeDeg)).toBeLessThan(0.05);
    for (const point of coastPath(chosen, 16)) {
      expect(point.rocketRadiusKm).toBeLessThanOrEqual(MOON_DISTANCE_KM + 1);
    }
  });
});
