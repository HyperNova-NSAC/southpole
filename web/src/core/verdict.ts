import type { Instant, MissionProfile, Verdict, WindowMetrics } from "../contract/types";

// A mission is amber when it is within this fraction of its longest-night limit.
export const AMBER_NIGHT_FRACTION = 0.9;
// An Earth disc that clears the comm margin by less than this many degrees is marginal.
export const AMBER_EARTH_CLEARANCE_DEG = 0.3;

export interface VerdictInput {
  metrics: WindowMetrics;
  profile: MissionProfile;
  landing: Instant;
  commMarginDeg: number;
}

// Build the plain-language landing verdict from the window metrics and profile.
export function buildVerdict(input: VerdictInput): Verdict {
  const { metrics, profile, landing, commMarginDeg } = input;
  const darkOver =
    profile.maxLongestDarkHours !== null &&
    metrics.longestDarkHours > profile.maxLongestDarkHours;
  const earthMiss = profile.earthRequiredAtLanding && !landing.earthVisible;

  const daysUp = Math.round((metrics.sunlitFraction * profile.durationHours) / 24);
  const nightH = Math.round(metrics.longestDarkHours);
  const days = profile.durationHours / 24;

  let light: Verdict["light"] = "green";
  let sentence: string;

  if (darkOver && earthMiss) {
    light = "red";
    sentence =
      "This landing does not work. Earth is below the horizon when you land, and the longest night is " +
      `${nightH} hours.`;
  } else if (darkOver) {
    light = "red";
    sentence =
      "This landing does not work. The longest night is " +
      `${nightH} hours, past the ${profile.maxLongestDarkHours}-hour limit.`;
  } else if (earthMiss) {
    light = "red";
    sentence = "This landing does not work. Earth is below the horizon when you land.";
  } else {
    const marginalNight =
      profile.maxLongestDarkHours !== null &&
      metrics.longestDarkHours > profile.maxLongestDarkHours * AMBER_NIGHT_FRACTION;
    const marginalEarth = landing.earthClearanceDeg < commMarginDeg + AMBER_EARTH_CLEARANCE_DEG;
    if (marginalNight || marginalEarth) {
      light = "amber";
      sentence = `This landing is marginal. The Sun is up for ${daysUp} of the ${Math.round(days)} days. The longest night is ${nightH} hours.`;
    } else {
      light = "green";
      sentence = `This landing works. The Sun is up for ${daysUp} of the ${Math.round(days)} days. Earth is in view when you land. The longest night is ${nightH} hours.`;
    }
  }

  const reasons: string[] = [];
  if (darkOver) {
    reasons.push(
      `Limit: longest night under ${profile.maxLongestDarkHours} hours. This window: ${nightH} hours.`,
    );
  }
  if (earthMiss) {
    reasons.push("Limit: Earth must be visible at landing. This window: Earth is below the horizon.");
  }

  return { light, sentence, reasons };
}
