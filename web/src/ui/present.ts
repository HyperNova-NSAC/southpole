import type { Instant } from "../contract/types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function countdownLine(
  hours: number | null,
  stays: string,
  down: string,
  event: string,
): string {
  if (hours === null) return stays;
  if (hours <= 0) return down;
  const days = Math.round(hours / 24);
  if (hours >= 18 && days >= 1) {
    return `${event} in ${days} ${days === 1 ? "day" : "days"}`;
  }
  const wholeHours = Math.max(1, Math.round(hours));
  return `${event} in ${wholeHours} ${wholeHours === 1 ? "hour" : "hours"}`;
}

export function sunsetLine(hours: number | null): string {
  return countdownLine(hours, "The Sun stays up for this landing.", "The Sun is down.", "Sunset");
}

export function earthsetLine(hours: number | null): string {
  return countdownLine(hours, "Earth stays in view for this landing.", "Earth is out of view.", "Lose Earth");
}

export function playheadCaption(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function instantAt(samples: Instant[], playheadUtc: string): Instant | null {
  if (samples.length === 0) return null;
  const target = Date.parse(playheadUtc);
  let best = samples[0];
  let bestDistance = Infinity;
  for (const sample of samples) {
    const distance = Math.abs(Date.parse(sample.t) - target);
    if (distance < bestDistance) {
      best = sample;
      bestDistance = distance;
    }
  }
  return best;
}
