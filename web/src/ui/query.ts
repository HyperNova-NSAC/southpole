/** The part of the app state that lives in the URL so a result can be shared. */
export type Selection = {
  siteId: string;
  landingUtc: string;
  profileId: string;
  /** Only set for a typed (custom) location. */
  latDeg?: number;
  lonDegEast?: number;
};

export const CUSTOM_SITE_ID = "custom";

export const DEFAULT_SELECTION: Selection = {
  siteId: "shackleton-rim",
  landingUtc: "2027-03-03T00:00:00Z",
  profileId: "small-lander",
};

export function selectionFromSearch(search: string): Selection {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const profileId = params.get("profile") || DEFAULT_SELECTION.profileId;
  const date = params.get("date");
  const landingUtc = date ? dateToUtc(date) : DEFAULT_SELECTION.landingUtc;

  const lat = Number.parseFloat(params.get("lat") ?? "");
  const lon = Number.parseFloat(params.get("lon") ?? "");
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { siteId: CUSTOM_SITE_ID, landingUtc, profileId, latDeg: lat, lonDegEast: lon };
  }

  const siteId = params.get("site") || DEFAULT_SELECTION.siteId;
  return { siteId, landingUtc, profileId };
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
  params.set("profile", selection.profileId);
  return `?${params.toString()}`;
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
