import type { WindowMetrics } from "../contract/types";

const HOURS_PER_DAY = 24;
const SAME_DIFFERENCE_DAYS = 0.5;
const SAME_DIFFERENCE_HOURS = 6;

// Build the plain comparison sentence between two scenarios for the same landing.
export function compare(
  a: WindowMetrics,
  b: WindowMetrics,
  bName: string,
  durationHours: number,
): string {
  const durationDays = durationHours / HOURS_PER_DAY;
  const contactDiffDays = (b.earthFraction - a.earthFraction) * durationDays;
  const nightDiffHours = b.longestDarkHours - a.longestDarkHours;

  if (contactDiffDays > SAME_DIFFERENCE_DAYS) {
    return `${bName} stays in contact ${Math.round(contactDiffDays)} days longer.`;
  }
  if (nightDiffHours > SAME_DIFFERENCE_HOURS) {
    return `${bName}'s longest night is ${Math.round(nightDiffHours)} hours shorter.`;
  }
  return `${bName} is about the same for this landing.`;
}
