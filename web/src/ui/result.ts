import type { Instant, MissionProfile, Verdict, WindowMetrics } from "../contract/types";

/** One row of the result checklist. `required` rows decide the verdict; others are context. */
export type Check = {
  id: string;
  label: string;
  ok: boolean;
  required: boolean;
  detail: string;
};

/** Everything the result card shows, already worded. */
export type ResultSummary = {
  tone: Verdict["light"];
  title: string;
  subtitle: string;
  checks: Check[];
};

const TITLES: Record<Verdict["light"], string> = {
  green: "Viable landing",
  amber: "Marginal landing",
  red: "Not viable",
};

/** Hours as a short label: "50 h" under three days, "14 days" beyond. */
export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 72) return `${Math.round(hours)} h`;
  const days = hours / 24;
  return `${days < 10 ? Number(days.toFixed(1)) : Math.round(days)} days`;
}

/** Countdown tile value. `null` means the event never happens inside the mission. */
export function countdownValue(hours: number | null, never: string): string {
  if (hours === null) return never;
  if (hours <= 0) return "Now";
  return `In ${formatDuration(hours)}`;
}

/** Degrees with an explicit sign, using a true minus sign. */
export function formatSigned(deg: number): string {
  const sign = deg >= 0 ? "+" : "−";
  return `${sign}${Math.abs(deg).toFixed(1)}°`;
}

export function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Turn the evaluated mission into a status headline plus a pass/fail checklist. */
export function summarize(
  verdict: Verdict,
  metrics: WindowMetrics,
  profile: MissionProfile,
  landing: Instant,
): ResultSummary {
  const checks: Check[] = [];
  const failures: string[] = [];

  if (profile.earthRequiredAtLanding) {
    const ok = landing.earthVisible;
    checks.push({
      id: "earth-landing",
      label: "Earth in view at touchdown",
      ok,
      required: true,
      detail: `${formatSigned(landing.earthClearanceDeg)} above the skyline`,
    });
    if (!ok) failures.push("Earth is behind the skyline at touchdown");
  }

  const limit = profile.maxLongestDarkHours;
  if (limit !== null) {
    const ok = metrics.longestDarkHours <= limit;
    checks.push({
      id: "night",
      label: `Longest night under ${formatDuration(limit)}`,
      ok,
      required: true,
      detail: `Longest night ${formatDuration(metrics.longestDarkHours)}`,
    });
    if (!ok) failures.push(`the longest night lasts ${formatDuration(metrics.longestDarkHours)}`);
  }

  checks.push({
    id: "sun-landing",
    label: "Sunlight at touchdown",
    ok: metrics.litAtLanding,
    required: false,
    detail: `Sun ${formatSigned(landing.sunClearanceDeg)} above the skyline`,
  });

  return { tone: verdict.light, title: TITLES[verdict.light], subtitle: subtitleFor(verdict, metrics, profile, failures), checks };
}

function subtitleFor(
  verdict: Verdict,
  metrics: WindowMetrics,
  profile: MissionProfile,
  failures: string[],
): string {
  if (verdict.light === "red") {
    if (failures.length === 0) return "The mission does not get enough sunlight.";
    const sentence = failures.join(", and ");
    return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
  }
  if (verdict.light === "amber") return "Inside the limits, but with very little margin.";
  return `Sunlit ${percent(metrics.sunlitFraction)} of the ${formatDuration(profile.durationHours)} window, with Earth in contact ${percent(metrics.earthFraction)} of the time.`;
}
