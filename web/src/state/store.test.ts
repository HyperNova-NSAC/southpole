import { describe, expect, it } from "vitest";
import { playheadOnPlay } from "./store";

const landing = "2027-01-15T00:00:00Z";
const hours = 14 * 24;

describe("playheadOnPlay", () => {
  it("starts at the landing time", () => {
    expect(playheadOnPlay({ landingUtc: landing, durationHours: hours, playheadUtc: landing })).toBe(landing);
  });

  it("keeps a pause in the middle of the window", () => {
    const paused = "2027-01-18T06:00:00.000Z";
    expect(playheadOnPlay({ landingUtc: landing, durationHours: hours, playheadUtc: paused })).toBe(paused);
  });

  it("starts over once the playhead has reached the end", () => {
    const end = new Date(Date.parse(landing) + hours * 3_600_000).toISOString();
    expect(playheadOnPlay({ landingUtc: landing, durationHours: hours, playheadUtc: end })).toBe(landing);
  });
});
