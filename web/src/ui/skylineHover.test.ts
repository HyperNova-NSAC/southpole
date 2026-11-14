import { describe, expect, it } from "vitest";
import { fixture } from "./fixture";
import { indexOnTrack, sunHoverLine } from "./skylineHover";

describe("sunHoverLine", () => {
  it("counts days until the track goes dark", () => {
    const track = [...Array.from({ length: 192 }, () => ({ lit: true })), { lit: false }];
    expect(sunHoverLine(track, 0)).toBe("The Sun sets behind this ridge in 4 days.");
  });

  it("uses the singular when the Sun sets in one day", () => {
    const track = [...Array.from({ length: 48 }, () => ({ lit: true })), { lit: false }];
    expect(sunHoverLine(track, 0)).toBe("The Sun sets behind this ridge in 1 day.");
  });

  it("says the Sun is down when the current sample is already dark", () => {
    expect(sunHoverLine([{ lit: false }, { lit: true }], 0)).toBe("The Sun is down.");
  });

  it("says the Sun stays up when the track never goes dark", () => {
    expect(sunHoverLine([{ lit: true }, { lit: true }], 0)).toBe(
      "The Sun stays up for this landing.",
    );
  });
});

describe("fixture skyline", () => {
  it("has a hand-drawn hill at azimuth 90", () => {
    expect(fixture.maskElDeg).toHaveLength(360);
    expect(fixture.maskElDeg[90]).toBe(Math.max(...fixture.maskElDeg));
    expect(fixture.maskElDeg[90]).toBeGreaterThan(fixture.maskElDeg[0]);
  });

  it("puts the Sun on the track, four days before the ridge", () => {
    const onTrack = fixture.sunTrack.some(
      (point) => point.azDeg === fixture.sun.azDeg && point.elDeg === fixture.sun.elDeg,
    );
    expect(onTrack).toBe(true);
    const index = indexOnTrack(fixture.sunTrack, fixture.sun.azDeg, fixture.sun.elDeg);
    expect(sunHoverLine(fixture.sunTrack, index)).toBe(
      "The Sun sets behind this ridge in 4 days.",
    );
  });
});
