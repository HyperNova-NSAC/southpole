import { describe, expect, it } from "vitest";
import type { Instant, MissionProfile, WindowMetrics } from "../contract/types";
import { countdownValue, formatDuration, summarize } from "./result";

const profile: MissionProfile = {
  id: "small-lander",
  label: "Small lander, 14 days",
  durationHours: 336,
  earthRequiredAtLanding: true,
  maxLongestDarkHours: 50,
  illustrative: true,
};

const metrics: WindowMetrics = {
  sunlitFraction: 0,
  earthFraction: 0.4,
  bothFraction: 0,
  longestDarkHours: 337,
  longestCommGapHours: 100,
  sunsetInHours: 0,
  earthsetInHours: 0,
  litAtLanding: false,
  earthAtLanding: false,
  transitionCount: 0,
};

const landing = {
  sunClearanceDeg: -1.2,
  earthClearanceDeg: -3.4,
  earthVisible: false,
} as Instant;

describe("summarize", () => {
  it("turns a failed landing into a red headline and failing checks", () => {
    const summary = summarize({ light: "red", sentence: "", reasons: [] }, metrics, profile, landing);
    expect(summary.title).toBe("Not viable");
    expect(summary.subtitle).toBe(
      "Earth is behind the skyline at touchdown, and the longest night lasts 14 days.",
    );
    expect(summary.checks.filter((check) => check.required && !check.ok)).toHaveLength(2);
  });
});

describe("formatting", () => {
  it("shows hours under three days and days beyond", () => {
    expect(formatDuration(6.2)).toBe("6 h");
    expect(formatDuration(50)).toBe("50 h");
    expect(formatDuration(84)).toBe("3.5 days");
    expect(formatDuration(337)).toBe("14 days");
  });

  it("words countdowns", () => {
    expect(countdownValue(null, "Stays up")).toBe("Stays up");
    expect(countdownValue(0, "Stays up")).toBe("Now");
    expect(countdownValue(96, "Stays up")).toBe("In 4 days");
  });
});
