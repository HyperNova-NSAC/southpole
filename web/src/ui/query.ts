export type Selection = {
  siteId: string;
  landingUtc: string;
  profileId: string;
  compareSiteId: string;
};

export const DEFAULT_SELECTION: Selection = {
  siteId: "shackleton-rim",
  landingUtc: "2027-03-03T00:00:00Z",
  profileId: "small-lander",
  compareSiteId: "nobile-rim-1",
};

export function selectionFromSearch(search: string): Selection {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const siteId = params.get("site") || DEFAULT_SELECTION.siteId;
  const profileId = params.get("profile") || DEFAULT_SELECTION.profileId;
  const compareSiteId = params.get("compare") || DEFAULT_SELECTION.compareSiteId;
  const date = params.get("date");
  return {
    siteId,
    profileId,
    compareSiteId,
    landingUtc: date ? dateToUtc(date) : DEFAULT_SELECTION.landingUtc,
  };
}

export function searchFromSelection(selection: Selection): string {
  const params = new URLSearchParams();
  params.set("site", selection.siteId);
  params.set("date", dateParam(selection.landingUtc));
  params.set("compare", selection.compareSiteId);
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
