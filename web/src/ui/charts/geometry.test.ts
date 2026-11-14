import { describe, expect, it } from "vitest";
import { compassLabel, discRadiusPx, elevationDomain, nearestIndex, pxPerDeg, runsWhere, splitTrack, timelineDomain } from "./geometry";

const p = (azDeg: number, on: boolean) => ({ azDeg, elDeg: 1, on });

describe("splitTrack", () => {
  it("starts a new run when visibility flips and shares the boundary point", () => {
    const runs = splitTrack([p(10, true), p(20, true), p(30, false), p(40, false)], true);
    expect(runs.map((run) => run.on)).toEqual([true, false]);
    expect(runs[1].points.map((point) => point.azDeg)).toEqual([20, 30, 40]);
  });

  it("breaks at the 0/360 seam only when asked", () => {
    const track = [p(350, true), p(355, true), p(2, true)];
    expect(splitTrack(track, true)).toHaveLength(2);
    expect(splitTrack(track, false)).toHaveLength(1);
  });
});

describe("elevationDomain", () => {
  it("fits the terrain and the highest track point but ignores deep night", () => {
    const [low, high] = elevationDomain([-5, 2, 4], [[{ elDeg: -60 }, { elDeg: 12 }]]);
    expect(low).toBe(-6);
    expect(high).toBe(13);
  });
});

describe("timelineDomain", () => {
  it("raises the top to fit a high Sun instead of stopping at 40°", () => {
    const [low, high] = timelineDomain([-4, 80, 12]);
    expect(low).toBe(-4);
    expect(high).toBeGreaterThan(80);
  });

  it("keeps a low Sun in a readable band around the skyline", () => {
    const [low, high] = timelineDomain([-1, 2]);
    expect(low).toBe(-3);
    expect(high).toBe(4);
  });

  it("does not let a deep night pull the floor down without limit", () => {
    const [low] = timelineDomain([-80, 5]);
    expect(low).toBe(-15);
  });
});

describe("runsWhere", () => {
  it("returns half-open index ranges", () => {
    expect(runsWhere([true, true, false, true])).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 4 },
    ]);
  });
});

describe("nearestIndex", () => {
  it("snaps to the closest sorted sample", () => {
    expect(nearestIndex([0, 10, 20, 30], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20, 30], 16)).toBe(2);
    expect(nearestIndex([0, 10, 20, 30], 99)).toBe(3);
  });
});

describe("discRadiusPx", () => {
  it("uses half the angular diameter, so Earth is about 3.5 times the Sun", () => {
    const scale = pxPerDeg(200, 10);
    const sun = discRadiusPx(scale, 0.54);
    const earth = discRadiusPx(scale, 1.9);
    expect(sun).toBeCloseTo(5.4);
    expect(earth).toBeCloseTo(19);
    expect(earth / sun).toBeCloseTo(1.9 / 0.54);
  });
});

describe("compassLabel", () => {
  it("rounds to the nearest of eight points", () => {
    expect(compassLabel(0)).toBe("N");
    expect(compassLabel(93)).toBe("E");
    expect(compassLabel(359)).toBe("N");
    expect(compassLabel(-90)).toBe("W");
  });
});
