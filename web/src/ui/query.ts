/** The part of the app state that lives in the URL so a result can be shared. */
export type Selection = {
  siteId: string;
  landingUtc: string;
  durationHours: number;
  /** Longest continuous night the landing is allowed, in hours. */
  maxNightHours: number;
  /** Only set for a typed (custom) location. */
  latDeg?: number;
  lonDegEast?: number;
};

export const CUSTOM_SITE_ID = "custom";

/** The window the page opens on, matching the old 14-day lander. */
export const DEFAULT_WINDOW_DAYS = 14;
/** The small-lander battery limit the page opens on. */
export const DEFAULT_NIGHT_HOURS = 50;
/** Horizons samples are half an hour apart, so a shorter window has nothing new to show. */
export const MIN_WINDOW_MINUTES = 30;
export const MAX_WINDOW_DAYS = 180;

export type WindowUnit = "minutes" | "hours" | "days";

const UNIT_MINUTES: Record<WindowUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 24 * 60,
};

/** Older links named a profile instead of a length. */
const LEGACY_PROFILE_DAYS: Record<string, number> = {
  "small-lander": 14,
  "long-stay": 100,
};

export const DEFAULT_SELECTION: Selection = {
  siteId: "shackleton-rim",
  landingUtc: "2027-03-03T00:00:00Z",
  durationHours: DEFAULT_WINDOW_DAYS * 24,
  maxNightHours: DEFAULT_NIGHT_HOURS,
};

/** Snap a length onto the half-hour sample step and keep it inside 30 minutes to 180 days. */
export function clampWindowMinutes(minutes: number): number {
  const snapped = Math.round(minutes / MIN_WINDOW_MINUTES) * MIN_WINDOW_MINUTES;
  const maxMinutes = MAX_WINDOW_DAYS * UNIT_MINUTES.days;
  return Math.min(maxMinutes, Math.max(MIN_WINDOW_MINUTES, snapped));
}

export function durationHoursFromAmount(amount: number, unit: WindowUnit): number {
  return clampWindowMinutes(amount * UNIT_MINUTES[unit]) / 60;
}

/** Coarsest unit that still shows the length as a whole number. */
export function windowUnit(durationHours: number): WindowUnit {
  const minutes = clampWindowMinutes(durationHours * 60);
  if (minutes % UNIT_MINUTES.days === 0) return "days";
  if (minutes % UNIT_MINUTES.hours === 0) return "hours";
  return "minutes";
}

export function windowFieldLimits(unit: WindowUnit): { min: number; max: number; step: number } {
  if (unit === "minutes") return { min: MIN_WINDOW_MINUTES, max: MAX_WINDOW_DAYS * UNIT_MINUTES.days, step: MIN_WINDOW_MINUTES };
  if (unit === "hours") return { min: 0.5, max: MAX_WINDOW_DAYS * 24, step: 0.5 };
  return { min: 1, max: MAX_WINDOW_DAYS, step: 1 };
}

/** The number to show when the length is already committed and the unit is chosen. */
export function formatWindowAmount(durationHours: number, unit: WindowUnit): string {
  const amount = clampWindowMinutes(durationHours * 60) / UNIT_MINUTES[unit];
  if (unit === "minutes") return String(Math.round(amount));
  if (Number.isInteger(amount)) return String(amount);
  if (unit === "hours") return amount.toFixed(1);
  return String(Math.round(amount * 1000) / 1000);
}

export function selectionFromSearch(search: string): Selection {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const durationHours = windowMinutesFromParams(params) / 60;
  const maxNightHours = nightMinutesFromParams(params) / 60;
  const date = params.get("date");
  const landingUtc = date ? dateToUtc(date) : DEFAULT_SELECTION.landingUtc;

  const lat = Number.parseFloat(params.get("lat") ?? "");
  const lon = Number.parseFloat(params.get("lon") ?? "");
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { siteId: CUSTOM_SITE_ID, landingUtc, durationHours, maxNightHours, latDeg: lat, lonDegEast: lon };
  }

  const siteId = params.get("site") || DEFAULT_SELECTION.siteId;
  return { siteId, landingUtc, durationHours, maxNightHours };
}

export function searchFromSelection(selection: Selection): string {
  const params = new URLSearchParams();
  const custom =
    selection.siteId === CUSTOM_SITE_ID &&
    selection.latDeg !== undefined &&
    selection.lonDegEast !== undefined;
  if (custom) {
    params.set("lat", String(selection.latDeg));
    params.set("lon", String(selection.lonDegEast));
  } else {
    params.set("site", selection.siteId);
  }
  params.set("date", dateParam(selection.landingUtc));
  const minutes = clampWindowMinutes(selection.durationHours * 60);
  if (minutes % UNIT_MINUTES.days === 0) params.set("days", String(minutes / UNIT_MINUTES.days));
  else if (minutes % UNIT_MINUTES.hours === 0) params.set("hours", String(minutes / UNIT_MINUTES.hours));
  else params.set("minutes", String(minutes));
  writeNight(params, selection.maxNightHours);
  return `?${params.toString()}`;
}

/** The default 50 h limit stays out of the link. Any other limit is written in its coarsest exact unit. */
function writeNight(params: URLSearchParams, hours: number) {
  const minutes = clampWindowMinutes(hours * 60);
  if (minutes === DEFAULT_NIGHT_HOURS * 60) return;
  if (minutes % UNIT_MINUTES.days === 0) params.set("nightDays", String(minutes / UNIT_MINUTES.days));
  else if (minutes % UNIT_MINUTES.hours === 0) params.set("nightHours", String(minutes / UNIT_MINUTES.hours));
  else params.set("nightMinutes", String(minutes));
}

function nightMinutesFromParams(params: URLSearchParams): number {
  const minutes = readAmount(params.get("nightMinutes"));
  if (minutes !== null) return clampWindowMinutes(minutes);
  const hours = readAmount(params.get("nightHours"));
  if (hours !== null) return clampWindowMinutes(hours * UNIT_MINUTES.hours);
  const days = readAmount(params.get("nightDays"));
  if (days !== null) return clampWindowMinutes(days * UNIT_MINUTES.days);
  return DEFAULT_NIGHT_HOURS * 60;
}

function readAmount(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  const amount = Number.parseFloat(raw);
  return Number.isFinite(amount) ? amount : null;
}

function windowMinutesFromParams(params: URLSearchParams): number {
  const minutes = readAmount(params.get("minutes"));
  if (minutes !== null) return clampWindowMinutes(minutes);
  const hours = readAmount(params.get("hours"));
  if (hours !== null) return clampWindowMinutes(hours * UNIT_MINUTES.hours);
  const days = readAmount(params.get("days"));
  if (days !== null) return clampWindowMinutes(days * UNIT_MINUTES.days);
  const legacy = params.get("profile");
  if (legacy && legacy in LEGACY_PROFILE_DAYS) return LEGACY_PROFILE_DAYS[legacy] * UNIT_MINUTES.days;
  return DEFAULT_WINDOW_DAYS * UNIT_MINUTES.days;
}

function dateToUtc(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T00:00:00Z`;
  const ms = Date.parse(date);
  if (Number.isNaN(ms)) return DEFAULT_SELECTION.landingUtc;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function dateParam(landingUtc: string): string {
  if (landingUtc.endsWith("T00:00:00Z")) return landingUtc.slice(0, 10);
  return landingUtc;
}
