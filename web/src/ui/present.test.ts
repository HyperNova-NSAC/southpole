import { describe, expect, it } from "vitest";
import { earthsetLine, playheadCaption, sunsetLine } from "./present";

describe("countdown lines", () => {
  it("speaks in days when the event is still ahead", () => {
    expect(sunsetLine(4 * 24)).toBe("Sunset in 4 days");
    expect(earthsetLine(9 * 24)).toBe("Lose Earth in 9 days");
  });

  it("says the body stays up when the window never crosses the horizon", () => {
    expect(sunsetLine(null)).toBe("The Sun stays up for this landing.");
    expect(earthsetLine(null)).toBe("Earth stays in view for this landing.");
  });

  it("says the body is already down at landing", () => {
    expect(sunsetLine(0)).toBe("The Sun is down.");
    expect(earthsetLine(0)).toBe("Earth is out of view.");
  });
});

describe("playheadCaption", () => {
  it("formats the playhead as a UTC date", () => {
    expect(playheadCaption("2027-03-03T14:00:00Z")).toBe("3 March, 14:00 UTC");
  });
});
